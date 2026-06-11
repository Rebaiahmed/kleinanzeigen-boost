import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/** True when the user has a session token (set on login / handshake callback). */
function hasSession(): boolean {
  return !!(localStorage.getItem('kb_session') || localStorage.getItem('token'));
}

/**
 * Guards authenticated routes. Without a token we redirect to /login *before*
 * rendering the dashboard — no flash of empty UI and no reliance on an API 401
 * to bounce the user. `from` is preserved so login can return the user back.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
