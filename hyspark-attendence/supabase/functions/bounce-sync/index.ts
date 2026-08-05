/**
 * bounce-sync — queries Gmail for DSN bounce messages in the last 7 days,
 * parses permanent (5.x.x) vs transient (4.x.x) failures, and updates profiles.
 *
 * Triggered by Supabase cron every 6 hours.
 * Requires GMAIL_READONLY_REFRESH_TOKEN with gmail.readonly scope.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getGmailAccessToken,
  jsonResponse,
  requireEnv,
} from "../_shared/gmail.ts";

type GmailMessageRef = { id: string; threadId: string };
type GmailListResponse = { messages?: GmailMessageRef[]; nextPageToken?: string };

type DsnParsed = {
  recipientEmail: string | null;
  dsnStatus: string | null;   // e.g. "5.1.1"
  dsnAction: string | null;   // e.g. "failed"
  rawReason: string | null;
  bounceType: "permanent" | "transient" | "unknown";
};

// ─── Gmail API helpers ────────────────────────────────────────────────────────

async function gmailGet(accessToken: string, path: string): Promise<unknown> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `Gmail API error ${res.status}`);
  }
  return res.json();
}

async function fetchBounceMessageIds(accessToken: string): Promise<string[]> {
  // Search last 7 days for DSN / Mail Delivery Subsystem messages
  const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const query = encodeURIComponent(
    `from:mailer-daemon@googlemail.com OR from:postmaster after:${sevenDaysAgo}`,
  );

  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const pagePart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const data = await gmailGet(
      accessToken,
      `messages?q=${query}&maxResults=50${pagePart}`,
    ) as GmailListResponse;

    for (const msg of data.messages || []) ids.push(msg.id);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return ids;
}

// ─── DSN parser ───────────────────────────────────────────────────────────────

/**
 * Extract plain-text parts from a Gmail message payload (recursive).
 */
function extractTextParts(payload: Record<string, unknown>): string[] {
  const mimeType = payload.mimeType as string | undefined;
  const body = payload.body as { data?: string } | undefined;
  const parts = payload.parts as Record<string, unknown>[] | undefined;

  const texts: string[] = [];

  if (mimeType === "text/plain" && body?.data) {
    try {
      const decoded = atob(body.data.replace(/-/g, "+").replace(/_/g, "/"));
      texts.push(decoded);
    } catch { /* ignore decode errors */ }
  }

  if (mimeType === "message/delivery-status" && body?.data) {
    try {
      const decoded = atob(body.data.replace(/-/g, "+").replace(/_/g, "/"));
      texts.push(decoded);
    } catch { /* ignore */ }
  }

  for (const part of parts || []) {
    texts.push(...extractTextParts(part));
  }

  return texts;
}

