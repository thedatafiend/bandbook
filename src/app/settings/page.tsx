"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  const [sessionExpired, setSessionExpired] = useState(false);

  const fetchData = useCallback(async () => {
    const authRes = await fetch("/api/auth/me");

    if (authRes.status === 401) {
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    const authData = await authRes.json();

    if (!authData.member) {
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    const membersRes = await fetch("/api/bands/members");
    const membersData = await membersRes.json();

    setSessionExpired(false);
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
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  if (sessionExpired) {
    router.push("/sign-in");
    return null;
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-lg mx-auto w-full">
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push("/songs")}
          className="text-muted hover:text-foreground transition"
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
        <BandNameSection
          currentName={band?.name ?? ""}
          onUpdate={(newName) => setBand((b) => b ? { ...b, name: newName } : b)}
        />
        <InviteLinkSection
          inviteToken={band?.invite_token ?? ""}
          onRegenerate={(newToken) =>
            setBand((b) => (b ? { ...b, invite_token: newToken } : b))
          }
        />
        <ChangePasscodeSection />
        <MembersSection members={members} />

        {/* More Bands */}
        <section>
          <h2 className="text-lg font-semibold mb-3">More Bands</h2>
          <p className="text-muted text-sm mb-4">
            Create a new band or join another one with an invite code.
          </p>
          <div className="flex gap-3">
            <a
              href="/?action=create"
              className="flex-1 text-center rounded-lg bg-accent text-white font-semibold py-2.5 px-4 text-sm hover:bg-accent-hover transition"
            >
              Create a Band
            </a>
            <a
              href="/?action=join"
              className="flex-1 text-center rounded-lg border border-border-light text-foreground font-semibold py-2.5 px-4 text-sm hover:bg-surface-alt transition"
            >
              Join a Band
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function BandNameSection({
  currentName,
  onUpdate,
}: {
  currentName: string;
  onUpdate: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    if (trimmed === currentName) {
      setEditing(false);
      return;
    }

    setError("");
    setSaving(true);
    const res = await fetch("/api/bands/name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    onUpdate(trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setName(currentName);
      setEditing(false);
      setError("");
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Band Name</h2>
      {editing ? (
        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent text-white font-semibold py-2 px-4 text-sm hover:bg-accent-hover transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setName(currentName); setEditing(false); setError(""); }}
              className="text-muted text-sm hover:text-foreground transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg bg-surface border border-border px-4 py-3">
          <span className="text-foreground font-medium">{currentName}</span>
          <button
            onClick={() => setEditing(true)}
            className="text-muted text-sm hover:text-foreground transition"
          >
            Edit
          </button>
        </div>
      )}
    </section>
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
          text: "Join my band on BandBook! Create a free account, then use the passcode to join.",
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
      <p className="text-muted text-sm mb-4">
        Share this link with bandmates. They&apos;ll need to create a free
        account first, then use the band passcode to join.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-lg bg-surface border border-border px-4 py-3 text-sm text-muted truncate select-all">
          {inviteUrl}
        </div>
        <button
          onClick={copyLink}
          className="shrink-0 rounded-lg bg-surface border border-border px-3 py-3 text-sm text-muted hover:bg-surface-alt transition"
          aria-label="Copy invite link"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={shareLink}
          className="rounded-lg bg-accent text-white font-semibold py-2.5 px-4 text-sm hover:bg-accent-hover transition"
        >
          Share Link
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="rounded-lg border border-border-light text-muted py-2.5 px-4 text-sm hover:bg-surface-alt transition disabled:opacity-50"
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
            className="text-muted-dim text-sm hover:text-foreground transition"
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
      <p className="text-muted text-sm mb-4">
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
          className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <input
          type="text"
          placeholder="New passcode (4–8 characters)"
          value={newPasscode}
          onChange={(e) => setNewPasscode(e.target.value)}
          minLength={4}
          maxLength={8}
          required
          className="rounded-lg bg-surface-alt border border-border px-4 py-3 text-foreground placeholder:text-muted-dim focus:outline-none focus:ring-2 focus:ring-accent/40"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && (
          <p className="text-emerald-400 text-sm">Passcode updated!</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg border border-border-light text-foreground font-semibold py-2.5 px-4 text-sm hover:bg-surface-alt transition disabled:opacity-50"
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
            className="flex items-center justify-between rounded-lg bg-surface border border-border px-4 py-3"
          >
            <div>
              <p className="text-foreground font-medium">{m.nickname}</p>
              <p className="text-muted-dim text-xs">
                Joined {formatDate(m.created_at)}
              </p>
            </div>
            <p className="text-muted-dim text-xs">
              Active {formatRelative(m.last_active_at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
