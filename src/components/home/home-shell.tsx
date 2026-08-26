"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { CreateBandForm } from "@/components/create-band-form";
import { JoinBandForm } from "@/components/join-band-form";
import { LogoMark } from "@/components/logo";

interface UserBand {
  member_id: string;
  band_id: string;
  band_name: string;
  nickname: string;
}

type Mode = "home" | "create" | "join";

/**
 * Client island for the landing page: auth-dependent CTAs, membership
 * claiming, the band picker, and the create/join forms. The static
 * marketing sections arrive server-rendered via the howItWorks/features
 * slots and are passed through untouched.
 */
export function HomeShell({
  howItWorks,
  features,
}: {
  howItWorks: React.ReactNode;
  features: React.ReactNode;
}) {
  return (
    <Suspense>
      <HomeContent howItWorks={howItWorks} features={features} />
    </Suspense>
  );
}

function HomeContent({
  howItWorks,
  features,
}: {
  howItWorks: React.ReactNode;
  features: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();

  // Allow deep-linking to create/join via ?action=create or ?action=join
  const actionParam = searchParams.get("action");
  const initialMode = actionParam === "create" || actionParam === "join" ? actionParam : "home";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [userBands, setUserBands] = useState<UserBand[]>([]);
  const [claimDone, setClaimDone] = useState(false);
  const actionRef = useRef<HTMLDivElement>(null);

  // Claiming runs for signed-in users who didn't deep-link to create/join;
  // it's "in flight" until the effect below finishes. Derived, so the
  // effect never sets state synchronously.
  const willClaim =
    isLoaded &&
    !!isSignedIn &&
    actionParam !== "create" &&
    actionParam !== "join";
  const claiming = willClaim && !claimDone;

  // After auth, claim any unclaimed memberships and load user's bands
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    // Skip auto-redirect when user explicitly navigated here to create/join
    if (actionParam === "create" || actionParam === "join") return;

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
      .finally(() => setClaimDone(true));
  }, [isLoaded, isSignedIn, actionParam, router]);

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
        <LogoMark size={64} decorative className="mb-4" />
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

      {/* Band Picker (shown when signed-in user has multiple bands) */}
      {isSignedIn && userBands.length > 1 && (
        <section className="w-full max-w-lg mb-16">
          <div className="rounded-xl glass p-6 flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-1">Welcome Back</h2>
            <p className="text-muted text-sm mb-5">
              Pick up where you left off.
            </p>
            <div className="flex flex-col gap-3 w-full">
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
                  className="w-full text-left rounded-lg border border-border-light text-foreground font-semibold py-3 px-4 hover:bg-surface-alt transition flex items-center justify-between"
                >
                  <div>
                    <span>{b.band_name}</span>
                    <p className="text-muted-dim text-xs font-normal">as {b.nickname}</p>
                  </div>
                  <svg
                    className="w-4 h-4 text-muted-dim"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Server-rendered marketing sections */}
      {howItWorks}
      {features}

      {/* Action Section */}
      <section
        ref={actionRef}
        id="get-started"
        className="w-full max-w-lg mb-16"
      >
        <div className="rounded-xl glass p-6 flex flex-col items-center">
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
