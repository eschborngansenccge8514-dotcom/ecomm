// apps/dashboard/src/app/(public)/privacy-policy/page.tsx
import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white min-h-screen py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-[#01696f]">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: April 9, 2026 | Version: 2024-01</p>
        
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Identity and Contact Details</h2>
          <p className="text-gray-600 mb-4">
            Hyperlocal Technologies Sdn Bhd ("we," "us," or "our") is the data controller responsible for your personal data. 
            If you have any questions about this privacy policy or our data protection practices, please contact our Data Protection Officer (DPO) at <strong>privacy@hyperlocal.app</strong>.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Compliance with PDPA 2010 (Amended 2024)</h2>
          <p className="text-gray-600 mb-4">
            We are committed to protecting your personal data in accordance with Malaysia's Personal Data Protection Act 2010 (PDPA) as amended in 2024. 
            This policy outlines how we collect, use, and process your data.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Data We Collect</h2>
          <p className="text-gray-600 mb-4">
            We collect personal data including your name, contact information, business details, and financial transaction data necessary for the operation of the Hyperlocal Merchant OS.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Your Rights</h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Right to access your personal data</li>
            <li>Right to correction of inaccurate data</li>
            <li>Right to withdraw consent for processing</li>
            <li>Right to data portability</li>
          </ul>
        </section>

        <div className="mt-16 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-400 italic">
            This is a summary of our privacy policy for demonstration purposes. Full policy is available upon request.
          </p>
        </div>
      </div>
    </div>
  );
}
