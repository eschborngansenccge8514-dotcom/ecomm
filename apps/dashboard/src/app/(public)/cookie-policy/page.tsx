// apps/dashboard/src/app/(public)/cookie-policy/page.tsx
import React from 'react';

export default function CookiePolicyPage() {
  return (
    <div className="bg-white min-h-screen py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-[#01696f]">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: April 9, 2026</p>
        
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. What are Cookies?</h2>
          <p className="text-gray-600 mb-4">
            Cookies are small text files stored on your device that help us provide and improve our services.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Cookie Categories</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Strictly Necessary</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Essential for security and core site functionality.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Analytics</td>
                  <td className="px-6 py-4 text-sm text-gray-500">To understand site usage and performance.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Marketing</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Used for tracking across sites to deliver relevant ads.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Managing Preferences</h2>
          <p className="text-gray-600 mb-4">
            You can manage your cookie preferences at any time using the cookie banner settings on our website.
          </p>
        </section>

        <div className="mt-16 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-400 italic">
            This policy is part of our commitment to transparency under PDPA 2024.
          </p>
        </div>
      </div>
    </div>
  );
}
