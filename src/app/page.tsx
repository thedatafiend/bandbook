"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { CreateBandForm } from "@/components/create-band-form";
import { JoinBandForm } from "@/components/join-band-form";

interface UserBand {
  member_id: string;
  band_id: string;
  band_name: string;
  nickname: string;
}

type Mode = "home" | "create" | "join";

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [mode, setMode] = useState<Mode>("home");
  const [userBands, setUserBands] = useState<UserBand[]>([]);
  const [claiming, setClaiming] = useState(false);
  const actionRef = useRef<HTMLDivElement>(null);

  // After auth, claim any unclaimed memberships and load user's bands
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    setClaiming(true);
    fetch("/api/auth/claim-memberships", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.count === 1) {
          // Single band — go straight in
          router.push("/songs");
        } else if (data.count > 1) {
          setUserBands(data.bands);
        }
      })
      .catch(() => {
        // Claim failed — user can still create/join bands manually
      })
      .finally(() => setClaiming(false));
  }, [isLoaded, isSignedIn, router]);

  function scrollToAction(m: Mode) {
    setMode(m);
    setTimeout(() => {
      actionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      {/* Hero */}
      <section className="flex flex-col items-center text-center max-w-md mb-16">
        <h1 className="text-5xl font-bold tracking-tight mb-3">BandBook</h1>
        <p className="text-lg text-muted mb-8">
          A shared songwriting workspace for your band.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {isSignedIn ? (
            <>
              <button
                onClick={() => scrollToAction("create")}
                className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition"
              >
                Create a Band
              </button>
              <button
                onClick={() => scrollToAction("join")}
                className="w-full rounded-lg border border-border-light text-foreground font-semibold py-3 px-4 hover:bg-surface-alt transition"
              >
                Join a Band
              </button>
            </>
          ) : (
            <>
              <SignUpButton forceRedirectUrl="/">
                <button className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition">
                  Get Started
                </button>
              </SignUpButton>
              <SignInButton forceRedirectUrl="/">
                <button className="w-full rounded-lg border border-border-light text-foreground font-semibold py-3 px-4 hover:bg-surface-alt transition">
                  Sign In
                </button>
              </SignInButton>
            </>
          )}
        </div>

        <Link
          href="/getting-started"
          className="mt-6 text-sm text-muted hover:text-foreground transition"
        >
          Learn how it works &rarr;
        </Link>
      </section>

      {/* How It Works */}
      <section className="w-full max-w-lg mb-16">
        <h2 className="text-xl font-semibold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StepCard
            step={1}
            title="Create an Account"
            description="Sign up free with email, Google, or Facebook."
            icon={
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            }
          />
          <StepCard
            step={2}
            title="Create or Join a Band"
            description="Set a band name and passcode, or join with an invite link."
            icon={
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            }
          />
          <StepCard
            step={3}
            title="Start Writing Together"
            description="Upload recordings, write lyrics, and invite your bandmates."
            icon={
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="w-full max-w-lg mb-16">
        <h2 className="text-xl font-semibold text-center mb-8">What You Get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FeatureCard
            title="Secure Access"
            description="Sign in with your email and password. Band access is controlled with a passcode."
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            }
          />
          <FeatureCard
            title="Lyrics Composer"
            description="Structured sections — verse, chorus, bridge — with drag-and-drop reordering."
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
          />
          <FeatureCard
            title="Audio Versions"
            description="Upload rehearsal recordings, label them, and track which version is current."
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            }
          />
          <FeatureCard
            title="Revision History"
            description="Every lyrics save is tracked. View or restore any past version."
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <FeatureCard
            title="Song Status Tracking"
            description="Mark songs as Draft, In Progress, or Finished. Search and filter your catalog."
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            }
          />
          <FeatureCard
            title="Multiple Bands"
            description="One account, multiple bands. Switch between them without re-logging in."
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Band Picker (shown when user has multiple bands) */}
      {userBands.length > 1 && (
        <section className="w-full max-w-lg mb-16">
          <div className="rounded-xl bg-surface border border-border p-6 flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-2">Welcome Back</h2>
            <p className="text-muted text-sm mb-4 text-center">
              Select a band to continue.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {userBands.map((b) => (
                <button
                  key={b.member_id}
                  onClick={async () => {
                    await fetch("/api/auth/switch-band", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bandId: b.band_id }),
                    });
                    router.push("/songs");
                  }}
                  className="text-left rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-alt transition"
                >
                  <p className="text-foreground font-medium">{b.band_name}</p>
                  <p className="text-muted-dim text-xs">as {b.nickname}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Action Section */}
      <section
        ref={actionRef}
        id="get-started"
        className="w-full max-w-lg mb-16"
      >
        <div className="rounded-xl bg-surface border border-border p-6 flex flex-col items-center">
          {!isSignedIn ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-xs">
              <h2 className="text-xl font-semibold">Get Started</h2>
              <p className="text-muted text-sm text-center">
                Create a free account to start your band&apos;s songwriting workspace.
              </p>
              <SignUpButton forceRedirectUrl="/">
                <button className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition">
                  Sign Up Free
                </button>
              </SignUpButton>
              <p className="text-muted-dim text-xs text-center">
                Already have an account?{" "}
                <SignInButton forceRedirectUrl="/">
                  <button className="text-accent hover:underline">Sign in</button>
                </SignInButton>
              </p>
            </div>
          ) : (
            <>
              {mode === "home" && !claiming && (
                <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                  <h2 className="text-xl font-semibold">Get Started</h2>
                  <button
                    onClick={() => setMode("create")}
                    className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition"
                  >
                    Create a Band
                  </button>
                  <button
                    onClick={() => setMode("join")}
                    className="w-full rounded-lg border border-border-light text-foreground font-semibold py-3 px-4 hover:bg-surface-alt transition"
                  >
                    Join a Band
                  </button>
                </div>
              )}
              {mode === "create" && <CreateBandForm onBack={() => setMode("home")} />}
              {mode === "join" && <JoinBandForm onBack={() => setMode("home")} />}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-muted-dim">
        <Link
          href="/getting-started"
          className="hover:text-foreground transition"
        >
          Getting Started Guide
        </Link>
      </footer>
    </main>
  );
}

function StepCard({
  step,
  title,
  description,
  icon,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 p-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface border border-border">
        {icon}
      </div>
      <div>
        <span className="text-xs text-muted-dim font-medium uppercase tracking-wider">
          Step {step}
        </span>
        <h3 className="text-base font-semibold mt-1">{title}</h3>
        <p className="text-sm text-muted mt-1">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-surface border border-border p-4 flex gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-md bg-surface-alt flex items-center justify-center text-accent">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted mt-1">{description}</p>
      </div>
    </div>
  );
}
