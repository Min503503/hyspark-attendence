import { Link, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LayoutDashboard, Users, CalendarDays, LogOut, BarChart3, MessageCircle } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';
import { lockAdminSession } from '@/components/AdminGate';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: '대시보드', end: true },
  { to: '/admin/members', icon: Users, label: '멤버' },
  { to: '/admin/sessions', icon: CalendarDays, label: '세션' },
  { to: '/admin/networking', icon: MessageCircle, label: '네트워킹' },
  { to: '/admin/reports', icon: BarChart3, label: '리포트' },
];

export default function AdminLayout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    lockAdminSession();
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-grid bg-soft-gradient">
      <aside className="hidden w-72 flex-col border-r border-sidebar-border bg-primary text-primary-foreground lg:flex relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(126deg,transparent_0_58%,hsl(var(--accent)/0.10)_58.2%_58.8%,transparent_59%_100%),linear-gradient(126deg,transparent_0_73%,hsl(var(--primary-foreground)/0.08)_73.2%_73.7%,transparent_74%_100%)]" />
        <div className="relative p-5">
          <Link to="/" className="app-focus-ring flex items-center gap-3 rounded-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10">
              <img src={hysparkLogo} alt="하이스파크 pre" className="h-7 w-7 object-contain brightness-0 invert" />
            </span>
            <div>
              <span className="block text-sm font-extrabold tracking-tight">하이스파크 pre</span>
              <span className="mt-1 block text-[11px] font-medium text-primary-foreground/50">운영 콘솔</span>
            </div>
          </Link>
        </div>
        <nav className="relative flex-1 space-y-1 px-3">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `app-focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  isActive
                    ? 'bg-primary-foreground text-primary'
                    : 'text-primary-foreground/65 hover:bg-primary-foreground/10 hover:text-primary-foreground'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="relative p-4">
          <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-3">
            <div className="flex items-center justify-between">
            <div className="text-xs">
              <p className="font-bold">{currentUser?.full_name}</p>
              <p className="mt-0.5 text-primary-foreground/50">관리자 세션</p>
            </div>
            <button onClick={handleLogout} className="app-focus-ring rounded-lg p-2 text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="로그아웃">
              <LogOut className="w-4 h-4" />
            </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/" className="app-focus-ring flex items-center gap-2 rounded-md">
            <img src={hysparkLogo} alt="하이스파크 pre" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-sm">하이스파크 pre</span>
          </Link>
          <div className="flex gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `app-focus-ring rounded-lg p-2 ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`
                }
                aria-label={item.label}
              >
                <item.icon className="w-4 h-4" />
              </NavLink>
            ))}
            <button onClick={handleLogout} className="app-focus-ring rounded-lg p-2 text-muted-foreground" aria-label="로그아웃">
              <LogOut className="w-4 h-4" />
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
