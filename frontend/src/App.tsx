import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Ads } from './pages/Ads';
import { Settings } from './pages/Settings';
import { AiAssistant } from './pages/AiAssistant';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* Authenticated Routes wrapped in AppShell */}
        <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
        <Route path="/ads" element={<AppShell><Ads /></AppShell>} />
        <Route path="/settings" element={<AppShell><Settings /></AppShell>} />
        <Route path="/ai" element={<AppShell><AiAssistant /></AppShell>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
