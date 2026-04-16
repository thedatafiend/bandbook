import Link from "next/link";

export const metadata = {
  title: "Getting Started — BandBook",
  description: "Learn how to use BandBook, a shared songwriting workspace for your band.",
};

const tocItems = [
  { id: "creating-an-account", label: "Creating an Account" },
  { id: "creating-a-band", label: "Creating a Band" },
  { id: "joining-a-band", label: "Joining a Band" },
  { id: "song-catalog", label: "Your Song Catalog" },
  { id: "creating-songs", label: "Creating Songs" },
  { id: "audio-versions", label: "Audio Versions" },
  { id: "lyrics-composer", label: "Lyrics Composer" },
  { id: "revision-history", label: "Revision History" },
  { id: "band-settings", label: "Band Settings" },
];

export default function GettingStartedPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition"
          >
            &larr; Back to home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-4">
            Getting Started
          </h1>
          <p className="text-muted mt-2">
            Everything you need to know to use BandBook with your band.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 flex flex-wrap gap-2">
          {tocItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-xs rounded-full border border-border px-3 py-1.5 text-muted hover:text-foreground hover:border-border-light transition"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Sections */}
        <div className="flex flex-col gap-12">
          {/* Creating an Account */}
          <Section id="creating-an-account" title="Creating an Account">
            <p>
              The first step is to create a free BandBook account. Tap{" "}
              <strong>Get Started</strong>{" "}on the home page and sign up with
              your email and a password, or use Google or Facebook.
            </p>
            <p>
              Your account is how you sign in across devices and manage all
              your bands in one place.
            </p>
            <Tip>
              Already had a band before accounts were introduced? Sign up with
              the <strong>same email</strong>{" "}you used originally and your
              existing bands will be linked to your new account automatically.
              If you sign up with Google or Facebook, make sure the email on
              that account matches the one you used before.
            </Tip>
          </Section>

          {/* Creating a Band */}
          <Section id="creating-a-band" title="Creating a Band">
            <p>
              Once you&apos;re signed in, tap <strong>Create a Band</strong>{" "}
              on the home page. You&apos;ll need three things:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              <li>
                <strong className="text-foreground">Band name</strong> — whatever
                your band is called
              </li>
              <li>
                <strong className="text-foreground">Passcode</strong> — a shared
                code (4–8 characters) that your bandmates will use to join
              </li>
              <li>
                <strong className="text-foreground">Nickname</strong> — how you
                want to appear in this band
              </li>
            </ul>
            <Tip>
              Pick a passcode that&apos;s easy for your bandmates to remember but
              not obvious to others. Everyone in the band shares the same
              passcode.
            </Tip>
            <p>
              Once you create the band, you&apos;ll get a shareable invite link
              to send to your bandmates.
            </p>
          </Section>

          {/* Joining a Band */}
          <Section id="joining-a-band" title="Joining a Band">
            <p>
              To join a band, you&apos;ll need a BandBook account first. Once
              signed in, there are two ways to join:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              <li>
                <strong className="text-foreground">Via invite link</strong> —
                your bandmate sends you a link, and you enter the band passcode
                and a nickname
              </li>
              <li>
                <strong className="text-foreground">Manually</strong> — tap{" "}
                <strong>Join a Band</strong>{" "}on the home page and enter the
                invite code, passcode, and your nickname
              </li>
            </ul>
            <p>
              Once you join, you&apos;ll have full access to all of the
              band&apos;s songs, recordings, and lyrics.
            </p>
          </Section>

          {/* Song Catalog */}
          <Section id="song-catalog" title="Your Song Catalog">
            <p>
              The song catalog is your band&apos;s central hub. Every song your
              band creates shows up here with its status, version count, and when
              it was last updated.
            </p>
            <p>You can organize your catalog with:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              <li>
                <strong className="text-foreground">Search</strong> — find songs
                by title
              </li>
              <li>
                <strong className="text-foreground">Filter by status</strong> —
                show only Draft, In Progress, or Finished songs
              </li>
              <li>
                <strong className="text-foreground">Sort</strong> — by last
                updated, title (A–Z), or date created
              </li>
            </ul>
            <p>
              Each song card shows a status badge, how many audio versions it
              has, whether it has lyrics, and when it was last updated.
            </p>
          </Section>

          {/* Creating Songs */}
          <Section id="creating-songs" title="Creating Songs">
            <p>
              There are two ways to start a new song, depending on what you have
              first:
            </p>

            <h3 className="text-sm font-semibold mt-4 mb-2">
              Start with Lyrics
            </h3>
            <p>
              Just enter a song title and you&apos;re in. You can start writing
              lyrics immediately and add audio later.
            </p>

            <h3 className="text-sm font-semibold mt-4 mb-2">
              Upload a Recording
            </h3>
            <p>
              Select an audio file from your device first. Then choose whether to
              create a brand new song or add the recording to an existing one.
            </p>
            <Tip>
              Use &quot;Upload a Recording&quot; when you&apos;ve just finished
              rehearsal and want to capture what you played. Use &quot;Start with
              Lyrics&quot; when you have words but no demo yet.
            </Tip>
          </Section>

          {/* Audio Versions */}
          <Section id="audio-versions" title="Audio Versions">
            <p>
              Each song can have multiple audio recordings — rehearsal takes,
              demos, rough mixes, or anything else. Every time you upload a
              recording to a song, it becomes a new version.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              <li>
                <strong className="text-foreground">Label</strong>{" "}your versions
                to tell them apart (e.g., &quot;Garage rehearsal 3/15&quot;,
                &quot;Studio demo&quot;)
              </li>
              <li>
                <strong className="text-foreground">Add notes</strong>{" "}to
                remember what&apos;s different about each take
              </li>
              <li>
                Set any version as{" "}
                <strong className="text-foreground">current</strong> — the one
                your band considers the definitive recording
              </li>
              <li>
                Versions are <strong className="text-foreground">never deleted</strong> — your
                recordings are always safe
              </li>
            </ul>
            <Tip>
              Supported formats: .m4a, .mp3, .wav, .aac, .ogg (up to 500 MB per
              file).
            </Tip>
          </Section>

          {/* Lyrics Composer */}
          <Section id="lyrics-composer" title="Lyrics Composer">
            <p>
              The lyrics composer lets you write structured lyrics organized by
              section. Instead of one big text block, your lyrics are broken into
              labeled parts.
            </p>

            <h3 className="text-sm font-semibold mt-4 mb-2">Section Types</h3>
            <p>Each section gets a color-coded badge:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge color="bg-blue-600/30 text-blue-300">Verse</Badge>
              <Badge color="bg-fuchsia-600/30 text-fuchsia-300">Chorus</Badge>
              <Badge color="bg-violet-600/30 text-violet-300">Pre-Chorus</Badge>
              <Badge color="bg-amber-600/30 text-amber-300">Bridge</Badge>
              <Badge color="bg-emerald-600/30 text-emerald-300">Intro</Badge>
              <Badge color="bg-rose-600/30 text-rose-300">Outro</Badge>
              <Badge color="bg-gray-600/30 text-gray-300">Custom</Badge>
            </div>

            <h3 className="text-sm font-semibold mt-4 mb-2">
              Editing Features
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              <li>Add new sections and pick their type</li>
              <li>Write multi-line text in each section</li>
              <li>Drag and drop to reorder sections</li>
              <li>Duplicate or delete any section</li>
            </ul>
            <Tip>
              Lyrics auto-save as you type. Every save creates a revision you can
              go back to later.
            </Tip>
          </Section>

          {/* Revision History */}
          <Section id="revision-history" title="Revision History">
            <p>
              Every time lyrics are saved, BandBook creates a snapshot of all
              your sections. You can browse the full history to see:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              <li>When each revision was made</li>
              <li>Who made the changes</li>
              <li>What the lyrics looked like at that point</li>
            </ul>
            <p>
              If you want to go back to a previous version, just tap{" "}
              <strong>Restore</strong> — it becomes your current lyrics (and
              creates a new revision, so nothing is lost).
            </p>
          </Section>

          {/* Band Settings */}
          <Section id="band-settings" title="Band Settings">
            <p>
              In Settings, any member can manage the band:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              <li>
                <strong className="text-foreground">Change the band name</strong>
              </li>
              <li>
                <strong className="text-foreground">View or share the invite link</strong>{" "}
                — copy it to send to new members
              </li>
              <li>
                <strong className="text-foreground">Regenerate the invite link</strong>{" "}
                — the old one will stop working
              </li>
              <li>
                <strong className="text-foreground">Change the passcode</strong>{" "}
                — existing members stay signed in, but new members will need the
                updated passcode to join
              </li>
              <li>
                <strong className="text-foreground">See all members</strong>{" "}
                — with nicknames, join dates, and last activity
              </li>
            </ul>
            <Tip>
              To manage your account (email, password, connected accounts), click
              your profile icon in the top right corner.
            </Tip>
          </Section>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 mb-8 rounded-xl glass p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Ready to start?</h2>
          <p className="text-muted text-sm mb-6">
            Create a free account and start your band&apos;s songwriting workspace.
          </p>
          <Link
            href="/#get-started"
            className="inline-block rounded-lg bg-accent text-white font-semibold py-3 px-6 hover:bg-accent-hover transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 text-sm text-muted [&>p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg glass p-4 text-sm text-muted">
      <span className="font-medium text-foreground">Tip: </span>
      {children}
    </div>
  );
}

function Badge({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${color}`}>
      {children}
    </span>
  );
}
