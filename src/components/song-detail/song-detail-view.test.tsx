import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { SongDetail } from "./shared";

const routerMock = {
  back: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

// The lyrics composer is loaded via next/dynamic and irrelevant here
vi.mock("next/dynamic", () => ({
  default: () => {
    function DynamicStub() {
      return null;
    }
    return DynamicStub;
  },
}));

import { SongDetailView } from "./song-detail-view";

const baseSong: SongDetail = {
  id: "s1",
  title: "Midnight Drive",
  status: "draft",
  bpm: null,
  current_version_id: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
  versions: [],
  lyric_sections: [],
};

describe("SongDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the song title and current status", () => {
    render(<SongDetailView initialSong={baseSong} />);
    expect(screen.getByText("Midnight Drive")).toBeInTheDocument();
    expect(screen.getByTitle("Click to change status")).toHaveTextContent("Draft");
  });

  it("saves a status change and refreshes the router so the catalog list stays in sync", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    render(<SongDetailView initialSong={baseSong} />);
    fireEvent.click(screen.getByTitle("Click to change status"));
    fireEvent.click(screen.getByRole("option", { name: /Finished/ }));

    await waitFor(() => {
      expect(screen.getByTitle("Click to change status")).toHaveTextContent(
        "Finished"
      );
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/songs/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "finished" }),
    });
    // Without the refresh, navigating back to /songs serves the stale
    // Router Cache entry and the list shows the old status
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("keeps the old status and does not refresh when the save fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    render(<SongDetailView initialSong={baseSong} />);
    fireEvent.click(screen.getByTitle("Click to change status"));
    fireEvent.click(screen.getByRole("option", { name: /Finished/ }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(screen.getByTitle("Click to change status")).toHaveTextContent("Draft");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("refreshes the router after a title change", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    render(<SongDetailView initialSong={baseSong} />);
    fireEvent.click(screen.getByTitle("Click to edit"));
    const input = screen.getByDisplayValue("Midnight Drive");
    fireEvent.change(input, { target: { value: "Dawn Drive" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Dawn Drive")).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/songs/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Dawn Drive" }),
    });
    expect(routerMock.refresh).toHaveBeenCalled();
  });
});
