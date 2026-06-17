import { Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LogOut } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';

export default function MemberLayout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/member/login'); };

  return (
    <div className="min-h-screen bg-grid bg-soft-gradient flex flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <img src={hysparkLogo} alt="Spark Attendance" className="w-6 h-6 object-contain brightness-0 invert" />
          <span className="font-bold text-sm">Spark Attendance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary-foreground/70">{currentUser?.full_name}</span>
          <button onClick={handleLogout} className="p-1.5 rounded hover:bg-sidebar-accent transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
