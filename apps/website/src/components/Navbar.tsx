'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingBag, Menu, X } from 'lucide-react'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-4 glass' : 'py-6 bg-transparent'}`}>
      <div className="container flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
            <ShoppingBag size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">Senang<span className="text-brand-primary">Store</span></span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-secondary">
          <Link href="#features" className="hover:text-brand-primary transition-colors">Features</Link>
          <Link href="#merchants" className="hover:text-brand-primary transition-colors">For Merchants</Link>
          <Link href="#ai" className="hover:text-brand-primary transition-colors">AI Assistant</Link>
          <Link href="https://dashboard.senang.store" className="btn btn-primary ml-4" style={{ padding: '0.6rem 1.5rem', fontSize: '0.875rem' }}>
            Merchant Login
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-text-primary" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-t border-gray-100 p-6 flex flex-col gap-4 shadow-xl animate-fade-in md:hidden">
          <Link href="#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
          <Link href="#merchants" onClick={() => setMobileMenuOpen(false)}>For Merchants</Link>
          <Link href="#ai" onClick={() => setMobileMenuOpen(false)}>AI Assistant</Link>
          <Link href="https://dashboard.senang.store" className="btn btn-primary text-center">Merchant Login</Link>
        </div>
      )}
    </nav>
  )
}
