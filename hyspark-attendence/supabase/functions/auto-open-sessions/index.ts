import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  adminClient,
  generateAttendanceCode,
  requireAdminOrCron,
} from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let triggerSource = "auto_open_sessions";
  try {
    const body = await req.json();
    if (body?.trigger_source === "admin_manual") {
      triggerSource = "admin_manual";
    }
  } catch {
    // empty body is fine for cron
  }

  const supabase = adminClient();
  const authError = await requireAdminOrCron(req, supabase);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const now = new Date();

  // Find scheduled sessions whose start_at minus check_in_open_minutes <= now
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "scheduled");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let opened = 0;

  for (const session of sessions || []) {
    const startAt = new Date(session.start_at);
    const openTime = new Date(
      startAt.getTime() - session.check_in_open_minutes * 60 * 1000
    );

    if (now >= openTime) {
      const code = generateAttendanceCode();
      const expiresAt = new Date(
        startAt.getTime() + session.late_deadline_minutes * 60 * 1000
      );

      await supabase
        .from("sessions")
        .update({
          status: "open",
          attendance_code: code,
          attendance_code_status: "active",
          attendance_code_issued_at: now.toISOString(),
          attendance_code_expires_at: expiresAt.toISOString(),
        })
        .eq("id", session.id);

      opened++;
    }
  }

  // Also auto-close sessions past their late deadline
  const { data: openSessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "open");

  let closed = 0;

  for (const session of openSessions || []) {
    const startAt = new Date(session.start_at);
    const closeTime = new Date(
      startAt.getTime() + session.late_deadline_minutes * 60 * 1000
    );

    if (now >= closeTime) {
      // Get all active members
      const { data: allMembers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "member")
        .eq("status", "active");

      // Get members who already have a record (check-in or excused absence)
      const { data: existingRecords } = await supabase
        .from("attendance_records")
        .select("member_id")
        .eq("session_id", session.id);

      const checkedInIds = new Set(
        (existingRecords || []).map((r: { member_id: string }) => r.member_id)
      );

      // Insert unexcused_absent for members with no record at all
      // (excused_absent members already have a record, so they're excluded)
      const absentRecords = (allMembers || [])
        .filter((m: { id: string }) => !checkedInIds.has(m.id))
        .map((m: { id: string; full_name: string }) => ({
          session_id: session.id,
          member_id: m.id,
          member_name: m.full_name,
          status: "unexcused_absent",
          checked_in_at: now.toISOString(),
          check_in_method: "auto",
          code_verified: false,
          location_verified: false,
          demerit_points: 1,
        }));

      if (absentRecords.length > 0) {
        await supabase.from("attendance_records").insert(absentRecords);
      }

      await supabase
        .from("sessions")
        .update({
          status: "closed",
          attendance_code_status: "expired",
        })
        .eq("id", session.id);

      closed++;
    }
  }

  // Trigger email automation (session reminders, open notifications, etc.)
  let emailAutomation: Record<string, unknown> | null = null;
  let automationError: string | null = null;
  try {
    const fnUrl = `${supabaseUrl}/functions/v1/process-email-automation`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    emailAutomation = await res.json();
    if (!res.ok) {
      automationError = (emailAutomation as { error?: string })?.error || `HTTP ${res.status}`;
    }
  } catch (err) {
    automationError = err instanceof Error ? err.message : "email automation invoke failed";
    emailAutomation = { error: automationError };
  }

  const emailStats = emailAutomation as {
    sent?: number;
    skipped?: number;
    failed?: number;
    rules_checked?: number;
    error?: string;
  } | null;

  await supabase.from("email_automation_runs").insert({
    checked_at: now.toISOString(),
    opened,
    closed,
    sent: emailStats?.sent ?? 0,
    skipped: emailStats?.skipped ?? 0,
    failed: emailStats?.failed ?? 0,
    rules_checked: emailStats?.rules_checked ?? 0,
    trigger_source: triggerSource,
    error_message: automationError || emailStats?.error || null,
    raw_response: {
      opened,
      closed,
      emailAutomation,
    },
  });

  return new Response(
    JSON.stringify({ opened, closed, checked_at: now.toISOString(), emailAutomation }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
