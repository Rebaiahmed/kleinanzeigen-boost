import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface SupportConfig {
  paypalDonateUrl?: string;
}

export function SupportMe() {
  const [config, setConfig] = useState<SupportConfig | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/support/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Failed to fetch support config', err));
  }, []);

  if (!config?.paypalDonateUrl) return null;

  return (
    <a
      href={config.paypalDonateUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 bg-[#003087] hover:bg-[#002260] text-white font-medium py-2.5 px-5 rounded-md transition-colors shadow-sm text-sm"
    >
      <Heart className="w-4 h-4" />
      Support AdsBoost
    </a>
  );
}
