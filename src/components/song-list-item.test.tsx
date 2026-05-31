import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { SongListItem, type SongCard } from "./song-list-item";

const baseSong: SongCard = {
  id: "s1",
  title: "Midnight Drive",
  status: "in-progress",
  version_count: 2,
  has_lyrics: true,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
};

describe("SongListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the song title and links to the detail page", () => {
    render(<SongListItem song={baseSong} onDeleted={vi.fn()} />);
    expect(screen.getByText("Midnight Drive")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Midnight Drive/ })
    ).toHaveAttribute("href", "/songs/s1");
  });

  it("requires confirmation before deleting", () => {
    render(<SongListItem song={baseSong} onDeleted={vi.fn()} />);
    // No fetch should fire just from clicking the trash icon
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    fireEvent.click(screen.getByLabelText("Delete Midnight Drive"));

    expect(screen.getByLabelText("Confirm delete Midnight Drive")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel delete")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cancels the delete confirmation", () => {
    render(<SongListItem song={baseSong} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Delete Midnight Drive"));
    fireEvent.click(screen.getByLabelText("Cancel delete"));
    expect(screen.getByLabelText("Delete Midnight Drive")).toBeInTheDocument();
  });

  it("calls the DELETE endpoint and onDeleted on confirmation", async () => {
    const onDeleted = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    render(<SongListItem song={baseSong} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByLabelText("Delete Midnight Drive"));
    fireEvent.click(screen.getByLabelText("Confirm delete Midnight Drive"));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith("s1");
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/songs/s1", {
      method: "DELETE",
    });
  });

  it("does not call onDeleted and resets when the request fails", async () => {
    const onDeleted = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    render(<SongListItem song={baseSong} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByLabelText("Delete Midnight Drive"));
    fireEvent.click(screen.getByLabelText("Confirm delete Midnight Drive"));

    await waitFor(() => {
      expect(screen.getByLabelText("Delete Midnight Drive")).toBeInTheDocument();
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows 'Lyrics only' when there are no versions", () => {
    render(
      <SongListItem
        song={{ ...baseSong, version_count: 0 }}
        onDeleted={vi.fn()}
      />
    );
    expect(screen.getByText("Lyrics only")).toBeInTheDocument();
  });
});
