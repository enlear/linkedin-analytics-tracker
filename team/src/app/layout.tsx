import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { ThemeProvider, themeBootstrapScript } from "@/components/theme/theme-provider";
import "./globals.css";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Lets macOS/iOS launch the saved app without Safari chrome, matching the
  // standalone window Chrome gives on desktop.
  appleWebApp: {
    capable: true,
    title: siteConfig.shortName,
    statusBarStyle: "default",
  },
};

/**
 * Browser/OS chrome colour. Two entries so the installed window's title bar
 * follows the theme instead of showing a light bar above a dark app; the
 * values are the app's own --background in each mode.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read theme from cookie SERVER-SIDE so the SSR HTML already carries
  // <html class="dark">. Without this, the client bootstrap script's added
  // class gets stripped by React's hydration in production, causing the
  // dark→light flip on refresh.
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen bg-background antialiased" suppressHydrationWarning>
        <ThemeProvider initialTheme={theme}>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
