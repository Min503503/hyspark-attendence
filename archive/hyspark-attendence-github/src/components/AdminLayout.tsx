import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LayoutDashboard, Users, CalendarDays, LogOut } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: '대시보드', end: true },
  { to: '/admin/members', icon: Users, label: '멤버' },
  { to: '/admin/sessions', icon: CalendarDays, label: '세션' },
];

export default function AdminLayout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen flex bg-grid bg-soft-gradient">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-primary text-primary-foreground border-r border-sidebar-border">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <img src={hysparkLogo} alt="Spark Attendance" className="w-7 h-7 object-contain brightness-0 invert" />
            <span className="font-bold text-sm">Spark Attendance</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-accent'
                    : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-sidebar-accent/50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <p className="font-medium">{currentUser?.full_name}</p>
              <p className="text-primary-foreground/50">관리자</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground border-b">
          <div className="flex items-center gap-2">
            <img src={hysparkLogo} alt="Spark Attendance" className="w-6 h-6 object-contain brightness-0 invert" />
            <span className="font-bold text-sm">Spark Attendance</span>
          </div>
          <div className="flex gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `p-2 rounded-md ${isActive ? 'bg-sidebar-accent text-accent' : 'text-primary-foreground/60'}`
                }
              >
                <item.icon className="w-4 h-4" />
              </NavLink>
            ))}
            <button onClick={handleLogout} className="p-2 rounded-md text-primary-foreground/60">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
