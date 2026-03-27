"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface BandInfo {
  name: string;
  invite_token: string;
}

interface MemberInfo {
  id: string;
  nickname: string;
  created_at: string;
  last_active_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [band, setBand] = useState<BandInfo | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [authRes, membersRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/bands/members"),
    ]);
    const authData = await authRes.json();
    const membersData = await membersRes.json();

    setBand(authData.band);
    setMembers(membersData.members ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push("/songs")}
          className="text-zinc-400 hover:text-white transition"
          aria-label="Back to songs"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Band Settings</h1>
      </header>

      <div className="flex flex-col gap-8">
        <InviteLinkSection
          inviteToken={band?.invite_token ?? ""}
          onRegenerate={(newToken) =>
            setBand((b) => (b ? { ...b, invite_token: newToken } : b))
          }
        />
        <ChangePasscodeSection />
        <MembersSection members={members} />
      </div>
    </main>
  );
}

function InviteLinkSection({
  inviteToken,
  onRegenerate,
}: {
  inviteToken: string;
  onRegenerate: (newToken: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${inviteToken}`
      : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my band on BandBook",
          text: "Join my band on BandBook! You'll need the passcode to get in.",
          url: inviteUrl,
        });
      } catch {
        // User cancelled share — ignore
      }
    } else {
      copyLink();
    }
  }

  async function handleRegenerate() {
    if (!confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }

    setRegenerating(true);
    const res = await fetch("/api/bands/regenerate-invite", { method: "POST" });
    const data = await res.json();
    setRegenerating(false);
    setConfirmRegenerate(false);

    if (res.ok && data.invite_token) {
      onRegenerate(data.invite_token);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Invite Link</h2>
      <p className="text-zinc-400 text-sm mb-4">
        Share this link with bandmates. They&apos;ll also need the passcode to
        join.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-zinc-300 truncate select-all">
          {inviteUrl}
        </div>
        <button
          onClick={copyLink}
          className="shrink-0 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-3 text-sm text-zinc-300 hover:bg-zinc-700 transition"
          aria-label="Copy invite link"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={shareLink}
          className="rounded-lg bg-white text-black font-semibold py-2.5 px-4 text-sm hover:bg-zinc-200 transition"
        >
          Share Link
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="rounded-lg border border-zinc-600 text-zinc-300 py-2.5 px-4 text-sm hover:bg-zinc-800 transition disabled:opacity-50"
        >
          {regenerating
            ? "Regenerating..."
            : confirmRegenerate
              ? "Are you sure? Old link will stop working"
              : "Regenerate Link"}
        </button>
        {confirmRegenerate && (
          <button
            onClick={() => setConfirmRegenerate(false)}
            className="text-zinc-500 text-sm hover:text-white transition"
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

function ChangePasscodeSection() {
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const res = await fetch("/api/bands/change-passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPasscode, newPasscode }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setSuccess(true);
    setCurrentPasscode("");
    setNewPasscode("");
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Change Passcode</h2>
      <p className="text-zinc-400 text-sm mb-4">
        Changing the passcode won&apos;t kick out existing members, but new
        members will need the updated passcode.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Current passcode"
          value={currentPasscode}
          onChange={(e) => setCurrentPasscode(e.target.value)}
          required
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
        <input
          type="text"
          placeholder="New passcode (4–8 characters)"
          value={newPasscode}
          onChange={(e) => setNewPasscode(e.target.value)}
          minLength={4}
          maxLength={8}
          required
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && (
          <p className="text-green-400 text-sm">Passcode updated!</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg border border-zinc-600 text-zinc-200 font-semibold py-2.5 px-4 text-sm hover:bg-zinc-800 transition disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update Passcode"}
        </button>
      </form>
    </section>
  );
}

function MembersSection({ members }: { members: MemberInfo[] }) {
  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatRelative(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">
        Members ({members.length})
      </h2>

      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3"
          >
            <div>
              <p className="text-white font-medium">{m.nickname}</p>
              <p className="text-zinc-500 text-xs">
                Joined {formatDate(m.created_at)}
              </p>
            </div>
            <p className="text-zinc-500 text-xs">
              Active {formatRelative(m.last_active_at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
