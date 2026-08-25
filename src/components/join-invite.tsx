"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";

interface InviteBand {
  id: string;
  name: string;
}

type InviteStatus = "loading" | "invalid" | "ready";

/**
 * Invite acceptance flow for /join/[token].
 *
 * - Signed out: prompts to create an account (or sign in) and returns the
 *   user to this invite page afterwards, so the token survives sign-up.
 * - Signed in: claims any pre-account memberships by email first; if the
 *   user already belongs to this band, activates it and skips the form.
 * - Otherwise: shows the passcode + nickname form to join.
 */
export function JoinInvite({ inviteToken }: { inviteToken: string }) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  const [band, setBand] = useState<InviteBand | null>(null);
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [membershipChecked, setMembershipChecked] = useState(false);

  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const joinPath = `/join/${inviteToken}`;

  // Resolve the invite token to a band so we can greet the invitee.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bands/invite/${inviteToken}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setBand(data.band);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  // Once signed in, link any pre-account memberships (matched by email),
  // then skip the join form entirely if this band is already theirs.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !band) return;
    let cancelled = false;
    fetch("/api/auth/claim-memberships", { method: "POST" })
      .then((res) => res.json())
      .then(async (data) => {
        if (cancelled) return;
        const bands = (data.bands ?? []) as { band_id: string }[];
        if (bands.some((b) => b.band_id === band.id)) {
          await fetch("/api/auth/switch-band", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bandId: band.id }),
          });
          if (!cancelled) router.push("/songs");
          return;
        }
        if (!cancelled) setMembershipChecked(true);
      })
      .catch(() => {
        // Claim failed — fall through to the form; the join API is the
        // final arbiter of membership.
        if (!cancelled) setMembershipChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, band, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/bands/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken, passcode, nickname }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.push("/songs");
  }

  if (status === "invalid") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">BandBook</h1>
        <p className="text-muted mb-6 text-center max-w-xs">
          This invite link is invalid or has expired. Ask your bandmate for a
          new one.
        </p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg border border-border-light text-foreground font-semibold py-3 px-6 hover:bg-surface-alt transition"
        >
          Go to home page
        </button>
      </main>
    );
  }

  if (status === "loading" || !isLoaded || (isSignedIn && !membershipChecked)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">BandBook</h1>
        <p className="text-muted text-center">Loading your invite...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">BandBook</h1>
        <p className="text-muted mb-10 text-center max-w-xs">
          You&apos;ve been invited to join{" "}
          <strong className="text-foreground">{band?.name}</strong>. Create a
          free account (or sign in) to accept the invite.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <SignUpButton forceRedirectUrl={joinPath}>
            <button className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition">
              Create an account
            </button>
          </SignUpButton>
          <SignInButton forceRedirectUrl={joinPath}>
            <button className="w-full rounded-lg border border-border-light text-foreground font-semibold py-3 px-4 hover:bg-surface-alt transition">
              I already have an account
            </button>
          </SignInButton>
        </div>

        <p className="text-muted-dim text-xs text-center mt-6 max-w-xs">
          Used BandBook before accounts existed? Sign up with the same email
          you used back then and your bands will be linked automatically.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight mb-2">BandBook</h1>
      <p className="text-muted mb-10 text-center">
        You&apos;ve been invited to join{" "}
        <strong className="text-foreground">{band?.name}</strong>
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="text"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          required
          className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
        />

        <input
          type="text"
          placeholder="Your nickname in this band"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join Band"}
        </button>
      </form>
    </main>
  );
}
