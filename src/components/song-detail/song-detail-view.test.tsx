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
import type { VersionDetail } from "./shared";

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

  it("picks up a bandmate's status change when the tab regains focus", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ song: { ...baseSong, status: "finished" } }),
    });

    render(<SongDetailView initialSong={baseSong} />);
    expect(screen.getByTitle("Click to change status")).toHaveTextContent("Draft");

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(screen.getByTitle("Click to change status")).toHaveTextContent(
        "Finished"
      );
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/songs/s1");
  });

  it("keeps the in-player audio URL stable across a background refresh", async () => {
    const version: VersionDetail = {
      id: "v1",
      version_number: 1,
      label: null,
      audio_url: "band/s1/v1.mp3",
      signed_audio_url: "https://storage.example/v1?token=old",
      audio_duration: 120,
      notes: null,
      is_current: true,
      created_at: "2026-05-10T00:00:00.000Z",
      created_by_member_id: "m1",
      created_by_nickname: "Ryan",
      share_token: null,
    };
    const songWithVersion: SongDetail = { ...baseSong, versions: [version] };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        song: {
          ...songWithVersion,
          status: "finished",
          versions: [
            { ...version, signed_audio_url: "https://storage.example/v1?token=new" },
          ],
        },
      }),
    });

    const { container } = render(<SongDetailView initialSong={songWithVersion} />);

    window.dispatchEvent(new Event("focus"));

    // The refetched status lands…
    await waitFor(() => {
      expect(screen.getByTitle("Click to change status")).toHaveTextContent(
        "Finished"
      );
    });
    // …but the <audio> src is untouched, so playback isn't restarted
    expect(container.querySelector("audio")).toHaveAttribute(
      "src",
      "https://storage.example/v1?token=old"
    );
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
