import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./gmail.ts";

export const ADMIN_TOKEN_HEADER = "x-admin-token";
export const CRON_SECRET_HEADER = "x-cron-secret";

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function allowedAdminPasswordHashes(): string[] {
  const raw = Deno.env.get("ADMIN_PASSWORD_HASHES") || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function createAdminSession(supabase: SupabaseClient, hours = 12) {
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("admin_sessions")
    .insert({ expires_at: expiresAt })
    .select("token, expires_at")
    .single();

  if (error || !data) throw new Error(error?.message || "admin session create failed");
  return data as { token: string; expires_at: string };
}

export async function verifyAdminToken(
  supabase: SupabaseClient,
  token: string | null | undefined,
): Promise<boolean> {
  if (!token) return false;
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return !error && !!data;
}

export function verifyCronSecret(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return false;
  return req.headers.get(CRON_SECRET_HEADER) === expected;
}

export async function requireAdminOrCron(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response | null> {
  if (verifyCronSecret(req)) return null;

  const token = req.headers.get(ADMIN_TOKEN_HEADER);
  if (await verifyAdminToken(supabase, token)) return null;

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireAdmin(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response | null> {
  const token = req.headers.get(ADMIN_TOKEN_HEADER);
  if (await verifyAdminToken(supabase, token)) return null;

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function demeritPoints(status: string): number {
  if (status === "late") return 0.5;
  if (status === "absent" || status === "unexcused_absent") return 1;
  return 0;
}

export function generateAttendanceCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}
