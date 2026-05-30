import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Ads } from './pages/Ads';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<Auth />} />
        {/* Authenticated Routes wrapped in AppShell */}
        <Route path="/m-meine-anzeigen" element={<AppShell><Ads /></AppShell>} />
        {/* Catch-all redirect to ads for the simplified view */}
        <Route path="*" element={<Navigate to="/m-meine-anzeigen" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
