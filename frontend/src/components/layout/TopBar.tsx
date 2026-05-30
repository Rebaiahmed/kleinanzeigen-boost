import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export function TopBar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? 'text-ka-green-dark border-b-2 border-ka-green-dark font-semibold' : 'text-ka-gray-600 hover:text-ka-green-dark';

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/dashboard" className="flex-shrink-0 flex items-center gap-2 text-2xl font-bold text-ka-green-dark">
              <span className="text-ka-orange">⚡</span> AnzeigenBoost
            </Link>
            <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
              <Link to="/dashboard" className={`inline-flex items-center px-1 pt-1 ${isActive('/dashboard')}`}>
                Dashboard
              </Link>
              <Link to="/ads" className={`inline-flex items-center px-1 pt-1 ${isActive('/ads')}`}>
                Meine Anzeigen
              </Link>
              <Link to="/ai" className={`inline-flex items-center px-1 pt-1 ${isActive('/ai')}`}>
                KI-Assistent
              </Link>
              <Link to="/settings" className={`inline-flex items-center px-1 pt-1 ${isActive('/settings')}`}>
                Einstellungen
              </Link>
            </nav>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-ka-gray-600 mr-4">Hallo, Max</span>
            <div className="h-8 w-8 rounded-full bg-ka-green-light flex items-center justify-center text-ka-green-dark font-bold">
              M
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
