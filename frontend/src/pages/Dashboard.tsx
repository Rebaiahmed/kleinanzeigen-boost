import React from 'react';

const MOCK_STATS = [
  { label: 'Aktive Anzeigen', value: '12', color: 'text-ka-green-dark' },
  { label: 'Heute fällig', value: '3', color: 'text-ka-orange' },
  { label: 'Reposts diesen Monat', value: '45', color: 'text-ka-gray-900' },
  { label: 'Erfolgsrate', value: '98%', color: 'text-ka-green-dark' },
];

const MOCK_ACTIVITY = [
  { id: 1, title: 'iPhone 13 Pro', time: 'Vor 10 Min', status: 'Erfolgreich', type: 'Repost' },
  { id: 2, title: 'IKEA Schreibtisch', time: 'Vor 2 Stunden', status: 'Erfolgreich', type: 'Repost' },
  { id: 3, title: 'Fahrrad Herren', time: 'Gestern', status: 'Fehlgeschlagen (Captcha)', type: 'Fehler' },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ka-gray-900">Dashboard</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_STATS.map((item) => (
          <div key={item.label} className="bg-white overflow-hidden shadow-sm rounded-lg border border-ka-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-ka-gray-600 truncate">{item.label}</dt>
              <dd className={`mt-1 text-3xl font-semibold ${item.color}`}>{item.value}</dd>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="bg-white shadow-sm rounded-lg border border-ka-gray-200 lg:col-span-2">
          <div className="px-4 py-5 border-b border-ka-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-ka-gray-900">Letzte Aktivitäten</h3>
          </div>
          <ul className="divide-y divide-ka-gray-200">
            {MOCK_ACTIVITY.map((activity) => (
              <li key={activity.id} className="px-4 py-4 sm:px-6 hover:bg-ka-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ka-green-dark truncate">{activity.title}</p>
                  <div className="ml-2 flex-shrink-0 flex">
                    <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${activity.status === 'Erfolgreich' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {activity.status}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-ka-gray-600">
                      Typ: {activity.type}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-ka-gray-400 sm:mt-0">
                    <p>{activity.time}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* AI Teaser */}
        <div className="bg-gradient-to-br from-ka-green-light to-ka-green text-ka-gray-900 shadow-sm rounded-lg border border-ka-green-dark p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
              <span className="text-2xl">✨</span> KI-Optimierung
            </h3>
            <p className="text-sm font-medium">Lass unsere KI deinen Titel und deine Beschreibung verbessern, um 3x mehr Aufrufe zu erhalten.</p>
          </div>
          <button className="mt-6 bg-ka-gray-900 text-white font-semibold py-2 px-4 rounded hover:bg-ka-gray-700 transition-colors shadow-sm">
            Jetzt optimieren →
          </button>
        </div>
      </div>
    </div>
  );
}
