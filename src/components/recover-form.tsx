"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BandResult {
  member_id: string;
  band_id: string;
  band_name: string;
  nickname: string;
}

export function RecoverForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
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

    setBands(data.bands);
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

    router.push("/songs");
  }

  // Step 1: Email lookup
  if (bands === null) {
    return (
      <form onSubmit={handleLookup} className="w-full max-w-xs flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Return to My Bands</h2>
        <p className="text-muted text-sm">
          Enter the email you used when you joined.
        </p>

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
          {loading ? "Searching..." : "Find My Bands"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="text-muted text-sm hover:text-foreground transition"
        >
          Back
        </button>
      </form>
    );
  }

  // Empty state
  if (bands.length === 0) {
    return (
      <div className="w-full max-w-xs flex flex-col gap-4">
        <h2 className="text-xl font-semibold">No Bands Found</h2>
        <p className="text-muted text-sm">
          No bands were found for that email. You may have used a different
          address, or you might need to join a band first.
        </p>
        <button
          onClick={() => {
            setBands(null);
            setError("");
          }}
          className="w-full rounded-lg border border-border-light text-foreground font-semibold py-3 px-4 hover:bg-surface-alt transition"
        >
          Try Another Email
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-muted text-sm hover:text-foreground transition"
        >
          Back
        </button>
      </div>
    );
  }

  // Step 2: Band selection + passcode
  return (
    <div className="w-full max-w-xs flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Your Bands</h2>
      <p className="text-muted text-sm">
        Select a band and enter its passcode to rejoin.
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

      {selectedMemberId && (
        <form onSubmit={handleRecover} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Band passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
            className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent text-white font-semibold py-3 px-4 hover:bg-accent-hover transition disabled:opacity-50"
          >
            {loading ? "Recovering..." : "Rejoin Band"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onBack}
        className="text-muted text-sm hover:text-foreground transition"
      >
        Back
      </button>
    </div>
  );
}
