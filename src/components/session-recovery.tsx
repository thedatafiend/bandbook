"use client";

import { useState } from "react";

interface BandResult {
  member_id: string;
  band_id: string;
  band_name: string;
  nickname: string;
}

interface SessionRecoveryProps {
  onRecovered: () => void;
}

export function SessionRecovery({ onRecovered }: SessionRecoveryProps) {
  const [email, setEmail] = useState("");
  const [bands, setBands] = useState<BandResult[] | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/recover/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    if (data.bands.length === 0) {
      setError("No bands found for that email. Try a different address.");
      return;
    }

    setBands(data.bands);

    if (data.bands.length === 1) {
      setSelectedMemberId(data.bands[0].member_id);
    }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/recover/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: selectedMemberId, passcode }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    onRecovered();
  }

  // Step 1: Email lookup
  if (bands === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xs flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-center">
            Session Expired
          </h2>
          <p className="text-muted text-sm text-center">
            Your session has expired. Enter your email and band passcode to get
            back in.
          </p>

          <form onSubmit={handleLookup} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search My Bands"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Band selection + passcode
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-center">Welcome Back</h2>

        {bands.length > 1 && (
          <>
            <p className="text-muted text-sm text-center">
              Select your band and enter the passcode.
            </p>
            <div className="flex flex-col gap-2">
              {bands.map((b) => (
                <button
                  key={b.member_id}
                  onClick={() => {
                    setSelectedMemberId(b.member_id);
                    setPasscode("");
                    setError("");
                  }}
                  className={`text-left rounded-lg border px-4 py-3 transition ${
                    selectedMemberId === b.member_id
                      ? "border-accent bg-surface-alt"
                      : "border-border bg-surface hover:bg-surface-alt"
                  }`}
                >
                  <p className="text-foreground font-medium">{b.band_name}</p>
                  <p className="text-muted-dim text-xs">as {b.nickname}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {bands.length === 1 && (
          <p className="text-muted text-sm text-center">
            Enter the passcode for{" "}
            <span className="text-foreground font-medium">
              {bands[0].band_name}
            </span>{" "}
            to reconnect.
          </p>
        )}

        {selectedMemberId && (
          <form onSubmit={handleRecover} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Band passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              required
              autoFocus
              className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition disabled:opacity-50"
            >
              {loading ? "Reconnecting..." : "Reconnect"}
            </button>
          </form>
        )}

        <button
          onClick={() => {
            setBands(null);
            setError("");
            setEmail("");
            setSelectedMemberId(null);
          }}
          className="text-muted text-sm hover:text-foreground transition text-center"
        >
          Try a different email
        </button>
      </div>
    </div>
  );
}
