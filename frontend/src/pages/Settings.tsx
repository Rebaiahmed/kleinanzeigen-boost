import React from 'react';
import { SupportMe } from '../components/SupportMe';

export function Settings() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-ka-gray-900">Einstellungen</h1>
      
      {/* AI Usage Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200 mb-8">
        <h2 className="text-xl font-semibold mb-4">KI-Nutzung</h2>
        <div className="w-full bg-ka-gray-100 rounded-full h-4 mb-2">
          <div className="bg-ka-green h-4 rounded-full" style={{ width: '6.4%' }}></div>
        </div>
        <p className="text-sm text-ka-gray-600">3.200 von 50.000 Tokens verwendet (Starter Plan)</p>
        <p className="text-xs text-ka-gray-400 mt-1">Zähler wird am 1. des Monats zurückgesetzt.</p>
      </section>

      {/* Support Section */}
      <section className="mb-8 scale-95 transform origin-top-left">
        <SupportMe />
      </section>
    </div>
  );
}
