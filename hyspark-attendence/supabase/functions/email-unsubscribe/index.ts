/**
 * email-unsubscribe — handles one-click unsubscribe (RFC 8058) and GET confirmation.
 *
 * GET  ?token=XXX  → 202 HTML confirmation page (user clicked link in email)
 * POST ?token=XXX  → 200 JSON  (Gmail one-click: body = "List-Unsubscribe=One-Click")
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireEnv, verifyUnsubscribeToken } from "../_shared/gmail.ts";

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function htmlPage(title: string, message: string) {
  return new Response(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f4;}
.card{background:#fff;border-radius:8px;padding:40px;max-width:420px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);}
h1{font-size:20px;margin:0 0 12px;}p{color:#555;font-size:15px;margin:0;line-height:1.6;}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Bad Request", { status: 400 });
  }

  const secret = Deno.env.get("UNSUBSCRIBE_SECRET");
  if (!secret) {
    return new Response("Service unavailable", { status: 503 });
  }

  const parsed = await verifyUnsubscribeToken(token, secret);
  if (!parsed) {
    if (req.method === "GET") {
      return htmlPage("유효하지 않은 링크", "수신 거부 링크가 유효하지 않거나 만료됐습니다.");
    }
    return new Response(JSON.stringify({ error: "invalid token" }), { status: 400 });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  // Look up profile and verify email hash still matches (invalidates token if email changed)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, mail_delivery_status")
    .eq("id", parsed.profileId)
    .maybeSingle();

  if (!profile?.email) {
    if (req.method === "GET") {
      return htmlPage("처리 실패", "계정을 찾을 수 없습니다.");
    }
    return new Response(JSON.stringify({ error: "profile not found" }), { status: 404 });
  }

  const currentHash = await sha256Hex(profile.email.toLowerCase());
  if (currentHash !== parsed.emailHash) {
    if (req.method === "GET") {
      return htmlPage("유효하지 않은 링크", "이메일 주소가 변경됐습니다. 수신 거부 링크가 더 이상 유효하지 않습니다.");
    }
    return new Response(JSON.stringify({ error: "email changed" }), { status: 400 });
  }

  // Idempotent: already unsubscribed
  if (profile.mail_delivery_status === "unsubscribed") {
    if (req.method === "GET") {
      return htmlPage("수신 거부 완료", "이미 수신 거부 처리됐습니다. 더 이상 일반 메일을 받지 않습니다.");
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ mail_delivery_status: "unsubscribed" })
    .eq("id", parsed.profileId);

  if (updateError) {
    if (req.method === "GET") {
      return htmlPage("처리 실패", "수신 거부 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  if (req.method === "GET") {
    return htmlPage("수신 거부 완료", "수신 거부가 완료됐습니다. 앞으로 일반 메일을 받지 않습니다.<br/>출석 확인 등 필수 안내는 계속 발송될 수 있습니다.");
  }

  // POST (one-click RFC 8058) — return 200 with no body
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
