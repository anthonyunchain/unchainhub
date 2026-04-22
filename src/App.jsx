import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useAppBadge } from '@/lib/useAppBadge';
import { ConfirmProvider } from '@/lib/confirm';
import LoginPage from './pages/LoginPage';
import { useEffect, useState, Component, lazy, Suspense } from 'react';
import { supabase } from '@/api/base44Client';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="fixed inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
          <p className="text-h2">Something went wrong</p>
          <pre className="text-xs max-w-md overflow-auto rounded p-3" style={{ background: 'var(--urgent-bg)', color: 'var(--urgent-text)' }}>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} className="text-sm underline" style={{ color: 'var(--brand)' }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import AdminRoute from './components/layout/AdminRoute.jsx';

// Lazy-load all pages so each route gets its own JS chunk
const Dashboard           = lazy(() => import('./pages/Dashboard'));
const Pipeline            = lazy(() => import('./pages/Pipeline'));
const Clients             = lazy(() => import('./pages/Clients'));
const ClientDetail        = lazy(() => import('./pages/ClientDetail'));
const Services            = lazy(() => import('./pages/Services.jsx'));
const Outreach            = lazy(() => import('./pages/Outreach'));
const Contracts           = lazy(() => import('./pages/Contracts'));
const Invoices            = lazy(() => import('./pages/Invoices'));
const Freelancers         = lazy(() => import('./pages/Freelancers'));
const Finance             = lazy(() => import('./pages/Finance'));
const Editorial           = lazy(() => import('./pages/Editorial'));
const Reports             = lazy(() => import('./pages/Reports'));
const VideoEditing        = lazy(() => import('./pages/VideoEditing'));
const Shootings           = lazy(() => import('./pages/Shootings'));
const ShootingsToOrganize = lazy(() => import('./pages/ShootingsToOrganize'));
const Tasks               = lazy(() => import('./pages/Tasks'));
const Admin               = lazy(() => import('./pages/Admin'));
const ContentDescriptions = lazy(() => import('./pages/ContentDescriptions'));
const FreelancerPortal    = lazy(() => import('./pages/FreelancerPortal'));
const FreelancerAdmin     = lazy(() => import('./pages/FreelancerAdmin'));
const ClientPortal        = lazy(() => import('./pages/ClientPortal'));
const StaffPortal         = lazy(() => import('./pages/StaffPortal'));
const Ideas               = lazy(() => import('./pages/Ideas'));
const Notes               = lazy(() => import('./pages/Notes'));
const FreelancerShop      = lazy(() => import('./pages/FreelancerShop'));
const PlanningCalendar    = lazy(() => import('./pages/PlanningCalendar'));

// Role cache is keyed per user ID so switching accounts always gets the right role
const getRoleCacheKey = (uid) => `uc_role_v3_${uid}`;

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center" role="status" aria-live="polite" aria-label="Loading">
    <div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: 'var(--divider)', borderTopColor: 'var(--ink)' }} />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, isPasswordRecovery, user } = useAuth();
  useAppBadge(isAuthenticated ? user?.id : null);

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
            : profile?.role === 'staff' ? 'staff'
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
    <div role="alert" className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <p className="text-h2">Unable to load your account</p>
      <p className="text-body-sm">Could not determine your access level. Please check your connection and try again.</p>
      <button onClick={() => window.location.reload()} className="text-sm underline" style={{ color: 'var(--brand)' }}>Retry</button>
      <button onClick={() => supabase.auth.signOut()} className="text-xs underline" style={{ color: 'var(--subtle)' }}>Sign out</button>
    </div>
  );

  if (role === 'freelancer') {
    return (
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<FreelancerPortal />} />
          <Route path="/FreelancerPortal" element={<FreelancerPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (role === 'client') {
    return (
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<ClientPortal />} />
          <Route path="/ClientPortal" element={<ClientPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (role === 'staff') {
    return (
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<StaffPortal />} />
          <Route path="/StaffPortal" element={<StaffPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Admin
  return (
    <Suspense fallback={<Spinner />}>
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
          <Route path="FreelancerShop" element={<AdminRoute><FreelancerShop /></AdminRoute>} />
          <Route path="Planning" element={<AdminRoute><PlanningCalendar /></AdminRoute>} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <ConfirmProvider>
            <Router>
              <AuthenticatedApp />
            </Router>
            <Toaster />
            <Sonner richColors position="top-right" closeButton />
          </ConfirmProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
