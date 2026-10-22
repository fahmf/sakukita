import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Saku Kita — Pencatat Keuangan Keluarga",
  description:
    "Catat keuangan keluarga dengan cepat — pemasukan, pengeluaran, budget, dan laporan dalam satu app.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Saku Kita",
  },
};

export const viewport: Viewport = {
  // Matches --background in each palette so the browser chrome blends in.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes sets the theme class on <html> before hydration
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Puts .light/.dark on <html> (system by default) — both the token
            palette and every `dark:` utility key off that class. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
        
        {/* PWA Service Worker Auto-Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('Serwist SW registered: ', reg.scope);
                  }, function(err) {
                    console.log('Serwist SW registration failed: ', err);
                  });
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
