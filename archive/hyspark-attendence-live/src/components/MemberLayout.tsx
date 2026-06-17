import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LogOut } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';

export default function MemberLayout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen bg-grid bg-soft-gradient flex flex-col">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/90 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <Link to="/" className="app-focus-ring flex items-center gap-2 rounded-md">
            <img src={hysparkLogo} alt="하이스파크 pre" className="w-7 h-7 object-contain" />
            <div>
              <span className="block text-sm font-extrabold leading-none tracking-tight">하이스파크 pre</span>
              <span className="mt-1 block text-[10px] font-medium text-muted-foreground">HySpark 5th · 2026 Spring</span>
            </div>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground max-[360px]:hidden">{currentUser?.full_name}</span>
          <button onClick={handleLogout} className="app-focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="로그아웃">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

        <main className="flex-1 overflow-auto scrollbar-clean">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
