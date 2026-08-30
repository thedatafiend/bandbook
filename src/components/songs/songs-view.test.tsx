import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { SongCard } from "@/components/song-list-item";

const routerMock = {
  back: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { SongsView } from "./songs-view";

const songs: SongCard[] = [
  {
    id: "s1",
    title: "Midnight Drive",
    status: "in-progress",
    version_count: 2,
    has_lyrics: true,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
  },
];

describe("SongsView", () => {
  let now: number;

  beforeEach(() => {
    vi.clearAllMocks();
    now = 100_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the band header and songs from server props", () => {
    render(
      <SongsView initialSongs={songs} bandName="The Owls" nickname="Ryan" />
    );
    expect(screen.getByText("The Owls")).toBeInTheDocument();
    expect(screen.getByText("Midnight Drive")).toBeInTheDocument();
  });

  it("re-syncs server data on mount so a cached back-navigation never shows stale statuses", () => {
    render(
      <SongsView initialSongs={songs} bandName="The Owls" nickname="Ryan" />
    );
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("re-syncs server data when the tab regains focus", () => {
    render(
      <SongsView initialSongs={songs} bandName="The Owls" nickname="Ryan" />
    );
    routerMock.refresh.mockClear();

    now += 5_000;
    window.dispatchEvent(new Event("focus"));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });
});
