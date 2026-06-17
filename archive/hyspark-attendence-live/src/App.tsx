import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
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
import AdminNetworking from "@/pages/AdminNetworking";
import MemberLayout from "@/components/MemberLayout";
import MemberHome from "@/pages/MemberHome";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import NetworkingResponse from "@/pages/NetworkingResponse";

const queryClient = new QueryClient();

function GlobalAdminFooter() {
  return (
    <footer className="border-t border-border/30 bg-background/75 px-5 py-5 text-center backdrop-blur">
      <a
        href="/#/admin"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold text-muted-foreground/45 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Shield className="h-3 w-3" />
        관리자 페이지
      </a>
    </footer>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <div className="min-h-screen bg-grid bg-soft-gradient">
          {window.location.pathname.startsWith("/networking") ? (
            <NetworkingResponse />
          ) : (
          <HashRouter>
            <Routes>
              {/* Admin */}
              <Route path="/" element={<Index />} />
              <Route path="/networking" element={<NetworkingResponse />} />
              <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>}>
                <Route index element={<AdminDashboard />} />
                <Route path="members" element={<AdminMembers />} />
                <Route path="members/:id" element={<MemberDetail />} />
                <Route path="sessions" element={<AdminSessions />} />
                <Route path="sessions/new" element={<SessionEditor />} />
                <Route path="sessions/:id/edit" element={<SessionEditor />} />
                <Route path="sessions/:id" element={<SessionDetail />} />
                <Route path="networking" element={<AdminNetworking />} />
                <Route path="reports" element={<AdminReports />} />
              </Route>
              {/* Member */}
              <Route path="/member/login" element={<Navigate to="/" replace />} />
              <Route path="/member" element={<MemberLayout />}>
                <Route index element={<MemberHome />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
          )}
          <GlobalAdminFooter />
        </div>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
