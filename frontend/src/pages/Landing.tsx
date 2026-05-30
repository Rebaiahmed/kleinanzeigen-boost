import React, { useState } from 'react';
import { SupportMe } from '../components/SupportMe';
import { Menu, X, Zap, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Landing() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ka-gray-50 font-sans text-ka-gray-900">
      {/* Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <Zap className="h-6 w-6 text-ka-orange" />
              <span className="text-2xl font-bold text-ka-green-dark">AnzeigenBoost</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-ka-gray-600 hover:text-ka-green-dark font-medium transition-colors">Funktionen</a>
              <a href="#pricing" className="text-ka-gray-600 hover:text-ka-green-dark font-medium transition-colors">Preise</a>
              <a href="#faq" className="text-ka-gray-600 hover:text-ka-green-dark font-medium transition-colors">FAQ</a>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Link to="/dashboard" className="text-ka-green-dark font-medium hover:text-ka-green transition-colors">
                Sign up
              </Link>
              <Link to="/dashboard" className="bg-ka-green hover:bg-ka-green-dark text-white px-5 py-2 rounded-md font-medium transition-colors shadow-sm">
                Start for free
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-ka-gray-600 hover:text-ka-gray-900 focus:outline-none"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-ka-gray-100">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a href="#features" className="block px-3 py-2 text-ka-gray-600 hover:bg-ka-gray-50 rounded-md font-medium">Funktionen</a>
              <a href="#pricing" className="block px-3 py-2 text-ka-gray-600 hover:bg-ka-gray-50 rounded-md font-medium">Preise</a>
              <a href="#faq" className="block px-3 py-2 text-ka-gray-600 hover:bg-ka-gray-50 rounded-md font-medium">FAQ</a>
              <Link to="/dashboard" className="block px-3 py-2 text-ka-green-dark hover:bg-ka-gray-50 rounded-md font-medium">Sign up</Link>
              <Link to="/dashboard" className="block px-3 py-2 text-ka-green font-medium">Start for free</Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-ka-gray-900 mb-6">
            Deine Kleinanzeigen <span className="text-ka-green-dark">immer ganz oben</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-ka-gray-600 mb-10">
            AnzeigenBoost repostet deine Anzeigen automatisch. Spare Zeit, verkaufe schneller und lass die KI deine Titel optimieren.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/dashboard" className="bg-ka-green hover:bg-ka-green-dark text-white px-8 py-3 rounded-md font-semibold text-lg shadow-sm transition-colors">
              Jetzt kostenlos testen
            </Link>
            <a href="#how-it-works" className="bg-white hover:bg-ka-gray-50 text-ka-gray-700 border border-ka-gray-200 px-8 py-3 rounded-md font-medium text-lg transition-colors">
              Wie es funktioniert
            </a>
          </div>
          
          <div className="mt-12 flex justify-center items-center gap-8 text-ka-gray-400 text-sm font-medium">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-ka-green" /> Kein manuelles Löschen mehr</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-ka-green" /> 100% sicher verschlüsselt</div>
          </div>
        </section>
      </main>

      {/* Footer with SupportMe */}
      <footer className="bg-white border-t border-ka-gray-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-xl font-bold text-ka-green-dark">
            <Zap className="h-5 w-5 text-ka-orange" />
            AnzeigenBoost
          </div>
          
          <div className="flex gap-6 text-sm text-ka-gray-600">
            <Link to="/impressum" className="hover:text-ka-gray-900 transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-ka-gray-900 transition-colors">Datenschutz</Link>
            <Link to="/agb" className="hover:text-ka-gray-900 transition-colors">AGB</Link>
          </div>

          <div className="flex items-center">
            <SupportMe />
          </div>
        </div>
      </footer>
    </div>
  );
}
