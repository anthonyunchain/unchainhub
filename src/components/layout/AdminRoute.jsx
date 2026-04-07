import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';

/**
 * AdminRoute — wraps admin-only pages. Fail-CLOSED.
 * On mount, calls getFreelancerData:
 *   - 200 + profile  → user is a freelancer  → redirect to /
 *   - 403 / error    → user is not a freelancer → render children
 *   - exception/timeout → redirect (fail-closed, never grant access on uncertainty)
 */
export default function AdminRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'allowed' | 'redirect'

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('getFreelancerData');
        if (cancelled) return;

        if (!error && !data?.error && data?.profile) {
          // Valid freelancer profile — deny admin access
          setStatus('redirect');
        } else {
          setStatus('allowed');
        }
      } catch {
        // Fail-closed: on any network error or exception, deny access
        if (!cancelled) setStatus('redirect');
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'redirect') {
    return <Navigate to="/" replace />;
  }

  return children;
}
