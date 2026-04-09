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
import Tasks from './pages/Tasks';
import Admin from './pages/Admin';
import ContentDescriptions from './pages/ContentDescriptions';
import FreelancerPortal from './pages/FreelancerPortal';
import FreelancerAdmin from './pages/FreelancerAdmin';
import ClientPortal from './pages/ClientPortal';

const ROLE_CACHE_KEY = 'uc_role_v2'; // v2: now stores 'admin' | 'freelancer' | 'client'

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, isPasswordRecovery } = useAuth();

  if (isPasswordRecovery) return <ResetPasswordPage />;

  const cached = localStorage.getItem(ROLE_CACHE_KEY);
  const [role, setRole] = useState(cached || null); // 'admin' | 'freelancer' | 'client' | null
  const [roleChecked, setRoleChecked] = useState(cached !== null);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('no user');

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          const detectedRole = profile?.role === 'client' ? 'client'
            : profile?.role === 'freelancer' ? 'freelancer'
            : profile?.role === 'admin' ? 'admin'
            : null;

          // If profile role is not set or ambiguous, fall back to freelancer check
          if (!detectedRole || detectedRole === 'admin') {
            try {
              const { data, error } = await supabase.functions.invoke('getFreelancerData');
              const isFreelancer = !error && !data?.error && data?.profile;
              const finalRole = isFreelancer ? 'freelancer' : 'admin';
              setRole(finalRole);
              localStorage.setItem(ROLE_CACHE_KEY, finalRole);
            } catch {
              setRole('admin');
              localStorage.setItem(ROLE_CACHE_KEY, 'admin');
            }
          } else {
            setRole(detectedRole);
            localStorage.setItem(ROLE_CACHE_KEY, detectedRole);
          }
        } catch {
          setRole('admin');
          localStorage.setItem(ROLE_CACHE_KEY, 'admin');
        }
        setRoleChecked(true);
      })();
    }
    if (!isLoadingAuth && !isAuthenticated) {
      localStorage.removeItem(ROLE_CACHE_KEY);
      setRole(null);
      setRoleChecked(false);
    }
  }, [isLoadingAuth, isAuthenticated]);

  if (isLoadingAuth) return <Spinner />;
  if (!isAuthenticated) return <LoginPage />;
  if (!roleChecked) return <Spinner />;

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
        <Route path="Tasks" element={<AdminRoute><Tasks /></AdminRoute>} />
        <Route path="Admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="ContentDescriptions" element={<AdminRoute><ContentDescriptions /></AdminRoute>} />
        <Route path="FreelancerAdmin" element={<AdminRoute><FreelancerAdmin /></AdminRoute>} />
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
