import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Settings } from './pages/Settings';
import { AiAssistant } from './pages/AiAssistant';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ai" element={<AiAssistant />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
