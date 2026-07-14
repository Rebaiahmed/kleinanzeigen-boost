import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Ads } from './pages/Ads';
import { MeineEntwuerfe } from './pages/MeineEntwuerfe';
import { CreateWithAi } from './pages/CreateWithAi';
import { Settings } from './pages/Settings';
import { AppShell } from './components/layout/AppShell';
import { Landing } from './pages/Landing';
import { Datenschutz } from './pages/Datenschutz';
import { Impressum } from './pages/Impressum';
import { AuthCallback } from './pages/AuthCallback';
import { EbaySuccess } from './pages/EbaySuccess';
import { ReplyTemplatesList } from './components/reply-templates/ReplyTemplatesList';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Wettbewerb } from './pages/Wettbewerb';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dev builds skip the marketing page and go straight to login/dashboard */}
        <Route path="/" element={(import.meta as any).env.DEV ? <Navigate to="/login" replace /> : <Landing />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/login" element={<Auth />} />
        {/* Backward-compat: old /auth links redirect to /login */}
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/ebay/callback/success" element={<EbaySuccess />} />
        {/* Authenticated Routes — guarded, then wrapped in AppShell */}
        <Route path="/meine-anzeigen" element={<ProtectedRoute><AppShell><Ads /></AppShell></ProtectedRoute>} />
        <Route path="/meine-entwuerfe" element={<ProtectedRoute><AppShell><MeineEntwuerfe /></AppShell></ProtectedRoute>} />
        <Route path="/neue-anzeige-mit-ki-erstellen" element={<ProtectedRoute><AppShell><CreateWithAi /></AppShell></ProtectedRoute>} />
        <Route path="/einstellungen" element={<ProtectedRoute><AppShell><Settings /></AppShell></ProtectedRoute>} />
        <Route path="/vorlagen" element={<ProtectedRoute><AppShell><ReplyTemplatesList /></AppShell></ProtectedRoute>} />
        <Route path="/wettbewerb" element={<ProtectedRoute><AppShell><Wettbewerb /></AppShell></ProtectedRoute>} />
        {/* Catch-all redirect to ads for the simplified view */}
        <Route path="*" element={<Navigate to="/meine-anzeigen" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
