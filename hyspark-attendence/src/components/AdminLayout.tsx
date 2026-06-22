import { useState } from 'react';
import { Link, Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LayoutDashboard, Users, CalendarDays, LogOut, BarChart3, Mail, Menu } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';
import { lockAdminSession } from '@/components/AdminGate';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: '대시보드', end: true },
  { to: '/admin/members', icon: Users, label: '멤버' },
  { to: '/admin/sessions', icon: CalendarDays, label: '세션' },
  { to: '/admin/email', icon: Mail, label: '메일' },
  { to: '/admin/reports', icon: BarChart3, label: '리포트' },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `app-focus-ring flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-bold transition-all ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            }`
          }
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export default function AdminLayout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage = navItems.find(item =>
    item.end ? location.pathname === '/admin' || location.pathname === '/admin/' : location.pathname.startsWith(item.to),
  );

  const handleLogout = () => {
    lockAdminSession();
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F2F4F6] lg:flex">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border/60 bg-background lg:flex">
        <div className="px-5 py-6">
          <Link to="/admin" className="app-focus-ring flex items-center gap-3 rounded-xl">
            <img src="/hyspark-email-logo.png" alt="" className="h-9 w-auto max-w-[72px] object-contain" />
            <div>
              <span className="block text-sm font-extrabold tracking-tight text-foreground">{APP_NAME}</span>
              <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">운영 콘솔</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <NavItems />
        </nav>

        <div className="border-t border-border/60 p-4">
          <div className="rounded-2xl bg-secondary/50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{currentUser?.full_name}</p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">관리자 세션</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="app-focus-ring shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold tracking-tight">{currentPage?.label || '운영 콘솔'}</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">{APP_NAME}</p>
            </div>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 rounded-xl" aria-label="메뉴 열기">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[min(100vw-2rem,320px)] flex-col p-0">
                <SheetHeader className="border-b border-border/60 px-5 py-5 text-left">
                  <SheetTitle className="flex items-center gap-3">
                    <img src="/hyspark-email-logo.png" alt="" className="h-8 w-auto max-w-[64px] object-contain" />
                    <span>{APP_NAME}</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                  <NavItems onNavigate={() => setMenuOpen(false)} />
                </nav>
                <div className="border-t border-border/60 p-4">
                  <div className="mb-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                    <p className="text-sm font-bold">{currentUser?.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">관리자 세션</p>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-clean">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
