import "./globals.css";
import { SideNavProvider } from "@/components/common/SideNav";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { NotificationsProvider } from "@/components/common/NotificationsContext";

export const metadata = {
  title: "Smart Camp Box",
  description: "Integrated platform for hazard, resources, and psycho educational support",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Sinhala:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="theme-color" content="#F0F9FF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body style={{ fontFamily: "'Inter', 'Noto Sans Sinhala', sans-serif", margin: 0, padding: 0, WebkitTapBackgroundColor: 'transparent' }} className="min-h-full flex flex-col">
        <ThemeProvider>
          <NotificationsProvider>
            <SideNavProvider>{children}</SideNavProvider>
          </NotificationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

