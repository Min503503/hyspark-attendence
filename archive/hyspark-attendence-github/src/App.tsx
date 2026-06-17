import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";

import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminMembers from "@/pages/AdminMembers";
import MemberDetail from "@/pages/MemberDetail";
import AdminSessions from "@/pages/AdminSessions";
import SessionEditor from "@/pages/SessionEditor";
import SessionDetail from "@/pages/SessionDetail";
import AdminReports from "@/pages/AdminReports";
import MemberLogin from "@/pages/MemberLogin";
import MemberLayout from "@/components/MemberLayout";
import MemberHome from "@/pages/MemberHome";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Admin */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="members" element={<AdminMembers />} />
              <Route path="members/:id" element={<MemberDetail />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="sessions/new" element={<SessionEditor />} />
              <Route path="sessions/:id/edit" element={<SessionEditor />} />
              <Route path="sessions/:id" element={<SessionDetail />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>
            {/* Member */}
            <Route path="/member/login" element={<MemberLogin />} />
            <Route path="/member" element={<MemberLayout />}>
              <Route index element={<MemberHome />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
