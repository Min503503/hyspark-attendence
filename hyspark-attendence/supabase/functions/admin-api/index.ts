import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/gmail.ts";
import {
  adminClient,
  demeritPoints,
  generateAttendanceCode,
  requireAdmin,
} from "../_shared/admin-auth.ts";
import {
  DEFAULT_EMAIL_RULES,
  ruleKey,
} from "../_shared/email-automation-rules.ts";

type AdminAction =
  | "open_check_in"
  | "close_check_in"
  | "regenerate_code"
  | "create_session"
  | "update_session"
  | "delete_session"
  | "add_member"
  | "update_member"
  | "delete_member"
  | "add_staff"
  | "update_staff"
  | "delete_staff"
  | "override_attendance"
  | "add_manual_record"
  | "toggle_automation_rule"
  | "sync_automation_rules"
  | "get_camp_responses"
  | "get_camp_settings"
  | "toggle_camp_enabled"
  | "ensure_member_portal_token";

async function syncAutomationRules(supabase: ReturnType<typeof createClient>) {
  const { data: existing, error } = await supabase
    .from("email_automation_rules")
    .select("id, trigger_type, offset_minutes");

  if (error) throw new Error(error.message);

  const standardKeys = new Set(
    DEFAULT_EMAIL_RULES.map((r) => ruleKey(r.trigger_type, r.offset_minutes)),
  );

  const byKey = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const row of existing || []) {
    const key = ruleKey(row.trigger_type, row.offset_minutes);
    if (!standardKeys.has(key)) {
      duplicateIds.push(row.id);
      continue;
    }
    if (byKey.has(key)) duplicateIds.push(row.id);
    else byKey.set(key, row.id);
  }

  if (duplicateIds.length > 0) {
    await supabase.from("email_automation_rules").delete().in("id", duplicateIds);
  }

  const now = new Date().toISOString();
  for (const rule of DEFAULT_EMAIL_RULES) {
    const key = ruleKey(rule.trigger_type, rule.offset_minutes);
    const id = byKey.get(key);
    if (id) {
      const { enabled: _e, ...syncFields } = rule;
      const { error: updateError } = await supabase
        .from("email_automation_rules")
        .update({ ...syncFields, updated_at: now })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from("email_automation_rules")
        .insert({ ...rule, updated_at: now });
      if (insertError) throw new Error(insertError.message);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = adminClient();
  const authError = await requireAdmin(req, supabase);
  if (authError) return authError;

  let body: { action?: AdminAction; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const action = body.action;
  const p = body.payload || {};

  try {
    switch (action) {
      case "open_check_in": {
        const sessionId = p.sessionId as string;
        const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
        if (!session) return jsonResponse({ error: "세션 없음" }, 404);
        const code = session.attendance_code || generateAttendanceCode();
        const startAt = new Date(session.start_at).getTime();
        const expiresAt = new Date(startAt + session.late_deadline_minutes * 60000).toISOString();
        const { error } = await supabase.from("sessions").update({
          status: "open",
          attendance_code: code,
          attendance_code_status: "active",
          attendance_code_issued_at: new Date().toISOString(),
          attendance_code_expires_at: expiresAt,
        }).eq("id", sessionId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true, code });
      }

      case "close_check_in": {
        const sessionId = p.sessionId as string;
        const now = new Date().toISOString();
        const { data: allMembers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "member")
          .eq("status", "active");
        const { data: existingRecords } = await supabase
          .from("attendance_records")
          .select("member_id")
          .eq("session_id", sessionId);
        const recorded = new Set((existingRecords || []).map((r) => r.member_id));
        const absentRecords = (allMembers || [])
          .filter((m) => !recorded.has(m.id))
          .map((m) => ({
            session_id: sessionId,
            member_id: m.id,
            member_name: m.full_name,
            status: "unexcused_absent",
            checked_in_at: now,
            check_in_method: "auto",
            code_verified: false,
            location_verified: false,
            demerit_points: 1,
          }));
        if (absentRecords.length > 0) {
          await supabase.from("attendance_records").insert(absentRecords);
        }
        const { error } = await supabase.from("sessions").update({
          status: "closed",
          attendance_code_status: "expired",
        }).eq("id", sessionId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "regenerate_code": {
        const sessionId = p.sessionId as string;
        const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
        if (!session) return jsonResponse({ error: "세션 없음" }, 404);
        const newCode = generateAttendanceCode();
        const startAt = new Date(session.start_at).getTime();
        const expiresAt = new Date(startAt + session.late_deadline_minutes * 60000).toISOString();
        const { error } = await supabase.from("sessions").update({
          attendance_code: newCode,
          attendance_code_issued_at: new Date().toISOString(),
          attendance_code_expires_at: expiresAt,
        }).eq("id", sessionId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true, code: newCode });
      }

      case "create_session": {
        const { error } = await supabase.from("sessions").insert({
          title: p.title,
          start_at: p.start_at,
          end_at: p.end_at || null,
          venue_name: p.venue_name || null,
          venue_map_url: p.venue_map_url || null,
          check_in_open_minutes: p.check_in_open_minutes ?? 0,
          attendance_deadline_minutes: p.attendance_deadline_minutes || 5,
          late_deadline_minutes: p.late_deadline_minutes || 30,
          notes: p.notes || null,
          status: p.status || "scheduled",
        });
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "update_session": {
        const sessionId = p.id as string;
        const { error } = await supabase.from("sessions").update({
          title: p.title,
          start_at: p.start_at,
          status: p.status,
          notes: p.notes || null,
          venue_name: p.venue_name || null,
          venue_map_url: p.venue_map_url || null,
          attendance_code: p.attendance_code,
          attendance_code_status: p.attendance_code_status,
          check_in_open_minutes: p.check_in_open_minutes,
          attendance_deadline_minutes: p.attendance_deadline_minutes,
          late_deadline_minutes: p.late_deadline_minutes,
        }).eq("id", sessionId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "delete_session": {
        const sessionId = p.sessionId as string;
        await supabase.from("attendance_records").delete().eq("session_id", sessionId);
        const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "add_member": {
        const { error } = await supabase.from("profiles").insert({
          role: "member",
          full_name: p.full_name,
          cohort_label: p.cohort_label,
          email: p.email || null,
          status: "active",
        });
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "update_member": {
        const { error } = await supabase.from("profiles").update({
          full_name: p.full_name,
          cohort_label: p.cohort_label,
          status: p.status,
          email: p.email || null,
        }).eq("id", p.id).eq("role", "member");
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "delete_member": {
        const { error } = await supabase.from("profiles").delete().eq("id", p.id).eq("role", "member");
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "add_staff": {
        const { error } = await supabase.from("profiles").insert({
          role: p.role,
          full_name: p.full_name,
          email: p.email || null,
          phone: p.phone || null,
          status: "active",
        });
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "update_staff": {
        const { error } = await supabase.from("profiles").update({
          role: p.role,
          full_name: p.full_name,
          status: p.status,
          email: p.email || null,
          phone: p.phone || null,
        }).eq("id", p.id).in("role", ["admin", "staff"]);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "delete_staff": {
        const { error } = await supabase.from("profiles").update({ status: "inactive" })
          .eq("id", p.id).in("role", ["admin", "staff"]);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "override_attendance": {
        const status = p.status as string;
        const { error } = await supabase.from("attendance_records").update({
          status,
          demerit_points: demeritPoints(status),
          override_reason: p.reason || null,
          override_by: p.override_by || null,
          override_at: new Date().toISOString(),
        }).eq("id", p.recordId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "add_manual_record": {
        const status = p.status as string;
        const { error } = await supabase.from("attendance_records").insert({
          session_id: p.sessionId,
          member_id: p.memberId,
          member_name: p.memberName,
          status,
          checked_in_at: new Date().toISOString(),
          check_in_method: "manual",
          code_verified: false,
          location_verified: false,
          demerit_points: demeritPoints(status),
        });
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "toggle_automation_rule": {
        const { error } = await supabase.from("email_automation_rules").update({
          enabled: p.enabled,
          updated_at: new Date().toISOString(),
        }).eq("id", p.ruleId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "sync_automation_rules": {
        await syncAutomationRules(supabase);
        return jsonResponse({ ok: true });
      }

      case "get_camp_settings": {
        const { data, error } = await supabase
          .from("camp_settings")
          .select("*")
          .order("start_date", { ascending: false });
        if (error) throw new Error(error.message);
        return jsonResponse({ settings: data || [] });
      }

      case "get_camp_responses": {
        const campId = p.campId as string | undefined;
        let query = supabase
          .from("camp_daily_responses")
          .select("id, camp_id, profile_id, response_date, attended, from_time, to_time, time_slots, duration_minutes, demerit_credit, submitted_at, profiles(full_name, email)")
          .order("response_date", { ascending: false });
        if (campId) query = query.eq("camp_id", campId);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return jsonResponse({ responses: data || [] });
      }

      case "toggle_camp_enabled": {
        const campId = p.campId as string;
        const enabled = Boolean(p.enabled);
        const { error } = await supabase
          .from("camp_settings")
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq("id", campId);
        if (error) throw new Error(error.message);
        return jsonResponse({ ok: true });
      }

      case "ensure_member_portal_token": {
        const profileId = p.profileId as string;
        if (!profileId) return jsonResponse({ error: "profileId required" }, 400);
        const { data: token, error } = await supabase.rpc("get_or_create_member_portal_token", {
          p_profile_id: profileId,
        });
        if (error) throw new Error(error.message);
        return jsonResponse({ token });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin action failed";
    return jsonResponse({ error: message }, 500);
  }
});
