import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import hysparkLogo from '@/assets/hyspark-logo.png';

export default function MemberLogin() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { loginAsMember } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
    const member = await loginAsMember(name.trim());
    if (member) navigate('/member');
    else setError('등록된 이름을 찾을 수 없습니다.');
  };

  return (
    <div className="min-h-screen bg-grid bg-soft-gradient flex items-center justify-center p-4">
      <div className="animate-reveal-up w-full max-w-sm">
        <div className="bg-card rounded-lg shadow-lg shadow-primary/5 p-8 border">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 mb-3">
              <img src={hysparkLogo} alt="Spark Attendance" className="w-8 h-8 object-contain" />
              <span className="font-extrabold text-lg text-foreground tracking-tight">Spark Attendance</span>
            </div>
            <p className="text-sm text-muted-foreground">학회원 본인 확인</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full bg-primary text-primary-foreground active:scale-[0.98] transition-transform">
              확인
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
