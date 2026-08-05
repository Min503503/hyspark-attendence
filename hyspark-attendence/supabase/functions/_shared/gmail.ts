export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-cron-secret",
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

// ─── Error types ──────────────────────────────────────────────────────────────

/** Thrown when Gmail returns a rate-limit or quota error (retriable). */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// ─── Binary / Base64 helpers ─────────────────────────────────────────────────

function toBinaryString(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function base64UrlEncode(value: string): string {
  return btoa(toBinaryString(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${btoa(toBinaryString(value))}?=`;
}

// ─── Message-ID / Date helpers ────────────────────────────────────────────────

function generateMessageId(from: string): string {
  const domain = from.includes("@") ? from.split("@")[1] : "mail.local";
  const rand = crypto.randomUUID().replace(/-/g, "");
  const ts = Date.now().toString(36);
  return `<${ts}.${rand}@${domain}>`;
}

function rfc5322Date(): string {
  return new Date().toUTCString(); // e.g. "Mon, 23 Jun 2026 10:00:00 GMT"
}

// ─── HMAC unsubscribe token ───────────────────────────────────────────────────

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a versioned, non-expiring HMAC unsubscribe token.
 * Token: "v1|{profileId}|{emailHash}|{hmac}"
 * emailHash = SHA-256(lowercased email) — invalidates token when email changes.
 */
export async function generateUnsubscribeToken(
  profileId: string,
  email: string,
  secret: string,
): Promise<string> {
  const emailHash = await sha256Hex(email.toLowerCase());
  const payload = `v1|${profileId}|${emailHash}`;
  const hmac = await hmacSha256(secret, payload);
  return `${payload}|${hmac}`;
}

/**
 * Verify an unsubscribe token.
 * Returns { profileId, emailHash } if valid, or null if tampered/malformed.
 */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<{ profileId: string; emailHash: string } | null> {
  const parts = token.split("|");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, profileId, emailHash, hmac] = parts;
  const payload = `v1|${profileId}|${emailHash}`;
  const expected = await hmacSha256(secret, payload);
  if (expected !== hmac) return null;
  return { profileId, emailHash };
}

// ─── Raw email builder ────────────────────────────────────────────────────────

function buildRawEmail(
  from: string,
  to: string,
  subject: string,
  body: string,
  html = false,
  messageId?: string,
  unsubscribeUrl?: string,
) {
  const senderName = Deno.env.get("GMAIL_SENDER_NAME") || "HySpark";
  const contentType = html
    ? 'Content-Type: text/html; charset="UTF-8"'
    : 'Content-Type: text/plain; charset="UTF-8"';

  const headers: string[] = [
    `Date: ${rfc5322Date()}`,
    `Message-ID: ${messageId || generateMessageId(from)}`,
    `From: ${senderName} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    contentType,
    "Content-Transfer-Encoding: 8bit",
  ];

  if (unsubscribeUrl) {
    headers.push(`List-Unsubscribe: <${unsubscribeUrl}>`);
    headers.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }

  return base64UrlEncode([...headers, "", body].join("\r\n"));
}

// ─── Rate-limit detection ─────────────────────────────────────────────────────

function isRetryable(status: number, reason: string, message: string): boolean {
  if (status === 429) return true;
  if (status >= 500) return true;
  // Gmail quota errors via 403
  if (
    status === 403 &&
    (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded")
  ) return true;
  // Enhanced status code 4.7.28 appears in error messages for daily sending limits
  if (message.includes("4.7.28")) return true;
  return false;
}

// ─── Gmail OAuth ──────────────────────────────────────────────────────────────

export async function getGmailAccessToken(scope?: "send" | "readonly"): Promise<string> {
  const clientId = requireEnv("GMAIL_CLIENT_ID");
  const clientSecret = requireEnv("GMAIL_CLIENT_SECRET");
  // bounce-sync uses a separate refresh token with gmail.readonly scope
  const refreshToken =
    scope === "readonly"
      ? requireEnv("GMAIL_READONLY_REFRESH_TOKEN")
      : requireEnv("GMAIL_REFRESH_TOKEN");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to refresh Gmail token");
  }
  return data.access_token as string;
}

// ─── Send with retry ──────────────────────────────────────────────────────────

export async function sendGmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  body: string,
  options?: { html?: boolean; unsubscribeUrl?: string },
): Promise<{ id: string }> {
  const html = options?.html ?? (body.trimStart().startsWith("<!DOCTYPE") || body.trimStart().startsWith("<html"));
  const messageId = generateMessageId(from);
  const raw = buildRawEmail(from, to, subject, body, html, messageId, options?.unsubscribeUrl);

  const MAX_ATTEMPTS = 3;
  let lastErr: Error = new Error("send failed");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    const data = await response.json();

    if (response.ok) return data as { id: string };

    const reason = data.error?.errors?.[0]?.reason ?? "";
    const message = data.error?.message ?? `Failed to send to ${to}`;

    if (isRetryable(response.status, reason, message)) {
      lastErr = new RateLimitError(message);
      continue;
    }

    // Non-retriable (auth errors, bad request, etc.)
    throw new Error(message);
  }

  throw lastErr;
}
