"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function JoinByLink() {
  const router = useRouter();
  const params = useParams();
  const inviteToken = params.token as string;

  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/bands/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken, passcode, nickname, email }),
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
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight mb-2">BandBook</h1>
      <p className="text-zinc-400 mb-10 text-center">
        You&apos;ve been invited to join a band
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="text"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          required
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
        />

        <input
          type="text"
          placeholder="Your nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
        />

        <input
          type="email"
          placeholder="Email (for session recovery)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white text-black font-semibold py-3 px-4 hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join Band"}
        </button>
      </form>
    </main>
  );
}
