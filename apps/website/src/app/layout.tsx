import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Senang Store | E-Commerce Made Easy",
  description: "The all-in-one e-commerce platform for modern merchants. Manage your store, AI agents, and local delivery with ease.",
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
