import React from 'react';
import { Sparkles, Activity, CheckCircle2, XCircle } from 'lucide-react';

const MOCK_STATS = [
  { label: 'Aktive Anzeigen', value: '12', color: 'text-ka-green-dark' },
  { label: 'Heute fällig', value: '3', color: 'text-ka-orange' },
  { label: 'Reposts diesen Monat', value: '45', color: 'text-ka-gray-900' },
  { label: 'Erfolgsrate', value: '98%', color: 'text-ka-green-dark' },
];

const MOCK_ACTIVITY = [
  { id: 1, title: 'iPhone 13 Pro', time: 'Vor 10 Min', status: 'Erfolgreich', type: 'Repost' },
  { id: 2, title: 'IKEA Schreibtisch', time: 'Vor 2 Stunden', status: 'Erfolgreich', type: 'Repost' },
  { id: 3, title: 'Fahrrad Herren', time: 'Gestern', status: 'Fehlgeschlagen', type: 'Fehler' },
];

export function Dashboard() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-ka-gray-900">Dashboard</h1>
      
      {/* 4-Column Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_STATS.map((item) => (
          <div key={item.label} className="bg-white p-6 rounded-lg shadow-sm border border-ka-gray-100">
            <dt className="text-sm font-medium text-ka-gray-500 mb-1">{item.label}</dt>
            <dd className={`text-4xl font-semibold ${item.color}`}>{item.value}</dd>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Clean Table Activity Feed */}
        <div className="bg-white rounded-lg shadow-sm border border-ka-gray-100 lg:col-span-2 overflow-hidden">
          <div className="px-6 py-5 border-b border-ka-gray-100">
            <h3 className="text-lg font-semibold text-ka-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-ka-gray-500" />
              Letzte Aktivitäten
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ka-gray-100">
              <thead className="bg-ka-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-ka-gray-500 uppercase tracking-wider">Anzeige</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-ka-gray-500 uppercase tracking-wider hidden sm:table-cell">Aktion</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-ka-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-ka-gray-500 uppercase tracking-wider">Zeit</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ka-gray-100">
                {MOCK_ACTIVITY.map((activity) => (
                  <tr key={activity.id} className="hover:bg-ka-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-ka-gray-900">{activity.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-ka-gray-600">{activity.type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {activity.status === 'Erfolgreich' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Erfolgreich
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3.5 h-3.5" /> Fehlgeschlagen
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-ka-gray-500">
                      {activity.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Highlight Card */}
        <div className="bg-purple-50 rounded-lg shadow-sm border-2 border-purple-600 p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="w-24 h-24 text-purple-600" />
          </div>
          
          <div className="relative z-10 flex-1">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-3 text-purple-900">
              <Sparkles className="w-6 h-6 text-purple-600" /> KI-Optimierung
            </h3>
            <p className="text-purple-800 font-medium leading-relaxed">
              Lass unsere KI deinen Titel und deine Beschreibung verbessern, um 3x mehr Aufrufe und schnellere Verkäufe zu generieren.
            </p>
          </div>
          
          <button className="relative z-10 mt-8 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> Jetzt optimieren
          </button>
        </div>
      </div>
    </div>
  );
}
