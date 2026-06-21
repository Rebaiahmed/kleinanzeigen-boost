import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Ads } from './pages/Ads';
import { CreateWithAi } from './pages/CreateWithAi';
import { Settings } from './pages/Settings';
import { AppShell } from './components/layout/AppShell';
import { Landing } from './pages/Landing';
import { Datenschutz } from './pages/Datenschutz';
import { AuthCallback } from './pages/AuthCallback';
import { EbaySuccess } from './pages/EbaySuccess';
import { ReplyTemplatesList } from './components/reply-templates/ReplyTemplatesList';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
        <Route path="/login" element={<Auth />} />
        {/* Backward-compat: old /auth links redirect to /login */}
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/ebay/callback/success" element={<EbaySuccess />} />
        {/* Authenticated Routes — guarded, then wrapped in AppShell */}
        <Route path="/meine-anzeigen" element={<ProtectedRoute><AppShell><Ads /></AppShell></ProtectedRoute>} />
        <Route path="/neue-anzeige-mit-ki-erstellen" element={<ProtectedRoute><AppShell><CreateWithAi /></AppShell></ProtectedRoute>} />
        <Route path="/einstellungen" element={<ProtectedRoute><AppShell><Settings /></AppShell></ProtectedRoute>} />
        <Route path="/vorlagen" element={<ProtectedRoute><AppShell><ReplyTemplatesList /></AppShell></ProtectedRoute>} />
        {/* Catch-all redirect to ads for the simplified view */}
        <Route path="*" element={<Navigate to="/meine-anzeigen" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
