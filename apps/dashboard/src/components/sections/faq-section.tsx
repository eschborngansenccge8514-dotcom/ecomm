// apps/dashboard/src/components/sections/faq-section.tsx
'use client';
import { useState } from 'react';
import { FAQS } from '@/lib/landing/constants';

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-3xl font-bold">Frequently asked questions</h2>

        <div className="mt-12 divide-y divide-gray-100">
          {FAQS.map((item, idx) => (
            <div key={idx}>
              <button
                onClick={() => setOpen(open === idx ? null : idx)}
                className="flex w-full items-center justify-between py-5 text-left
                           text-base font-medium text-gray-900"
                aria-expanded={open === idx}
              >
                {item.q}
                <span className={`ml-4 flex-shrink-0 text-[#01696f] transition
                                  ${open === idx ? 'rotate-45' : ''}`}>
                  +
                </span>
              </button>
              {open === idx && (
                <p className="pb-5 text-sm leading-relaxed text-gray-500">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
