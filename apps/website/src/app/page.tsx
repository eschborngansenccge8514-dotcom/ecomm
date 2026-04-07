import React from 'react'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Features from '@/components/Features'
import { AIHighlight, CTASection } from '@/components/AIAndCTA'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Navigation */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <Hero />

        {/* Features Section */}
        <Features />

        {/* AI Highlight Section */}
        <AIHighlight />

        {/* CTA Section */}
        <CTASection />
      </main>

      {/* Footer Section */}
      <Footer />
    </div>
  )
}
