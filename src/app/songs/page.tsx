"use client";

import { useEffect, useState } from "react";

interface MemberInfo {
  nickname: string;
}

interface BandInfo {
  name: string;
  invite_token: string;
}

export default function SongsPage() {
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [band, setBand] = useState<BandInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setMember(data.member);
        setBand(data.band);
      });
  }, []);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{band?.name ?? "Loading..."}</h1>
          {member && (
            <p className="text-zinc-400 text-sm">Logged in as {member.nickname}</p>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-zinc-400 mb-6">No songs yet. Start creating!</p>
        <button className="rounded-lg bg-white text-black font-semibold py-3 px-6 hover:bg-zinc-200 transition">
          + New Song
        </button>
      </div>
    </main>
  );
}
