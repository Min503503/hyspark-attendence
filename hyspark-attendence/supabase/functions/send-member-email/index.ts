import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  adminClient,
  requireAdmin,
} from "../_shared/admin-auth.ts";
import {
  buildManualEmailHtml,
  manualEmailHeadline,
} from "../_shared/email-html-templates.ts";
import {
  RateLimitError,
  corsHeaders,
  generateUnsubscribeToken,
  getGmailAccessToken,
  jsonResponse,
  requireEnv,
  sendGmail,
} from "../_shared/gmail.ts";

type EmailRequest = {
  recipientIds?: string[];
  subject?: string;
  body?: string;
  /** Per-recipient personalized content (automation / bulk) */
  messages?: Array<{ recipientId: string; subject: string; body: string; html?: boolean }>;
  ruleId?: string | null;
  sessionId?: string | null;
  manual?: boolean;
};

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  mail_delivery_status: string;
};

// ─── Cooldown helpers ─────────────────────────────────────────────────────────

const COOLDOWN_KEY = "send_cooldown";
const COOLDOWN_MS = 10 * 60 * 1000;

async function getCooldown(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("email_send_state")
    .select("value")
    .eq("key", COOLDOWN_KEY)
    .maybeSingle();
  if (!data) return null;
  const retryAt = data.value?.retryAt as string | undefined;
  if (!retryAt || new Date(retryAt) <= new Date()) return null;
  return retryAt;
}

async function setCooldown(supabase: ReturnType<typeof createClient>) {
  const retryAt = new Date(Date.now() + COOLDOWN_MS).toISOString();
  await supabase.from("email_send_state").upsert(
    { key: COOLDOWN_KEY, value: { retryAt }, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return retryAt;
}

// ─── Unsubscribe URL builder ──────────────────────────────────────────────────

async function buildUnsubscribeUrl(profileId: string, email: string): Promise<string | undefined> {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET");
  if (!secret) return undefined;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const token = await generateUnsubscribeToken(profileId, email, secret);
  return `${supabaseUrl}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: EmailRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    const supabase = adminClient();
    const authError = await requireAdmin(req, supabase);
    if (authError) return authError;

    // Check rate-limit cooldown before starting
    const cooldownRetryAt = await getCooldown(supabase);
    if (cooldownRetryAt) {
      return jsonResponse({ rateLimited: true, retryAt: cooldownRetryAt, deferredCount: 0, sent: 0, results: [] });
    }

    const from = requireEnv("GMAIL_FROM");
    const accessToken = await getGmailAccessToken();
    const results: Array<{ memberId: string; email: string; messageId?: string; error?: string; skipped?: string }> = [];
    let deferredCount = 0;
    let rateLimited = false;
    let retryAt: string | undefined;

    const sendOne = async (
      profile: Profile,
      subject: string,
      body: string,
      dedupeKey?: string,
      html = false,
    ) => {
      if (!profile.email) return;

      // Bounced users: block all mail
      // Unsubscribed users: block general (non-essential) mail
      if (profile.mail_delivery_status === "bounced" || profile.mail_delivery_status === "unsubscribed") {
        results.push({ memberId: profile.id, email: profile.email, skipped: profile.mail_delivery_status });
        return;
      }

      if (dedupeKey) {
        const { data: existing } = await supabase
          .from("email_send_logs")
          .select("id")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();
        if (existing) return;
      }

      const unsubscribeUrl = await buildUnsubscribeUrl(profile.id, profile.email);

      try {
        const result = await sendGmail(accessToken, from, profile.email, subject, body, { html, unsubscribeUrl });
        results.push({ memberId: profile.id, email: profile.email, messageId: result.id });

        if (dedupeKey) {
          await supabase.from("email_send_logs").insert({
            rule_id: payload.ruleId || null,
            session_id: payload.sessionId || null,
            profile_id: profile.id,
            email: profile.email,
            subject,
            status: "sent",
            message_id: result.id,
            dedupe_key: dedupeKey,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "send failed";
        results.push({ memberId: profile.id, email: profile.email, error: message });
        if (dedupeKey) {
          await supabase.from("email_send_logs").insert({
            rule_id: payload.ruleId || null,
            session_id: payload.sessionId || null,
            profile_id: profile.id,
            email: profile.email,
            subject,
            status: "failed",
            error_message: message,
            dedupe_key: dedupeKey,
          });
        }
        if (err instanceof RateLimitError) throw err;
      }
    };

    try {
      if (payload.messages?.length) {
        const ids = payload.messages.map((m) => m.recipientId);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, mail_delivery_status")
          .in("id", ids);

        if (error) return jsonResponse({ error: error.message }, 500);

        const byId = new Map(((data || []) as Profile[]).map((p) => [p.id, p]));
        for (const msg of payload.messages) {
          const profile = byId.get(msg.recipientId);
          if (!profile?.email) continue;
          await sendOne(profile, msg.subject.trim(), msg.body.trim(), undefined, msg.html ?? false);
        }
      } else {
        const recipientIds = Array.from(new Set(payload.recipientIds || []));
        const subject = payload.subject?.trim();
        const body = payload.body?.trim();

        if (recipientIds.length === 0) {
          return jsonResponse({ error: "수신자를 선택해주세요." }, 400);
        }
        if (!subject || !body) {
          return jsonResponse({ error: "제목과 본문을 입력해주세요." }, 400);
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, mail_delivery_status")
          .eq("role", "member")
          .eq("status", "active")
          .in("id", recipientIds);

        if (error) return jsonResponse({ error: error.message }, 500);

        const recipients = ((data || []) as Profile[]).filter((p) => p.email);
        if (recipients.length === 0) {
          return jsonResponse({ error: "메일 주소가 등록된 활성 학회원이 없습니다." }, 400);
        }

        const headline = payload.manual ? manualEmailHeadline(subject) : subject;

        for (const profile of recipients) {
          const dedupeKey = payload.manual
            ? `manual:${profile.id}:${Date.now()}:${crypto.randomUUID()}`
            : undefined;

          const unsubscribeUrl = profile.email
            ? await buildUnsubscribeUrl(profile.id, profile.email)
            : undefined;

          const emailBody = payload.manual
            ? buildManualEmailHtml({
                memberName: profile.full_name,
                headline,
                bodyText: body,
                unsubscribeUrl,
              })
            : body;

          await sendOne(profile, subject, emailBody, dedupeKey, payload.manual ?? false);
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        // Count remaining unsent recipients as deferred
        deferredCount = (payload.messages?.length ?? payload.recipientIds?.length ?? 0) - results.length;
        rateLimited = true;
        retryAt = await setCooldown(supabase);
      } else {
        throw err;
      }
    }

    const sent = results.filter((r) => r.messageId).length;
    const errors = results.filter((r) => r.error);

    if (sent === 0 && errors.length > 0 && !rateLimited) {
      return jsonResponse({ error: errors[0].error, results }, 500);
    }

    return jsonResponse({ sent, deferredCount, rateLimited, retryAt, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "메일 발송 중 오류가 발생했습니다.";
    return jsonResponse({ error: message }, 500);
  }
});
