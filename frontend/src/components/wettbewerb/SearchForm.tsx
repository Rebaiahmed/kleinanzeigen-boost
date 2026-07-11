import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  RADIUS_OPTIONS_KM,
  DEFAULT_RADIUS_KM,
  CHECK_INTERVAL_OPTIONS,
  DEFAULT_CHECK_INTERVAL_DAYS,
  MIN_KEYWORD_LENGTH,
  GENERIC_KEYWORD_DENYLIST,
} from '../../config/wettbewerbConstants';
import { isValidGermanPlzFormat, isValidGermanPlzRange } from '../../lib/plzValidation';
import type { CreateSavedSearchInput } from '../../hooks/useWettbewerbActions';

interface SearchFormProps {
  onSubmit: (input: CreateSavedSearchInput) => void;
  isSubmitting: boolean;
}

const PLZ_ERROR = 'Bitte eine gültige 5-stellige PLZ eingeben (z. B. 48143)';
const GENERIC_KEYWORD_WARNING = 'Sehr allgemeiner Begriff — die Ergebnisse könnten ungenau sein';

export function SearchForm({ onSubmit, isSubmitting }: SearchFormProps) {
  const [keyword, setKeyword] = useState('');
  const [plz, setPlz] = useState('');
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [checkIntervalDays, setCheckIntervalDays] = useState<number>(DEFAULT_CHECK_INTERVAL_DAYS);

  const trimmedKeyword = keyword.trim();

  const keywordError = trimmedKeyword.length === 0 ? 'Bitte einen Suchbegriff eingeben' : null;
  const keywordWarning =
    !keywordError &&
    (trimmedKeyword.length < MIN_KEYWORD_LENGTH || GENERIC_KEYWORD_DENYLIST.includes(trimmedKeyword.toLowerCase()))
      ? GENERIC_KEYWORD_WARNING
      : null;

  const plzTouched = plz.length > 0;
  const plzError =
    plzTouched && (!isValidGermanPlzFormat(plz) || !isValidGermanPlzRange(plz)) ? PLZ_ERROR : null;

  const canSubmit = useMemo(
    () => trimmedKeyword.length > 0 && plz.length > 0 && isValidGermanPlzFormat(plz) && isValidGermanPlzRange(plz),
    [trimmedKeyword, plz],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    onSubmit({ keyword: trimmedKeyword, plz, radiusKm, checkIntervalDays });
  };

  const fieldClass = (hasError: boolean) =>
    `w-full border rounded-sm px-2.5 py-1.5 text-[13px] focus:outline-none ${
      hasError ? 'border-red-500' : 'border-[#ccc] focus:border-[#A8C300]'
    }`;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#e5e5e5] rounded-sm shadow-sm p-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-medium text-[#555] mb-1">Suchbegriff</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="z. B. Ikea Sofa"
            className={fieldClass(!!keywordError)}
          />
          {keywordError && <p className="mt-1 text-[11px] text-red-600">{keywordError}</p>}
          {!keywordError && keywordWarning && <p className="mt-1 text-[11px] text-amber-600">{keywordWarning}</p>}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#555] mb-1">PLZ</label>
          <input
            type="text"
            inputMode="numeric"
            value={plz}
            onChange={(e) => setPlz(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
            placeholder="z. B. 48143"
            className={fieldClass(!!plzError)}
          />
          {plzError && <p className="mt-1 text-[11px] text-red-600">{plzError}</p>}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#555] mb-1">Radius</label>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className={fieldClass(false)}
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km === 0 ? 'Nur PLZ' : `${km} km`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#555] mb-1">Prüfintervall</label>
          <select
            value={checkIntervalDays}
            onChange={(e) => setCheckIntervalDays(Number(e.target.value))}
            className={fieldClass(false)}
          >
            {CHECK_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="mt-3 inline-flex items-center gap-1.5 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-1.5 px-3 rounded-sm text-[13px] transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        {isSubmitting ? 'Speichere…' : 'Suche speichern'}
      </button>
    </form>
  );
}
