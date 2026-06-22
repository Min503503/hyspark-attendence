import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getGmailAccessToken,
  jsonResponse,
  requireEnv,
  sendGmail,
} from "../_shared/gmail.ts";
import {
  buildEmailFromSession,
  triggerToTemplateKind,
} from "../_shared/email-html-templates.ts";
import { computeAutomationSendAtFromRule } from "../_shared/email-schedule.ts";
import { getMemberPortalToken, memberPortalUrl } from "../_shared/member-portal-link.ts";

const WINDOW_MS = 20 * 60 * 1000;

type Rule = {
  id: string;
  name: string;
  trigger_type: "session_before" | "session_open" | "checkin_complete";
  offset_minutes: number;
  audience: "all_members" | "staff";
  enabled: boolean;
};

type Session = {
  id: string;
  title: string;
  start_at: string;
  status: string;
  venue_name: string | null;
  venue_map_url: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  check_in_open_minutes: number;
  attendance_code: string | null;
  attendance_code_status: string;
  attendance_code_issued_at: string | null;
};

type Profile = { id: string; full_name: string; email: string | null; role: string; status: string };

function inWindow(now: Date, target: Date) {
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff < WINDOW_MS;
}

function ruleMatchesSession(rule: Rule, session: Session, now: Date) {
  if (session.status === "archived" || session.status === "draft") return false;
  if (rule.trigger_type === "checkin_complete") return false;

  if (rule.trigger_type === "session_before") {
    if (session.status !== "scheduled" && session.status !== "open") return false;
    const target = computeAutomationSendAtFromRule(rule, session);
    if (!target) return false;
    return inWindow(now, target);
  }

  if (rule.trigger_type === "session_open") {
    if (session.status !== "open" || session.attendance_code_status !== "active") return false;
    const target = computeAutomationSendAtFromRule(rule, session);
    if (!target) return false;
    return inWindow(now, target);
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const from = requireEnv("GMAIL_FROM");
    const now = new Date();

    const { data: rules, error: rulesError } = await supabase
      .from("email_automation_rules")
      .select("id, name, trigger_type, offset_minutes, audience, enabled")
      .eq("enabled", true)
      .in("trigger_type", ["session_before", "session_open"])
      .order("sort_order");

    if (rulesError) return jsonResponse({ error: rulesError.message }, 500);

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, title, start_at, status, venue_name, venue_map_url, venue_lat, venue_lng, check_in_open_minutes, attendance_code, attendance_code_status, attendance_code_issued_at")
      .in("status", ["scheduled", "open"]);

    if (sessionsError) return jsonResponse({ error: sessionsError.message }, 500);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status")
      .eq("status", "active")
      .not("email", "is", null);

    if (profilesError) return jsonResponse({ error: profilesError.message }, 500);

    const accessToken = await getGmailAccessToken();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const rule of (rules || []) as Rule[]) {
      const templateKind = triggerToTemplateKind(rule.trigger_type, rule.offset_minutes);
      if (!templateKind) continue;

      for (const session of (sessions || []) as Session[]) {
        if (!ruleMatchesSession(rule, session, now)) continue;

        const recipients = ((profiles || []) as Profile[]).filter((p) => {
          if (!p.email) return false;
          if (rule.audience === "staff") return p.role === "staff" || p.role === "admin";
          return p.role === "member";
        });

        for (const profile of recipients) {
          const dedupeKey = `${rule.id}:${session.id}:${profile.id}`;
          const { data: existing } = await supabase
            .from("email_send_logs")
            .select("id")
            .eq("dedupe_key", dedupeKey)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          const portalToken = await getMemberPortalToken(supabase, profile.id);
          const { subject, html } = buildEmailFromSession(templateKind, profile, session, {
            absenceLink: memberPortalUrl("absence", { token: portalToken }),
            checkInLink: memberPortalUrl("checkin", { token: portalToken }),
          });

          // Pre-insert log with 'sent' status to acquire UNIQUE key lock
          const { error: lockError } = await supabase
            .from("email_send_logs")
            .insert({
              rule_id: rule.id,
              session_id: session.id,
              profile_id: profile.id,
              email: profile.email,
              subject,
              status: "sent",
              dedupe_key: dedupeKey,
            });

          if (lockError) {
            // If another instance inserted the log concurrently, skip this send
            skipped++;
            continue;
          }

          try {
            const result = await sendGmail(accessToken, from, profile.email!, subject, html, { html: true });
            if (result?.id) {
              await supabase
                .from("email_send_logs")
                .update({ message_id: result.id })
                .eq("dedupe_key", dedupeKey);
            }
            sent++;
          } catch (err) {
            const message = err instanceof Error ? err.message : "send failed";
            await supabase
              .from("email_send_logs")
              .update({
                status: "failed",
                error_message: message,
              })
              .eq("dedupe_key", dedupeKey);
            failed++;
          }
        }
      }
    }

    return jsonResponse({
      checked_at: now.toISOString(),
      sent,
      skipped,
      failed,
      rules_checked: (rules || []).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation failed";
    return jsonResponse({ error: message }, 500);
  }
});
