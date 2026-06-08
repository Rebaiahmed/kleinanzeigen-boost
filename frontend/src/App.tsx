import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Ads } from './pages/Ads';
import { CreateWithAi } from './pages/CreateWithAi';
import { Settings } from './pages/Settings';
import { AppShell } from './components/layout/AppShell';
import { Landing } from './pages/Landing';
import { AuthCallback } from './pages/AuthCallback';
import { EbaySuccess } from './pages/EbaySuccess';
import { ReplyTemplatesList } from './components/reply-templates/ReplyTemplatesList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/ebay/callback/success" element={<EbaySuccess />} />
        {/* Authenticated Routes wrapped in AppShell */}
        <Route path="/meine-anzeigen" element={<AppShell><Ads /></AppShell>} />
        <Route path="/neue-anzeige-mit-ki-erstellen" element={<AppShell><CreateWithAi /></AppShell>} />
        <Route path="/einstellungen" element={<AppShell><Settings /></AppShell>} />
        <Route path="/vorlagen" element={<AppShell><ReplyTemplatesList /></AppShell>} />
        {/* Catch-all redirect to ads for the simplified view */}
        <Route path="*" element={<Navigate to="/meine-anzeigen" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
