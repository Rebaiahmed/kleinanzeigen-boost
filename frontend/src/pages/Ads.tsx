import React from 'react';

const MOCK_ADS = [
  { id: 1, title: 'iPhone 13 Pro 128GB Graphit', price: '650 €', interval: 'Täglich', next: 'Heute 18:00', status: 'Aktiv' },
  { id: 2, title: 'IKEA Bekant Schreibtisch 160x80', price: '120 €', interval: 'Alle 3 Tage', next: 'Morgen 10:00', status: 'Aktiv' },
  { id: 3, title: 'Winterreifen Michelin 205/55 R16', price: '180 €', interval: 'Wöchentlich', next: 'In 4 Tagen', status: 'Pausiert' },
  { id: 4, title: 'Sony PlayStation 5', price: '400 €', interval: 'Täglich', next: 'Heute 20:00', status: 'Aktiv' },
];

export function Ads() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-ka-gray-900">Meine Anzeigen</h1>
        <div className="flex gap-4">
          <button className="bg-white border border-ka-gray-300 text-ka-gray-700 font-semibold py-2 px-4 rounded hover:bg-ka-gray-50 transition-colors shadow-sm">
            ↻ Synchronisieren
          </button>
          <button className="bg-ka-green hover:bg-ka-green-dark text-white font-semibold py-2 px-4 rounded transition-colors shadow-sm flex items-center gap-2">
            <span>+</span> Neue Anzeige
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-ka-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-ka-gray-200">
          <thead className="bg-ka-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ka-gray-600 uppercase tracking-wider">Titel & Preis</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ka-gray-600 uppercase tracking-wider">Intervall</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ka-gray-600 uppercase tracking-wider">Nächster Repost</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ka-gray-600 uppercase tracking-wider">Status</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-ka-gray-200">
            {MOCK_ADS.map((ad) => (
              <tr key={ad.id} className="hover:bg-ka-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-ka-gray-900">{ad.title}</div>
                  <div className="text-sm text-ka-gray-600">{ad.price}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-ka-gray-600">{ad.interval}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-ka-gray-600">{ad.next}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ad.status === 'Aktiv' ? 'bg-ka-green-light text-ka-green-dark' : 'bg-ka-gray-200 text-ka-gray-700'}`}>
                    {ad.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                  <button className="text-ka-orange hover:text-[#E65C00] px-2 py-1 border border-ka-orange rounded">✨ KI Opt.</button>
                  <button className="text-ka-green-dark hover:text-green-900 px-2 py-1 bg-ka-green-light rounded">Jetzt reposten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
