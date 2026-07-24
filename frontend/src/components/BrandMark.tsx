/**
 * Icon mark from the official logo (docs/assets/branding/anzeigenboost_logo_final.svg),
 * extracted without its white background rect and wordmark text so it can sit
 * inline next to the existing HTML wordmark (keeps i18n/dark-mode text control).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="20 10 68 96" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Arrow shaft */}
      <rect x="30" y="40" width="12" height="55" fill="#A8C300" rx="2" />
      {/* Arrow head */}
      <path d="M 36 40 L 60 18 L 55 25 Z" fill="#A8C300" />
      {/* Price tag accent */}
      <g transform="translate(50, 68)">
        <rect x="0" y="0" width="28" height="20" rx="3" fill="white" stroke="#A8C300" strokeWidth="2" />
        <circle cx="6" cy="10" r="2.5" fill="#1F2937" />
        <line x1="12" y1="0" x2="12" y2="20" stroke="#A8C300" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
