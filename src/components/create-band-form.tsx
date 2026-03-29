"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateBandForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [bandName, setBandName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/bands/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bandName, passcode, nickname, email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.push("/songs");
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Create a Band</h2>

      <input
        type="text"
        placeholder="Band name"
        value={bandName}
        onChange={(e) => setBandName(e.target.value)}
        required
        className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
      />

      <input
        type="text"
        placeholder="Passcode (4–8 characters)"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        minLength={4}
        maxLength={8}
        required
        className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
      />

      <input
        type="text"
        placeholder="Your nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
        className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
      />

      <input
        type="email"
        placeholder="Email (for session recovery)"
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
        {loading ? "Creating..." : "Create Band"}
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
