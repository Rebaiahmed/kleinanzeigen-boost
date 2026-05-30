import React from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';

export function TopBar() {
  return (
    <header className="bg-white sticky top-0 z-50 border-b border-[#d4d4d4] shadow-sm">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14">
          {/* Left: Logo */}
          <div className="flex">
            <Link to="/m-meine-anzeigen" className="flex-shrink-0 flex items-center text-[22px] tracking-tight">
              <span className="font-bold text-[#86b817]">kleinanzeigen</span>
              <span className="font-normal text-[#666] ml-1">Boost</span>
            </Link>
          </div>
          
          {/* Right: Support & Profile Avatar */}
          <div className="flex items-center gap-4">
            <a 
              href="https://paypal.me/yourusername" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hidden sm:block text-[13px] font-semibold text-[#666] hover:text-[#333] transition-colors"
            >
              Support me
            </a>
            <div className="flex items-center gap-2 border-l border-[#d4d4d4] pl-4">
              <span className="hidden sm:block text-[13px] font-bold text-[#333]">Max Mustermann</span>
              <div className="h-8 w-8 rounded-full bg-[#f5f5f5] border border-[#d4d4d4] flex items-center justify-center text-[#666] hover:bg-[#e6e6e6] cursor-pointer transition-colors">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
