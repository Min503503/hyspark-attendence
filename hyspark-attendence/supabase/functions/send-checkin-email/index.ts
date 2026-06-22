import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getGmailAccessToken,
  jsonResponse,
  requireEnv,
  sendGmail,
} from "../_shared/gmail.ts";
import { buildEmailFromSession } from "../_shared/email-html-templates.ts";
import { getMemberPortalToken, memberPortalUrl } from "../_shared/member-portal-link.ts";

type CheckInRequest = {
  memberId: string;
  sessionId: string;
  checkedInAt: string;
  status: "present" | "late" | "unexcused_absent";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: CheckInRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.memberId || !payload.sessionId || !payload.checkedInAt) {
    return jsonResponse({ error: "memberId, sessionId, checkedInAt are required" }, 400);
  }

  try {
    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const from = requireEnv("GMAIL_FROM");

    const { data: rule } = await supabase
      .from("email_automation_rules")
      .select("id, enabled")
      .eq("trigger_type", "checkin_complete")
      .maybeSingle();

    if (!rule?.enabled) {
      return jsonResponse({ skipped: true, reason: "checkin_complete rule disabled" });
    }

    const [{ data: profile, error: profileError }, { data: session, error: sessionError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, status")
        .eq("id", payload.memberId)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("id, title, start_at, check_in_open_minutes, attendance_code")
        .eq("id", payload.sessionId)
        .maybeSingle(),
    ]);

    if (profileError || sessionError) {
      return jsonResponse({ error: profileError?.message || sessionError?.message }, 500);
    }
    if (!profile?.email || profile.status !== "active" || profile.role !== "member") {
      return jsonResponse({ skipped: true, reason: "no eligible email" });
    }
    if (!session) {
      return jsonResponse({ error: "session not found" }, 404);
    }

    const { data: attendance } = await supabase
      .from("attendance_records")
      .select("id, checked_in_at")
      .eq("session_id", payload.sessionId)
      .eq("member_id", payload.memberId)
      .maybeSingle();

    if (!attendance) {
      return jsonResponse({ error: "Unauthorized: no check-in record" }, 403);
    }

    const checkedAt = new Date(attendance.checked_in_at || 0).getTime();
    if (Date.now() - checkedAt > 15 * 60 * 1000) {
      return jsonResponse({ error: "Unauthorized: check-in window expired" }, 403);
    }

    const dedupeKey = `checkin:${payload.sessionId}:${payload.memberId}`;
    const { data: existing } = await supabase
      .from("email_send_logs")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ skipped: true, reason: "already sent" });
    }

    const portalToken = await getMemberPortalToken(supabase, profile.id);
    const { subject, html } = buildEmailFromSession(
      "checkin_complete",
      profile,
      session,
      {
        checkedInAt: payload.checkedInAt,
        attendanceStatus: payload.status,
        checkInLink: memberPortalUrl("checkin", { token: portalToken }),
        absenceLink: memberPortalUrl("absence", { token: portalToken }),
      },
    );

    const accessToken = await getGmailAccessToken();

    try {
      const result = await sendGmail(accessToken, from, profile.email, subject, html, { html: true });
      await supabase.from("email_send_logs").insert({
        rule_id: rule.id,
        session_id: session.id,
        profile_id: profile.id,
        email: profile.email,
        subject,
        status: "sent",
        message_id: result.id,
        dedupe_key: dedupeKey,
      });
      return jsonResponse({ sent: true, messageId: result.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";
      await supabase.from("email_send_logs").insert({
        rule_id: rule.id,
        session_id: session.id,
        profile_id: profile.id,
        email: profile.email,
        subject,
        status: "failed",
        error_message: message,
        dedupe_key: dedupeKey,
      });
      return jsonResponse({ error: message }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in email failed";
    return jsonResponse({ error: message }, 500);
  }
});
