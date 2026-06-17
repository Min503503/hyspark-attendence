import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LogOut } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';
import { getMemberInitial } from '@/lib/member-utils';

export default function MemberLayout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="member-portal min-h-screen bg-grid bg-soft-gradient flex flex-col">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/90 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <Link to="/" className="app-focus-ring flex items-center gap-2.5 rounded-lg">
            <img src={hysparkLogo} alt={APP_NAME} className="h-8 w-8 object-contain" />
            <div>
              <span className="block text-sm font-extrabold leading-none tracking-tight">{APP_NAME}</span>
              <span className="mt-1 block text-[10px] font-medium text-muted-foreground">{APP_TAGLINE}</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {currentUser && (
              <div className="member-avatar-sm flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold text-primary-foreground max-[360px]:hidden">
                {getMemberInitial(currentUser.full_name)}
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="app-focus-ring rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-clean pb-24">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
