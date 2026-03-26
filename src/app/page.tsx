"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "home" | "create" | "join";

export default function Home() {
  const [mode, setMode] = useState<Mode>("home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight mb-2">BandBook</h1>
      <p className="text-zinc-400 mb-10 text-center">
        A shared songwriting workspace for your band
      </p>

      {mode === "home" && <HomeButtons onSelect={setMode} />}
      {mode === "create" && <CreateBandForm onBack={() => setMode("home")} />}
      {mode === "join" && <JoinBandForm onBack={() => setMode("home")} />}
    </main>
  );
}

function HomeButtons({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div className="flex flex-col gap-4 w-full max-w-xs">
      <button
        onClick={() => onSelect("create")}
        className="w-full rounded-lg bg-white text-black font-semibold py-3 px-4 hover:bg-zinc-200 transition"
      >
        Create a Band
      </button>
      <button
        onClick={() => onSelect("join")}
        className="w-full rounded-lg border border-zinc-600 text-zinc-200 font-semibold py-3 px-4 hover:bg-zinc-800 transition"
      >
        Join a Band
      </button>
    </div>
  );
}

function CreateBandForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [bandName, setBandName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/bands/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bandName, passcode, nickname }),
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
        className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
      />

      <input
        type="text"
        placeholder="Passcode (4–8 characters)"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        minLength={4}
        maxLength={8}
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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-white text-black font-semibold py-3 px-4 hover:bg-zinc-200 transition disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Band"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="text-zinc-400 text-sm hover:text-white transition"
      >
        Back
      </button>
    </form>
  );
}

function JoinBandForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

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

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Join a Band</h2>

      <input
        type="text"
        placeholder="Invite code"
        value={inviteToken}
        onChange={(e) => setInviteToken(e.target.value)}
        required
        className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
      />

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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-white text-black font-semibold py-3 px-4 hover:bg-zinc-200 transition disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join Band"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="text-zinc-400 text-sm hover:text-white transition"
      >
        Back
      </button>
    </form>
  );
}
