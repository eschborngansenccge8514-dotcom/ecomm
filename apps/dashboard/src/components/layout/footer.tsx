// apps/dashboard/src/components/layout/footer.tsx
import Link from 'next/link';
import { Copyright } from '@/components/public/Copyright';

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/landing" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#01696f] flex items-center justify-center font-bold text-white text-lg">
                H
              </div>
              <span className="font-bold text-lg text-gray-900 tracking-tight">
                Hyperlocal
              </span>
            </Link>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              The AI-powered Merchant Operating System built specifically for hyperlocal Malaysian businesses. Scale your business from one platform.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2">
              <li><Link href="#features" className="text-sm text-gray-500 hover:text-[#01696f]">Features</Link></li>
              <li><Link href="#pricing" className="text-sm text-gray-500 hover:text-[#01696f]">Pricing</Link></li>
              <li><Link href="/platform" className="text-sm text-gray-500 hover:text-[#01696f]">Platform</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="text-sm text-gray-500 hover:text-[#01696f]">About Us</Link></li>
              <li><Link href="#" className="text-sm text-gray-500 hover:text-[#01696f]">Careers</Link></li>
              <li><Link href="#" className="text-sm text-gray-500 hover:text-[#01696f]">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy-policy" className="text-sm text-gray-500 hover:text-[#01696f]">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-500 hover:text-[#01696f]">Terms of Service</Link></li>
              <li><Link href="/cookie-policy" className="text-sm text-gray-500 hover:text-[#01696f]">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
             © {new Date().getFullYear()} Hyperlocal Technologies Sdn Bhd. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-gray-400">🇲🇾 Made in Malaysia</span>
            <Copyright />
          </div>
        </div>
      </div>
    </footer>
  );
}
