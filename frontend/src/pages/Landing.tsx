import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { SupportMe } from '../components/SupportMe';

/* ────────────────────────────────────────────────────────────────────────
 * Things to swap
 * ──────────────────────────────────────────────────────────────────────── */

// Demo video — update with real product demo when available
const YOUTUBE_VIDEO_ID = 'dQw4w9WgXcQ';

// Social media links — configure with actual profiles
const SOCIAL_LINKS = {
  tiktok: '#',
  instagram: '#',
  youtube: '#',
};

const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/noagiapohlenpolcbeghlmngalapbobe';

/* ────────────────────────────────────────────────────────────────────────
 * Icons (inline SVG — no icon font, no external asset requests)
 * ──────────────────────────────────────────────────────────────────────── */

/** Official multicolor Chrome logo (circle). */
function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 12 L1.61 6.0 A12 12 0 0 1 22.39 6.0 Z" fill="#EA4335" />
      <path d="M12 12 L22.39 6.0 A12 12 0 0 1 12 24 Z" fill="#34A853" />
      <path d="M12 12 L12 24 A12 12 0 0 1 1.61 6.0 Z" fill="#FBBC05" />
      <circle cx="12" cy="12" r="8" fill="#fff" />
      <circle cx="12" cy="12" r="5.5" fill="#4285F4" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.3 1.9 1.5 3.4 3.4 3.9.4.1.8.2 1.1.2v3a7 7 0 0 1-4.4-1.6v6.6a5.9 5.9 0 1 1-5.9-5.9c.2 0 .4 0 .6.1v3.1a2.8 2.8 0 1 0 2.2 2.7V3h3z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
      <path d="M10 9.2 15.5 12 10 14.8Z" fill="#fff" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Video — click-to-load facade so the YouTube player/JS only loads on
 * interaction (page stays fast even though the video sits above the fold).
 * ──────────────────────────────────────────────────────────────────────── */

function YouTubeEmbed({ videoId }: { videoId: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full max-w-[800px] mx-auto aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
      {loaded ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="So funktioniert's – in 60 Sekunden"
          className="absolute inset-0 w-full h-full"
          loading="lazy"
          allow="accelerated-video; encrypted-media"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full group"
          aria-label="Video abspielen"
        >
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt="Vorschaubild: So funktioniert's"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <span className="ml-1 w-0 h-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-[#A8C300]" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────────────────── */

export function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-700 text-[18px] leading-relaxed">
      <main>
        {/* 1. HERO */}
        <section className="pt-14 pb-12 px-4 sm:px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-1.5 mb-8">
              <span className="font-bold text-slate-900">Anzeigen</span>
              <span className="font-bold text-[#A8C300]">Boost</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-5 leading-[1.15]">
              Ihre Kleinanzeigen. Automatisch immer oben.
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 mb-8 leading-relaxed">
              AnzeigenBoost veröffentlicht Ihre Anzeigen neu und schreibt bessere Texte mit KI – mit einem Klick.
            </p>

            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-4 px-8 rounded-full text-lg shadow-sm transition-colors"
            >
              <ChromeIcon className="w-6 h-6 shrink-0" />
              Kostenlos im Chrome Web Store
            </a>

            <p className="text-base text-slate-400 mt-4">Kostenlos starten · Keine Kreditkarte nötig</p>
          </div>
        </section>

        {/* 2. VIDEO */}
        <section className="pb-16 px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-6">
            So funktioniert's – in 60 Sekunden
          </h2>
          <YouTubeEmbed videoId={YOUTUBE_VIDEO_ID} />
        </section>

        {/* 3. THREE BENEFITS */}
        <section className="py-16 bg-slate-50 border-y border-slate-200 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-14 h-14 rounded-full bg-[#A8C300]/10 text-[#A8C300] flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Anzeigen neu veröffentlichen</h3>
              <p className="text-slate-600">Wieder ganz oben in den Suchergebnissen.</p>
            </div>
            <div>
              <div className="w-14 h-14 rounded-full bg-[#A8C300]/10 text-[#A8C300] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">KI schreibt Ihre Texte</h3>
              <p className="text-slate-600">Bessere Beschreibungen auf Deutsch, automatisch.</p>
            </div>
            <div>
              <div className="w-14 h-14 rounded-full bg-[#A8C300]/10 text-[#A8C300] flex items-center justify-center mx-auto mb-4">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Zeit sparen</h3>
              <p className="text-slate-600">Was früher 30 Minuten dauerte, dauert jetzt 1 Klick.</p>
            </div>
          </div>

          <p className="flex items-center justify-center gap-2 text-base text-slate-400 mt-10">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Ihr Kleinanzeigen-Passwort sehen wir nie.
          </p>
        </section>
      </main>

      {/* 4. FOOTER */}
      <footer className="py-10 px-4 sm:px-6 border-t border-slate-200">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-5">
            <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-slate-400 hover:text-slate-900 transition-colors">
              <TikTokIcon className="w-5 h-5" />
            </a>
            <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-slate-400 hover:text-[#E1306C] transition-colors">
              <InstagramIcon className="w-5 h-5" />
            </a>
            <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-slate-400 hover:text-[#FF0000] transition-colors">
              <YouTubeIcon className="w-5 h-5" />
            </a>
          </div>

          <SupportMe />

          <nav className="flex items-center gap-4 text-sm text-slate-500">
            <Link to="/impressum" className="hover:text-slate-800">Impressum</Link>
            <span className="text-slate-300">·</span>
            <Link to="/datenschutz" className="hover:text-slate-800">Datenschutz</Link>
          </nav>

          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            AnzeigenBoost ist ein unabhängiges Projekt und steht in keiner Verbindung zur Kleinanzeigen GmbH.
          </p>
        </div>
      </footer>
    </div>
  );
}
