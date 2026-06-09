import React from 'react';

// Buy Me a Coffee link — overridable via env, defaults to the project's page.
const BMAC_URL =
  (import.meta as any).env.VITE_BUYMEACOFFEE_URL ||
  'https://buymeacoffee.com/ahmedbouhmy';

export function SupportMe() {
  return (
    <a
      href={BMAC_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Buy Me a Coffee"
      className="group inline-flex items-center justify-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-semibold py-2.5 px-5 rounded-md shadow-sm text-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
    >
      <span className="text-base transition-transform duration-150 group-hover:scale-110">☕</span>
      Spendier mir einen Kaffee
    </a>
  );
}
