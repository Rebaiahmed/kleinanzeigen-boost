import React from 'react';
import { SupportMe } from '../components/SupportMe';
import { Heart } from 'lucide-react';

export function Settings() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-ka-gray-900">Einstellungen</h1>
      
      {/* AI Usage Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-ka-gray-900">KI-Nutzung</h2>
        <div className="w-full bg-ka-gray-100 rounded-full h-4 mb-3 overflow-hidden">
          <div className="bg-ka-green h-full rounded-full transition-all duration-500" style={{ width: '6.4%' }}></div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-ka-gray-900 font-medium">3.200 <span className="text-ka-gray-600 font-normal">von 50.000 Tokens verwendet (Starter Plan)</span></span>
        </div>
        <p className="text-xs text-ka-gray-400 mt-2">Zähler wird am 1. des Monats zurückgesetzt.</p>
      </section>

      {/* Clean Support Card */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ka-gray-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-ka-orange" />
            Unterstütze das Projekt
          </h2>
          <p className="text-sm text-ka-gray-600 mt-1">
            AnzeigenBoost ist ein unabhängiges Seitenprojekt. Jede Spende hilft bei den Serverkosten.
          </p>
        </div>
        <div className="shrink-0">
          <SupportMe />
        </div>
      </section>
    </div>
  );
}
