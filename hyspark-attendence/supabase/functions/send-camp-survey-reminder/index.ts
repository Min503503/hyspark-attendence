import {
  adminClient,
  requireAdminOrCron,
} from "../_shared/admin-auth.ts";
import { buildCampSurveyReminderEmail } from "../_shared/email-html-templates.ts";
import { getMemberPortalToken, memberPortalUrl } from "../_shared/member-portal-link.ts";
import {
  RateLimitError,
  corsHeaders,
  generateUnsubscribeToken,
  getGmailAccessToken,
  jsonResponse,
  requireEnv,
  sendGmail,
} from "../_shared/gmail.ts";

type CampSettings = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  enabled: boolean;
};

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  mail_delivery_status: string;
};

function kstDateString(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function formatTodayLabel(date = new Date()): string {
  return date.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

async function buildUnsubscribeUrl(profileId: string, email: string): Promise<string | undefined> {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET");
  if (!secret) return undefined;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const token = await generateUnsubscribeToken(profileId, email, secret);
  return `${supabaseUrl}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = adminClient();
  const authError = await requireAdminOrCron(req, supabase);
  if (authError) return authError;

  try {
    const { data: camp, error: campError } = await supabase
      .from("camp_settings")
      .select("id, title, start_date, end_date, enabled")
      .eq("enabled", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (campError) return jsonResponse({ error: campError.message }, 500);

    const today = kstDateString();
    if (!camp || !camp.enabled || today < camp.start_date || today > camp.end_date) {
      return jsonResponse({ ok: true, skipped: true, reason: "no_active_camp" });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, mail_delivery_status")
      .eq("role", "member")
      .eq("status", "active")
      .not("email", "is", null);

    if (profilesError) return jsonResponse({ error: profilesError.message }, 500);

    const from = requireEnv("GMAIL_FROM");
    const accessToken = await getGmailAccessToken();
    const campDateRange = `${camp.start_date} ~ ${camp.end_date}`;
    const todayLabel = formatTodayLabel();

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let rateLimited = false;
    let retryAt: string | undefined;

    for (const profile of (profiles || []) as Profile[]) {
      if (!profile.email) continue;

      // Block bounced and unsubscribed — this is a general (non-essential) mail
      if (profile.mail_delivery_status === "bounced" || profile.mail_delivery_status === "unsubscribed") {
        skipped += 1;
        continue;
      }

      const dedupeKey = `camp-survey-${camp.id}-${today}-${profile.id}`;
      const { data: existing } = await supabase
        .from("email_send_logs")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();

      if (existing) {
        skipped += 1;
        continue;
      }

      const portalToken = await getMemberPortalToken(supabase, profile.id);
      const unsubscribeUrl = await buildUnsubscribeUrl(profile.id, profile.email);
      const { subject, html } = buildCampSurveyReminderEmail({
        memberName: profile.full_name,
        campTitle: camp.title,
        campDateRange,
        todayLabel,
        campSurveyLink: memberPortalUrl("camp-survey", { token: portalToken }),
        unsubscribeUrl,
      });

      try {
        const result = await sendGmail(accessToken, from, profile.email, subject, html, { html: true, unsubscribeUrl });
        await supabase.from("email_send_logs").insert({
          profile_id: profile.id,
          email: profile.email,
          subject,
          status: "sent",
          message_id: result.id,
          dedupe_key: dedupeKey,
        });
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "send failed";
        await supabase.from("email_send_logs").insert({
          profile_id: profile.id,
          email: profile.email,
          subject,
          status: "failed",
          error_message: message,
          dedupe_key: dedupeKey,
        });
        failed += 1;

        if (err instanceof RateLimitError) {
          retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          await supabase.from("email_send_state").upsert(
            { key: "send_cooldown", value: { retryAt }, updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
          rateLimited = true;
          break;
        }
      }
    }

    return jsonResponse({
      ok: true,
      campId: camp.id,
      date: today,
      sent,
      skipped,
      failed,
      rateLimited,
      retryAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "camp survey reminder failed";
    return jsonResponse({ error: message }, 500);
  }
});
