import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from './pages/LoginPage';
import { useEffect, useState } from 'react';
import { supabase } from '@/api/base44Client';
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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const [roleChecked, setRoleChecked] = useState(false);
  const [isFreelancer, setIsFreelancer] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('getFreelancerData');
          if (!error && !data?.error && data?.profile) {
            setIsFreelancer(true);
          } else {
            setIsFreelancer(false);
          }
        } catch {
          setIsFreelancer(false);
        }
        setRoleChecked(true);
      })();
    }
  }, [isLoadingAuth, isAuthenticated]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

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
