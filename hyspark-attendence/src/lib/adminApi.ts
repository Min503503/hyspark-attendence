import { supabase } from '@/integrations/supabase/client';

export const ADMIN_TOKEN_KEY = 'hyspark_admin_token';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function adminInvokeHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { 'x-admin-token': token } : {};
}

type AdminAction =
  | 'open_check_in'
  | 'close_check_in'
  | 'regenerate_code'
  | 'create_session'
  | 'update_session'
  | 'delete_session'
  | 'add_member'
  | 'update_member'
  | 'delete_member'
  | 'add_staff'
  | 'update_staff'
  | 'delete_staff'
  | 'override_attendance'
  | 'add_manual_record'
  | 'toggle_automation_rule'
  | 'sync_automation_rules'
  | 'get_camp_responses'
  | 'get_camp_settings'
  | 'toggle_camp_enabled'
  | 'ensure_member_portal_token';

function normalizeEdgeInvokeError(error: Error): Error {
  const message = error.message || '';
  if (message.includes('Failed to send a request to the Edge Function')) {
    return new Error('Edge Function에 연결하지 못했습니다. 관리자 재로그인 후 다시 시도해 주세요.');
  }
  if (message.includes('non-2xx') || message === 'Unauthorized') {
    return new Error('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.');
  }
  return error;
}

export async function adminApi<T = Record<string, unknown>>(
  action: AdminAction,
  payload: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  if (!getAdminToken()) {
    return { data: null, error: new Error('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.') };
  }

  const { data, error } = await supabase.functions.invoke('admin-api', {
    headers: adminInvokeHeaders(),
    body: { action, payload },
  });

  if (error) return { data: null, error: normalizeEdgeInvokeError(error) };
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { data: null, error: new Error(String(data.error)) };
  }
  return { data: data as T, error: null };
}

export async function adminAuth(password: string): Promise<{ token?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-auth', {
    body: { password },
  });

  if (error) {
    const ctx = error as Error & { context?: Response };
    if (ctx.context) {
      try {
        const body = await ctx.context.json();
        if (body?.error) return { error: String(body.error) };
      } catch {
        // ignore parse failure
      }
    }
    return { error: error.message };
  }

  if (data?.error) return { error: String(data.error) };
  if (data?.token) {
    setAdminToken(data.token);
    return { token: data.token };
  }
  return { error: '인증 토큰을 받지 못했습니다.' };
}

export async function invokeWithAdminToken<T>(
  fn: string,
  options?: { body?: Record<string, unknown> },
) {
  if (!getAdminToken()) {
    return {
      data: null,
      error: new Error('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.'),
    };
  }

  const result = await supabase.functions.invoke<T>(fn, {
    ...options,
    headers: adminInvokeHeaders(),
  });

  if (result.error) {
    return { ...result, error: normalizeEdgeInvokeError(result.error) };
  }
  return result;
}
