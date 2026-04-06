import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from './pages/LoginPage';
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from './components/layout/AppLayout.jsx';
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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const [roleChecked, setRoleChecked] = useState(false);
  const [isFreelancer, setIsFreelancer] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      base44.auth.me().then(async (u) => {
        if (u?.role === 'admin') {
          setIsFreelancer(false);
          setRoleChecked(true);
          return;
        }
        try {
          const res = await base44.functions.invoke('checkFreelancer', {});
          setIsFreelancer(res.data?.isFreelancer === true);
        } catch {
          setIsFreelancer(false);
        }
        setRoleChecked(true);
      }).catch(() => setRoleChecked(true));
    }
  }, [isLoadingAuth, isAuthenticated]);

  // Chargement auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Pas connecté → page de login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Attendre la vérification du rôle
  if (!roleChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {isFreelancer ? (
        <>
          <Route path="/" element={<FreelancerPortal />} />
          <Route path="/FreelancerPortal" element={<FreelancerPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="Dashboard" element={<Dashboard />} />
            <Route path="Pipeline" element={<Pipeline />} />
            <Route path="Clients" element={<Clients />} />
            <Route path="ClientDetail" element={<ClientDetail />} />
            <Route path="Services" element={<Services />} />
            <Route path="Outreach" element={<Outreach />} />
            <Route path="Contracts" element={<Contracts />} />
            <Route path="Invoices" element={<Invoices />} />
            <Route path="Freelancers" element={<Freelancers />} />
            <Route path="Finance" element={<Finance />} />
            <Route path="Editorial" element={<Editorial />} />
            <Route path="Reports" element={<Reports />} />
            <Route path="VideoEditing" element={<VideoEditing />} />
            <Route path="Tasks" element={<Tasks />} />
            <Route path="Admin" element={<Admin />} />
            <Route path="ContentDescriptions" element={<ContentDescriptions />} />
            <Route path="FreelancerAdmin" element={<FreelancerAdmin />} />
            <Route path="*" element={<PageNotFound />} />
          </Route>
        </>
      )}
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
