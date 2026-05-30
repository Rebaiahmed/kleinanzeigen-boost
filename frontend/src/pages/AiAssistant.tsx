import React from 'react';

export function AiAssistant() {
  return (
    <div className="p-8 max-w-6xl mx-auto flex gap-8">
      {/* Chat Interface (Left) */}
      <div className="flex-1 bg-white border border-ka-gray-200 rounded-lg shadow-sm flex flex-col h-[600px]">
        <div className="p-4 border-b border-ka-gray-200 bg-ka-gray-50">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="text-ka-orange">✨</span> KI-Assistent
          </h2>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Chat history goes here */}
        </div>
        <div className="p-4 border-t border-ka-gray-200">
          <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
            <button className="whitespace-nowrap text-xs bg-ka-gray-100 hover:bg-ka-gray-200 rounded-full px-3 py-1">Welche Anzeige soll ich optimieren?</button>
            <button className="whitespace-nowrap text-xs bg-ka-gray-100 hover:bg-ka-gray-200 rounded-full px-3 py-1">Warum schlägt mein Repost fehl?</button>
          </div>
          <input type="text" placeholder="Frag mich zu deinen Anzeigen..." className="w-full border border-ka-gray-300 rounded p-2 focus:outline-none focus:border-ka-green" />
        </div>
      </div>

      {/* Tools Panel (Right) */}
      <div className="w-80 flex flex-col gap-6">
        <div className="bg-white border border-ka-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-2">Anzeige optimieren</h3>
          <select className="w-full border border-ka-gray-300 rounded p-2 mb-2">
            <option>Wähle eine Anzeige...</option>
          </select>
          <button className="w-full bg-ka-green hover:bg-ka-green-dark text-white rounded p-2">Jetzt optimieren</button>
        </div>
        
        <div className="bg-white border border-ka-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-2">Preis prüfen</h3>
          <select className="w-full border border-ka-gray-300 rounded p-2 mb-2">
            <option>Wähle eine Anzeige...</option>
          </select>
          <button className="w-full bg-ka-orange hover:bg-[#E65C00] text-white rounded p-2">Preis vorschlagen</button>
        </div>
      </div>
    </div>
  );
}
