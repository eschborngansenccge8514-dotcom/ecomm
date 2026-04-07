import React from 'react'
import Link from 'next/link'
import { Globe, MessageSquare, Shield, ShoppingBag } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="py-20 bg-bg-secondary border-t border-gray-100 mt-auto">
      <div className="container grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="flex flex-col gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white">
              <ShoppingBag size={16} />
            </div>
            <span className="text-lg font-bold tracking-tight">Senang<span className="text-brand-primary">Store</span></span>
          </Link>
          <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
            The easiest all-in-one e-commerce management platform for modern merchants.
          </p>
          <div className="flex items-center gap-4 text-brand-primary opacity-60">
            <Globe size={20} className="hover:opacity-100 cursor-pointer transition-opacity" />
            <MessageSquare size={20} className="hover:opacity-100 cursor-pointer transition-opacity" />
            <Shield size={20} className="hover:opacity-100 cursor-pointer transition-opacity" />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-primary">Platform</h4>
          <div className="flex flex-col gap-3 text-sm text-text-secondary">
            <Link href="#features" className="hover:text-brand-primary transition-colors">Features</Link>
            <Link href="#merchants" className="hover:text-brand-primary transition-colors">Merchant Dashboard</Link>
            <Link href="#ai" className="hover:text-brand-primary transition-colors">AI Support Agent</Link>
            <Link href="/pricing" className="hover:text-brand-primary transition-colors">Pricing</Link>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-primary">Company</h4>
          <div className="flex flex-col gap-3 text-sm text-text-secondary">
            <Link href="/about" className="hover:text-brand-primary transition-colors">About Us</Link>
            <Link href="/careers" className="hover:text-brand-primary transition-colors">Careers</Link>
            <Link href="/blog" className="hover:text-brand-primary transition-colors">Blog</Link>
            <Link href="/contact" className="hover:text-brand-primary transition-colors">Contact</Link>
          </div>
        </div>

        <div className="flex flex-col gap-6 text-sm">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-primary">Legal</h4>
          <div className="flex flex-col gap-3 text-text-secondary">
            <Link href="/privacy" className="hover:text-brand-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-brand-primary transition-colors">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-brand-primary transition-colors">Cookies Policy</Link>
          </div>
        </div>
      </div>

      <div className="container mt-20 pt-8 border-t border-gray-200">
        <p className="text-xs text-text-tertiary text-center">
          &copy; {new Date().getFullYear()} Senang Store. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
