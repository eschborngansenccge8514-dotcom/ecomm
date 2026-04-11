// apps/dashboard/src/components/layout/navbar.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl ${
            scrolled ? 'bg-[#01696f] text-white' : 'bg-white text-[#01696f]'
          }`}>
            H
          </div>
          <span className={`font-bold text-xl tracking-tight ${
            scrolled ? 'text-[#01696f]' : 'text-white'
          }`}>
            Hyperlocal
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Pricing', 'FAQ'].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-gray-600 hover:text-[#01696f]' : 'text-white/80 hover:text-white'
              }`}
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className={`text-sm font-semibold transition-colors ${
              scrolled ? 'text-gray-600 hover:text-[#01696f]' : 'text-white/80 hover:text-white'
            }`}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              scrolled
                ? 'bg-[#01696f] text-white hover:bg-[#01696f]/90 shadow-md'
                : 'bg-white text-[#01696f] hover:bg-white/90 shadow-lg'
            }`}
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
