import { FormEvent, ReactNode, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/app-ui';

const ADMIN_UNLOCK_KEY = 'hyspark_admin_unlocked';
const ADMIN_PASSWORD_HASH = '272ebc9b5ddb812dd5a628cc778f2c0aa60a91bcb18118ea95b75a8a97d0296b';
const ADMIN_QWERTY_PASSWORD_HASH = '18c62270ecada90d3b7c078dfb3cea3ec950d02f767a5ef835cf6928135a648c';

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function lockAdminSession() {
  sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(ADMIN_UNLOCK_KEY) === ADMIN_PASSWORD_HASH,
  );
  const { loginAsAdmin } = useApp();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const hashedPassword = await sha256(password);
    if ([ADMIN_PASSWORD_HASH, ADMIN_QWERTY_PASSWORD_HASH].includes(hashedPassword)) {
      sessionStorage.setItem(ADMIN_UNLOCK_KEY, ADMIN_PASSWORD_HASH);
      await loginAsAdmin('admin@hyspark.local', '');
      setUnlocked(true);
    } else {
      setError('비밀번호가 일치하지 않습니다.');
    }
    setSubmitting(false);
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2F4F6] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={hysparkLogo} alt="HySpark" className="mx-auto h-10 w-auto max-w-[120px] object-contain" />
          <p className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">운영 콘솔</p>
          <p className="mt-2 text-sm text-muted-foreground">관리자 비밀번호를 입력해 주세요.</p>
        </div>

        <Panel>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">관리자 확인</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">세션은 브라우저를 닫으면 만료됩니다.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">비밀번호</Label>
              <Input
                id="admin-password"
                type="text"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="한글로 치시오"
                autoComplete="off"
                className="h-12 rounded-xl bg-secondary/40 text-base"
              />
              <p className="text-[11px] font-medium text-muted-foreground">
                입력한 글자가 그대로 보입니다. 한글 입력이 안 되면 영문 입력 상태도 사용할 수 있습니다.
              </p>
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={!password || submitting}
              className="h-12 w-full rounded-xl text-base font-bold"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : '관리자 페이지 열기'}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
