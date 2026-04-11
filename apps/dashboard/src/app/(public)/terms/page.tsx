// apps/dashboard/src/app/(public)/terms/page.tsx
import React from 'react';

export default function TermsOfServicePage() {
  return (
    <div className="bg-white min-h-screen py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-[#01696f]">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: April 9, 2026</p>
        
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Service Description</h2>
          <p className="text-gray-600 mb-4">
            Hyperlocal provides a Merchant Operating System including POS, Inventory, Accounting, and AI-powered automation tools. 
            By using our services, you agree to these terms.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Governing Law</h2>
          <p className="text-gray-600 mb-4">
            These terms are governed by the laws of Malaysia. Any disputes shall be settled in the courts of Kuala Lumpur.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Payment Terms</h2>
          <p className="text-gray-600 mb-4">
            Subscriptions are billed monthly or annually. Failure to pay may result in suspension of services. 
            Refunds are at our discretion.
          </p>
        </section>

        <div className="mt-16 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-400 italic">
            This is a summary of our Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
