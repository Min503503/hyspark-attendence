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

function buildRawEmail(from: string, to: string, subject: string, body: string, html = false) {
  const senderName = Deno.env.get("GMAIL_SENDER_NAME") || "HySpark";
  const contentType = html
    ? 'Content-Type: text/html; charset="UTF-8"'
    : 'Content-Type: text/plain; charset="UTF-8"';
  const message = [
    `From: ${senderName} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    contentType,
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
  return base64UrlEncode(message);
}

export async function getGmailAccessToken() {
  const clientId = requireEnv("GMAIL_CLIENT_ID");
  const clientSecret = requireEnv("GMAIL_CLIENT_SECRET");
  const refreshToken = requireEnv("GMAIL_REFRESH_TOKEN");

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

export async function sendGmail(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  body: string,
  options?: { html?: boolean },
) {
  const html = options?.html ?? (body.trimStart().startsWith("<!DOCTYPE") || body.trimStart().startsWith("<html"));
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: buildRawEmail(from, to, subject, body, html) }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Failed to send to ${to}`);
  }
  return data as { id: string };
}
