import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from './pages/LoginPage';
import { useEffect, useState, Component } from 'react';
import { supabase } from '@/api/base44Client';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 gap-3 p-6 text-center">
          <p className="text-slate-700 font-medium">Something went wrong</p>
          <pre className="text-xs text-red-500 max-w-md overflow-auto bg-red-50 rounded p-3">{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} className="text-sm text-blue-600 underline">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import AdminRoute from './components/layout/AdminRoute.jsx';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Services from './pages/Services.jsx';
import Outreach from './pages/Outreach';
import Contracts from './pages/Contracts';
import Invoices from './pages/Invoices';
import Freelancers from './pages/Freelancers';
import Finance from './pages/Finance';
import Editorial from './pages/Editorial';
import Reports from './pages/Reports';
import VideoEditing from './pages/VideoEditing';
import Shootings from './pages/Shootings';
import ShootingsToOrganize from './pages/ShootingsToOrganize';
import Tasks from './pages/Tasks';
import Admin from './pages/Admin';
import ContentDescriptions from './pages/ContentDescriptions';
import FreelancerPortal from './pages/FreelancerPortal';
import FreelancerAdmin from './pages/FreelancerAdmin';
import ClientPortal from './pages/ClientPortal';
import Ideas from './pages/Ideas';
import Notes from './pages/Notes';

// Role cache is keyed per user ID so switching accounts always gets the right role
const getRoleCacheKey = (uid) => `uc_role_v3_${uid}`;

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, isPasswordRecovery } = useAuth();

  if (isPasswordRecovery) return <ResetPasswordPage />;

  const [role, setRole] = useState(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { await supabase.auth.signOut(); return; }

          // Check per-user cache (keyed by UID so switching accounts is safe)
          const cacheKey = getRoleCacheKey(user.id);
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            setRole(cached);
            setRoleChecked(true);
            return;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          const detectedRole = profile?.role === 'client' ? 'client'
            : profile?.role === 'freelancer' ? 'freelancer'
            : profile?.role === 'admin' ? 'admin'
            : null;

          if (detectedRole) {
            // Profile role is explicitly set — trust it directly
            setRole(detectedRole);
            localStorage.setItem(cacheKey, detectedRole);
          } else {
            // No role set in profile — check if this user is a freelancer
            try {
              const { data, error } = await supabase.functions.invoke('getFreelancerData');
              if (!error && !data?.error && data?.profile) {
                setRole('freelancer');
                localStorage.setItem(cacheKey, 'freelancer');
              } else {
                // Not a freelancer and no explicit role — fail safe, do NOT escalate to admin
                console.error('[App] No role found for user, signing out for safety');
                setRoleError(true);
                await supabase.auth.signOut();
              }
            } catch {
              // Network / function error — fail safe (never escalate to admin on error)
              setRoleError(true);
            }
          }
        } catch (err) {
          // Outer error (getUser failed, DB unreachable) — fail safe
          console.error('[App] Role detection failed:', err?.message);
          setRoleError(true);
        }
        setRoleChecked(true);
      })();
    }
    if (!isLoadingAuth && !isAuthenticated) {
      // Clear all role caches on logout
      Object.keys(localStorage).filter(k => k.startsWith('uc_role_')).forEach(k => localStorage.removeItem(k));
      setRole(null);
      setRoleChecked(false);
      setRoleError(false);
    }
  }, [isLoadingAuth, isAuthenticated]);

  if (isLoadingAuth) return <Spinner />;
  if (!isAuthenticated) return <LoginPage />;
  if (!roleChecked) return <Spinner />;
  if (roleError) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 gap-4 p-6 text-center">
      <p className="text-slate-700 font-semibold">Unable to load your account</p>
      <p className="text-sm text-slate-500">Could not determine your access level. Please check your connection and try again.</p>
      <button onClick={() => window.location.reload()} className="text-sm text-blue-600 underline">Retry</button>
      <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-400 underline">Sign out</button>
    </div>
  );

  if (role === 'freelancer') {
    return (
      <Routes>
        <Route path="/" element={<FreelancerPortal />} />
        <Route path="/FreelancerPortal" element={<FreelancerPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (role === 'client') {
    return (
      <Routes>
        <Route path="/" element={<ClientPortal />} />
        <Route path="/ClientPortal" element={<ClientPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Admin
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="Dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="Pipeline" element={<AdminRoute><Pipeline /></AdminRoute>} />
        <Route path="Clients" element={<AdminRoute><Clients /></AdminRoute>} />
        <Route path="ClientDetail" element={<AdminRoute><ClientDetail /></AdminRoute>} />
        <Route path="Services" element={<AdminRoute><Services /></AdminRoute>} />
        <Route path="Outreach" element={<AdminRoute><Outreach /></AdminRoute>} />
        <Route path="Contracts" element={<AdminRoute><Contracts /></AdminRoute>} />
        <Route path="Invoices" element={<AdminRoute><Invoices /></AdminRoute>} />
        <Route path="Freelancers" element={<AdminRoute><Freelancers /></AdminRoute>} />
        <Route path="Finance" element={<AdminRoute><Finance /></AdminRoute>} />
        <Route path="Editorial" element={<AdminRoute><Editorial /></AdminRoute>} />
        <Route path="Reports" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="VideoEditing" element={<AdminRoute><VideoEditing /></AdminRoute>} />
        <Route path="Shootings" element={<AdminRoute><Shootings /></AdminRoute>} />
        <Route path="ShootingsToOrganize" element={<AdminRoute><ShootingsToOrganize /></AdminRoute>} />
        <Route path="Tasks" element={<AdminRoute><Tasks /></AdminRoute>} />
        <Route path="Admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="ContentDescriptions" element={<AdminRoute><ContentDescriptions /></AdminRoute>} />
        <Route path="FreelancerAdmin" element={<AdminRoute><FreelancerAdmin /></AdminRoute>} />
        <Route path="Ideas" element={<AdminRoute><Ideas /></AdminRoute>} />
        <Route path="Notes" element={<AdminRoute><Notes /></AdminRoute>} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
