import { corsHeaders, jsonResponse } from "../_shared/gmail.ts";
import {
  adminClient,
  allowedAdminPasswordHashes,
  createAdminSession,
  sha256Hex,
} from "../_shared/admin-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) return jsonResponse({ error: "비밀번호가 필요합니다." }, 400);

    const hash = await sha256Hex(password);
    const allowed = allowedAdminPasswordHashes();
    if (allowed.length === 0) {
      return jsonResponse({ error: "ADMIN_PASSWORD_HASHES not configured" }, 500);
    }
    if (!allowed.includes(hash)) {
      return jsonResponse({ error: "비밀번호가 일치하지 않습니다." }, 401);
    }

    const supabase = adminClient();
    const session = await createAdminSession(supabase);

    // prune expired sessions
    await supabase.from("admin_sessions").delete().lt("expires_at", new Date().toISOString());

    return jsonResponse({
      token: session.token,
      expiresAt: session.expires_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "인증 실패";
    return jsonResponse({ error: message }, 500);
  }
});