function parseDsn(rawText: string): DsnParsed {
  const lines = rawText.split(/\r?\n/);

  let recipientEmail: string | null = null;
  let dsnStatus: string | null = null;
  let dsnAction: string | null = null;
  let rawReason: string | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Final-Recipient: rfc822; user@example.com
    if (!recipientEmail && lower.startsWith("final-recipient:")) {
      const match = line.match(/;\s*(.+@.+\..+)/);
      if (match) recipientEmail = match[1].trim().toLowerCase();
    }

    // Action: failed | delayed | delivered | relayed | expanded
    if (!dsnAction && lower.startsWith("action:")) {
      dsnAction = line.split(":")[1]?.trim().toLowerCase() || null;
    }

    // Status: 5.1.1 / 4.2.2 / etc.
    if (!dsnStatus && lower.startsWith("status:")) {
      const match = line.match(/(\d+\.\d+\.\d+)/);
      if (match) dsnStatus = match[1];
    }

    // Diagnostic-Code: smtp; 550 5.1.1 ...
    if (!rawReason && lower.startsWith("diagnostic-code:")) {
      rawReason = line.split(":").slice(1).join(":").trim();
    }
  }

  // Also scan plain-text for email addresses if DSN section didn't have one
  if (!recipientEmail) {
    const emailMatch = rawText.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/);
    if (emailMatch) recipientEmail = emailMatch[1].toLowerCase();
  }

  let bounceType: "permanent" | "transient" | "unknown" = "unknown";
  if (dsnAction === "failed" && dsnStatus?.startsWith("5.")) bounceType = "permanent";
  else if (dsnStatus?.startsWith("4.")) bounceType = "transient";
  // 4.7.28 enhanced code is technically a sending limit, not a real bounce — skip
  if (dsnStatus === "4.7.28") bounceType = "unknown";

  return { recipientEmail, dsnStatus, dsnAction, rawReason, bounceType };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept cron secret or service-role key
  const cronSecret = Deno.env.get("CRON_SECRET");
  const incomingSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isAuthorized =
    (cronSecret && incomingSecret === cronSecret) ||
    (serviceKey && authHeader === `Bearer ${serviceKey}`);

  if (!isAuthorized) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const accessToken = await getGmailAccessToken("readonly");
    const messageIds = await fetchBounceMessageIds(accessToken);

    let processed = 0;
    let permanent = 0;
    let transient = 0;
    let skipped = 0;

    for (const gmailMsgId of messageIds) {
      // Skip already-processed messages
      const { data: existing } = await supabase
        .from("bounce_logs")
        .select("id")
        .eq("gmail_message_id", gmailMsgId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      let dsn: DsnParsed;
      try {
        const msgData = await gmailGet(accessToken, `messages/${gmailMsgId}?format=full`) as { payload: Record<string, unknown> };
        const texts = extractTextParts(msgData.payload);
        dsn = parseDsn(texts.join("\n"));
      } catch {
        skipped++;
        continue;
      }

      // Skip if we couldn't determine email or it's not a real bounce
      if (!dsn.recipientEmail || dsn.bounceType === "unknown") {
        await supabase.from("bounce_logs").insert({
          gmail_message_id: gmailMsgId,
          email: dsn.recipientEmail || "unknown",
          dsn_status: dsn.dsnStatus,
          dsn_action: dsn.dsnAction,
          bounce_type: "unknown",
          raw_reason: dsn.rawReason,
        });
        skipped++;
        continue;
      }

      // Find profile by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, bounce_count, mail_delivery_status")
        .eq("email", dsn.recipientEmail)
        .maybeSingle();

      const profileId = profile?.id ?? null;

      await supabase.from("bounce_logs").insert({
        gmail_message_id: gmailMsgId,
        email: dsn.recipientEmail,
        profile_id: profileId,
        dsn_status: dsn.dsnStatus,
        dsn_action: dsn.dsnAction,
        bounce_type: dsn.bounceType,
        raw_reason: dsn.rawReason,
      });

      if (profile) {
        const newCount = (profile.bounce_count || 0) + 1;

        if (dsn.bounceType === "permanent") {
          await supabase.from("profiles").update({
            mail_delivery_status: "bounced",
            bounce_count: newCount,
            last_bounce_at: new Date().toISOString(),
            last_bounce_reason: dsn.rawReason || dsn.dsnStatus,
          }).eq("id", profile.id);
          permanent++;
        } else {
          // Transient — record only, don't block
          await supabase.from("profiles").update({
            bounce_count: newCount,
            last_bounce_at: new Date().toISOString(),
            last_bounce_reason: dsn.rawReason || dsn.dsnStatus,
          }).eq("id", profile.id);
          transient++;
        }
      }

      processed++;
    }

    // Store last sync timestamp
    await supabase.from("email_send_state").upsert(
      {
        key: "bounce_sync_last_run",
        value: { at: new Date().toISOString(), processed, permanent, transient, skipped },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    return jsonResponse({ ok: true, total: messageIds.length, processed, permanent, transient, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "bounce-sync failed";
    return jsonResponse({ error: message }, 500);
  }
});
