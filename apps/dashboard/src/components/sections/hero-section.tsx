// apps/dashboard/src/components/sections/hero-section.tsx
import Image from 'next/image';
import Link  from 'next/link';

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] flex-col items-center
                 justify-center overflow-hidden bg-[#01696f] px-4 pt-24 pb-16 text-white"
    >
      {/* Subtle background grid */}
      <div aria-hidden className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-10" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border
                         border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium">
          🇲🇾 Built for Malaysian Merchants
        </span>

        {/* H1 — Primary keyword target */}
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight
                       sm:text-5xl md:text-6xl">
          One Platform.
          <br />
          <span className="text-[#a8f0e8]">Your Entire Business.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
          Replace your separate POS, e-commerce store, marketplace tools, accountant,
          and marketing team — with one AI-powered Merchant OS built for hyperlocal
          Malaysian businesses.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-white px-8 py-4 text-base font-semibold
                       text-[#01696f] shadow-lg transition hover:bg-white/90
                       focus-visible:outline focus-visible:outline-2"
          >
            Start Free — No Credit Card
          </Link>
          <Link
            href="#demo"
            className="rounded-full border border-white/40 px-8 py-4 text-base
                       font-semibold text-white transition hover:bg-white/10"
          >
            Watch Demo ↓
          </Link>
        </div>

        <p className="mt-4 text-sm text-white/50">
          Free 14-day trial · No setup fee · Cancel anytime
        </p>
      </div>

      {/* Hero image — LCP element, must use priority */}
      <div className="relative z-10 mt-16 w-full max-w-5xl">
        <Image
          src="/dashboard-mockup.png"
          alt="Hyperlocal Merchant OS dashboard showing sales analytics, inventory, and AI assistant"
          width={1200}
          height={720}
          priority          // LCP optimisation — always set on above-fold image
          className="rounded-2xl shadow-2xl ring-1 ring-white/10"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
        />
      </div>
    </section>
  );
}
