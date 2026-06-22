import { HashRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { Shield } from "lucide-react";

import AdminGate from "@/components/AdminGate";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminMembers from "@/pages/AdminMembers";
import MemberDetail from "@/pages/MemberDetail";
import AdminSessions from "@/pages/AdminSessions";
import SessionEditor from "@/pages/SessionEditor";
import SessionDetail from "@/pages/SessionDetail";
import AdminReports from "@/pages/AdminReports";
import AdminEmail from "@/pages/AdminEmail";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";

const isAdminPortal = import.meta.env.VITE_PORTAL === 'admin';

function GlobalAdminFooter() {
  return (
    <footer className="border-t border-border/30 bg-background/75 px-5 py-5 text-center backdrop-blur">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-semibold text-muted-foreground/45">
        <a href="/about.html" className="transition-colors hover:text-muted-foreground">서비스 소개</a>
        <a href="/privacy.html" className="transition-colors hover:text-muted-foreground">개인정보처리방침</a>
        <a
          href="/#/admin"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Shield className="h-3 w-3" />
          관리자 페이지
        </a>
      </div>
    </footer>
  );
}

function MemberLegacyRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (!params.has('intent')) params.set('intent', 'absence');
  const search = params.toString();
  return <Navigate to={search ? `/?${search}` : '/'} replace />;
}

const App = () => (
  <TooltipProvider>
    <Sonner />
    <AppProvider>
      <div className="min-h-screen bg-grid bg-soft-gradient">
        <HashRouter>
          <Routes>
            <Route path="/" element={isAdminPortal ? <Navigate to="/admin" replace /> : <Index />} />
            <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>}>
              <Route index element={<AdminDashboard />} />
              <Route path="members" element={<AdminMembers />} />
              <Route path="members/:id" element={<MemberDetail />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="sessions/new" element={<SessionEditor />} />
              <Route path="sessions/:id/edit" element={<SessionEditor />} />
              <Route path="sessions/:id" element={<SessionDetail />} />
              <Route path="email" element={<AdminEmail />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>
            <Route path="/member/login" element={<Navigate to="/" replace />} />
            <Route path="/member" element={<MemberLegacyRedirect />} />
            <Route path="/member/*" element={<MemberLegacyRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
        {!isAdminPortal && <GlobalAdminFooter />}
      </div>
    </AppProvider>
  </TooltipProvider>
);

export default App;
