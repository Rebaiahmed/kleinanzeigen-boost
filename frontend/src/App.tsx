import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Ads } from './pages/Ads';
import { CreateWithAi } from './pages/CreateWithAi';
import { AppShell } from './components/layout/AppShell';
import { Landing } from './pages/Landing';
import { AuthCallback } from './pages/AuthCallback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Authenticated Routes wrapped in AppShell */}
        <Route path="/m-meine-anzeigen" element={<AppShell><Ads /></AppShell>} />
        <Route path="/create-with-ai" element={<AppShell><CreateWithAi /></AppShell>} />
        {/* Catch-all redirect to ads for the simplified view */}
        <Route path="*" element={<Navigate to="/m-meine-anzeigen" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
