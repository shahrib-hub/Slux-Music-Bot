import { Geist, Unbounded } from "next/font/google";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  title: {
    default: "Slux — Discord Music Bot",
    template: "%s · Slux",
  },
  description:
    "Slux is a free, feature-rich Discord music bot with Spotify, YouTube, SoundCloud, Deezer and Apple Music support — plus a real-time web dashboard.",
  applicationName: "Slux",
};

/** Applies the saved theme before first paint to avoid a flash. */
const themeBootstrap = `try{var t=localStorage.getItem("slux-theme");if(t==="light")document.documentElement.classList.add("light")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${unbounded.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
