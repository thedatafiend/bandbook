import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BandBook",
  description: "A collaborative songwriting workspace for bands",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body className="min-h-full flex flex-col bg-black">
        <ClerkProvider>
          <header className="flex justify-between items-center px-6 py-3 gap-4">
            <Link href="/" className="transition hover:opacity-80" aria-label="BandBook home">
              <Logo size={28} withWordmark />
            </Link>
            <div className="flex items-center gap-4">
              <Show when="signed-out">
                <SignInButton forceRedirectUrl="/">
                  <button className="text-sm text-muted hover:text-foreground transition">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton forceRedirectUrl="/">
                  <button className="text-sm rounded-lg bg-accent text-white font-medium py-2 px-4 hover:bg-accent-hover transition">
                    Sign Up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          {children}
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  );
}
