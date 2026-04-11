// apps/dashboard/src/components/cookie-banner.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export type CookieCategory = 'necessary' | 'analytics' | 'marketing' | 'functional';

export const COOKIE_CATEGORIES: Record<CookieCategory, {
  label:       string;
  description: string;
  required:    boolean;
}> = {
  necessary: {
    label:       'Strictly Necessary',
    description: 'Required for the website to function. Cannot be disabled.',
    required:    true,
  },
  analytics: {
    label:       'Analytics',
    description: 'Help us understand how visitors interact with the website using anonymised data (Vercel Analytics).',
    required:    false,
  },
  marketing: {
    label:       'Marketing',
    description: 'Used to track visitors across websites to display relevant advertisements.',
    required:    false,
  },
  functional: {
    label:       'Functional',
    description: 'Enable enhanced functionality like chat widgets and personalised content.',
    required:    false,
  },
};

type Consent = { analytics: boolean; marketing: boolean; functional: boolean };
const CONSENT_KEY    = 'hyperlocal_cookie_consent';
const POLICY_VERSION = '2024-01';

export function CookieBanner() {
  const [show,      setShow]      = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const [consent,   setConsent]   = useState<Consent>({
    analytics: false, marketing: false, functional: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setShow(true);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      // Re-show banner if policy version changed
      if (parsed.version !== POLICY_VERSION) setShow(true);
    } catch (e) {
      setShow(true);
    }
  }, []);

  function saveConsent(choice: Consent) {
    const record = {
      categories:  { necessary: true, ...choice },
      grantedAt:   new Date().toISOString(),
      version:     POLICY_VERSION,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));

    // Fire analytics only if consented — PDPA compliant
    if (choice.analytics) {
      window.dispatchEvent(new CustomEvent('consent:analytics'));
    }

    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200
                 bg-white shadow-2xl md:bottom-4 md:left-4 md:right-auto
                 md:max-w-md md:rounded-2xl md:border"
    >
      <div className="p-5">
        <p className="text-sm font-semibold text-gray-900">🍪 We use cookies</p>
        <p className="mt-1 text-xs text-gray-500">
          We use cookies to improve your experience in accordance with Malaysia's{' '}
          <Link href="/privacy-policy" className="underline">PDPA 2010 (amended 2024)</Link>.
          You can choose which categories to allow.
        </p>

        {expanded && (
          <div className="mt-4 space-y-3">
            {(['analytics', 'marketing', 'functional'] as const).map((cat) => (
              <label key={cat} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent[cat]}
                  onChange={(e) => setConsent((prev) => ({ ...prev, [cat]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#01696f]
                             focus:ring-[#01696f]"
                />
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    {COOKIE_CATEGORIES[cat].label}
                  </p>
                  <p className="text-xs text-gray-400">{COOKIE_CATEGORIES[cat].description}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => saveConsent({ analytics: true, marketing: true, functional: true })}
            className="flex-1 rounded-lg bg-[#01696f] px-4 py-2 text-xs
                       font-semibold text-white hover:bg-[#01696f]/90"
          >
            Accept All
          </button>
          <button
            onClick={() => saveConsent({ analytics: false, marketing: false, functional: false })}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-xs
                       font-semibold text-gray-600 hover:bg-gray-50"
          >
            Reject All
          </button>
          {expanded ? (
            <button
              onClick={() => saveConsent(consent)}
              className="w-full rounded-lg border border-[#01696f] px-4 py-2 text-xs
                         font-semibold text-[#01696f] hover:bg-[#01696f]/5"
            >
              Save My Choices
            </button>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-xs text-gray-400 underline"
            >
              Manage preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
