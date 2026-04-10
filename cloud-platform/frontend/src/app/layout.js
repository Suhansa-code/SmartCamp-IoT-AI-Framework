import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from '@/components/psychoedu/context/LanguageContext'

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Smart Camp Box",
  description: "Integrated platform for hazard, resources, and psycho educational support",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* Critical for correct scaling on every mobile + tablet */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#F0F9FF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body style={{ fontFamily: "'Nunito', sans-serif", margin: 0, padding: 0, WebkitTapHighlightColor: 'transparent' }} className="min-h-full flex flex-col">
        {/*
          LanguageProvider reads ?lang= URL param and localStorage on mount.
          It makes { lang, setLang } available to all child components via useLang().
        */}
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

