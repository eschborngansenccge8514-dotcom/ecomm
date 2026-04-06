# Project Summary: Hyperlocal Merchant Operating System

This documentation provides a comprehensive overview of the **Hyperlocal Merchant Operating System**, its applications, technical stack, and core integrations.

---

## 🏗️ Core Architecture & Applications

The platform is built as a **pnpm monorepo**, consisting of specialized applications and shared packages for maximum scalability and code reuse.

### 1. **Merchant Dashboard** (`apps/dashboard`)
The central hub for merchants to manage their business operations.
- **Framework**: Next.js 16 (App Router), React 19.
- **Core Features**:
    - **Operations & Orders**: Real-time order management, fulfillment tracking, and advanced inventory control.
    - **Product Catalog**: Multi-category product management with support for variants and stock tracking.
    - **POS (Point-of-Sale)**: A web-based interface for in-person sales, integrated with Central Inventory and reporting.
    - **E-Invoice Compliance**: Automated regulatory e-invoicing for major markets (including MyInvois for Malaysia).
    - **CRM & Loyalty**: Customer database, engagement tools, and loyalty/rewards management.
    - **Analytics**: Deep business insights, sales reports, and performance tracking using Recharts.
    - **AI Merchant Assistant**: A generative AI agent that helps merchants manage their shop and answer business queries.

### 2. **Consumer Mobile App** (`apps/hyperlocal-app`)
The storefront for customers to shop from local merchants.
- **Framework**: Expo 54, React Native 0.81, Expo Router.
- **Core Features**:
    - **Hyperlocal Browsing**: Location-based discovery of stores and products.
    - **Seamless Checkout**: Integrated payment gateways and logistics/delivery tracking.
    - **Order Tracking**: Real-time updates from order placement to delivery.
    - **AI Support**: Integrated AI chatbot (powered by Google Gemini) for instant customer assistance.
    - **Loyalty Integration**: Access to merchant rewards and member-only benefits.

### 3. **Functions Worker** (`apps/functions-worker`)
A high-performance **Cloudflare Worker** that acts as an aggregator and middleware layer for third-party services.
- **Logistics**: Aggregator for EasyParcel (shipping) and Lalamove (on-demand delivery).
- **Payments**: Unified interface for Razorpay and Billplz.
- **Marketplaces**: Connectors for **Shopee**, **Lazada**, **TikTok Shop**, and **Google Merchant**.
- **Webhooks**: Handles incoming events from internal and external services.

### 4. **Supabase Backend** (`supabase`)
Provides the core infrastructure for data, auth, and backend logic.
- **Database**: PostgreSQL with complex relational schemas for multi-tenant merchant support.
- **Authentication**: Managed auth for customers, merchants, and admins.
- **Storage**: Highly scalable file storage for product images and documents.
- **Edge Functions**: Distributed logic for background tasks and data processing.

---

## 🛠️ Technical Stack Breakdown

### **Frontend & UI**
- **Dashboard**: Next.js 16, React 19, Tailwind CSS 4, Shadcn UI, Radix UI.
- **Mobile Application**: React Native, NativeWind (Tailwind), Reanimated.
- **State Management**: **Zustand** (store modules), TanStack Query (mobile data fetching).
- **Forms & Validation**: Zod, React Hook Form.
- **Visualization**: Recharts, TanStack Table (dashboard).

### **Backend & Infrastructure**
- **Runtime Environment**: Node.js 20, Deno (Supabase Edge), Cloudflare Workers.
- **Database Layer**: PostgreSQL (Supabase), MMKV (mobile local storage).
- **Architecture**: Custom adapters for Marketplace APIs, Logistics Aggregators, and Payment Gateways.

### **Generative AI**
- **Core SDK**: Google AI SDK (@ai-sdk/google).
- **Agents**: Custom **Support Orchestrator** and **Merchant Assistant Agent** using generative AI for natural language interactions, business insights, and automated customer support.

---

## 🔁 Marketplace & Service Integrations

The system features deep integrations with major regional and global providers:
- **Logistics Providers**: EasyParcel, Lalamove.
- **Payment Gateways**: Razorpay, Billplz.
- **Digital Marketplaces**: Shopee, Lazada, TikTok Shop, Google Merchant Center.
- **Regulatory Compliance**: MyInvois (Government E-Invoice platform).

---

## 📂 Repository Structure

```text
├── apps/
│   ├── dashboard/           # Next.js Merchant Dashboard & POS
│   ├── hyperlocal-app/      # Expo Mobile Consumer App
│   ├── einvoice-service/    # Dedicated e-invoice processing service
│   └── functions-worker/    # Cloudflare Worker Aggregator
├── packages/
│   ├── db/                  # Shared Database schemas & Drizzle logic
│   ├── domain/              # Core business logic & entities
│   ├── integrations/        # 3rd party API connectors (Marketplaces)
│   ├── agent/               # GenAI Merchant Assistant logic
│   └── support-agent/       # GenAI Customer Support system
└── supabase/                # Migrations & Edge Functions
```
