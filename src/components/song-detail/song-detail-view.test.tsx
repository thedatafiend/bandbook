import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { SongDetail, VersionDetail } from "./shared";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, back: mockBack }),
}));

// Lazily-loaded chunks (LyricsComposer, UploadWidget) aren't under test.
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

// The audio player drives HTMLMediaElement, which jsdom doesn't implement.
vi.mock("@/components/song-detail/audio-player", () => ({
  AudioPlayer: () => <div data-testid="audio-player" />,
}));

import { SongDetailView } from "./song-detail-view";

function makeVersion(overrides: Partial<VersionDetail> = {}): VersionDetail {
  return {
    id: "v1",
    version_number: 1,
    label: null,
    audio_url: "b1/s1/v1.mp3",
    signed_audio_url: null,
    audio_duration: null,
    notes: null,
    is_current: true,
    created_at: "2026-08-01T00:00:00Z",
    created_by_member_id: "m1",
    created_by_nickname: "Alex",
    share_token: null,
    ...overrides,
  };
}

function makeSong(versions: VersionDetail[]): SongDetail {
  return {
    id: "s1",
    title: "Song One",
    status: "draft",
    bpm: null,
    current_version_id: versions.find((v) => v.is_current)?.id ?? null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    versions,
    lyric_sections: [],
  };
}

describe("SongDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the seeded versions", () => {
    render(<SongDetailView initialSong={makeSong([makeVersion()])} />);
    expect(screen.getByText("Version 1")).toBeInTheDocument();
    expect(screen.getByText("Versions (1)")).toBeInTheDocument();
  });

  it("adopts fresh server data when initialSong changes", () => {
    // Regression test: a router.refresh() or a back/forward restore re-renders
    // this island with a new initialSong. Seeded state must not keep showing
    // the old version list (hiding versions uploaded since the first render).
    const first = makeSong([makeVersion()]);
    const { rerender } = render(<SongDetailView initialSong={first} />);
    expect(screen.queryByText("Version 2")).not.toBeInTheDocument();

    const second = makeSong([
      makeVersion({ id: "v2", version_number: 2, is_current: true }),
      makeVersion({ is_current: false }),
    ]);
    rerender(<SongDetailView initialSong={second} />);

    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Versions (2)")).toBeInTheDocument();
  });

  it("keeps showing the same song when re-rendered with an identical object", () => {
    const song = makeSong([makeVersion()]);
    const { rerender } = render(<SongDetailView initialSong={song} />);
    rerender(<SongDetailView initialSong={song} />);
    expect(screen.getByText("Version 1")).toBeInTheDocument();
  });
});
