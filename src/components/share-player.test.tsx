import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SharePlayer } from "./share-player";

describe("SharePlayer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the song title, version, label, and duration", () => {
    render(
      <SharePlayer
        token="tok"
        title="My Song"
        versionNumber={3}
        label="Acoustic take"
        durationSeconds={125}
        initialAudioUrl="https://signed.url/a.mp3"
      />
    );
    expect(screen.getByText("My Song")).toBeInTheDocument();
    expect(
      screen.getByText("Version 3 · Acoustic take · 2:05")
    ).toBeInTheDocument();
  });

  it("renders an audio element pointed at the initial url, with download disabled", () => {
    const { container } = render(
      <SharePlayer
        token="tok"
        title="My Song"
        versionNumber={1}
        label={null}
        durationSeconds={null}
        initialAudioUrl="https://signed.url/a.mp3"
      />
    );
    const audio = container.querySelector("audio");
    expect(audio).toHaveAttribute("src", "https://signed.url/a.mp3");
    expect(audio).toHaveAttribute("controlsList", "nodownload");
  });

  it("fetches a fresh signed url when playback errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recording: { signedAudioUrl: "https://fresh.url/b.mp3" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <SharePlayer
        token="tok"
        title="My Song"
        versionNumber={1}
        label={null}
        durationSeconds={null}
        initialAudioUrl="https://signed.url/a.mp3"
      />
    );

    const audio = container.querySelector("audio")!;
    fireEvent.error(audio);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/share/tok");
      expect(container.querySelector("audio")).toHaveAttribute(
        "src",
        "https://fresh.url/b.mp3"
      );
    });
  });

  it("shows an error state when refresh fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <SharePlayer
        token="tok"
        title="My Song"
        versionNumber={1}
        label={null}
        durationSeconds={null}
        initialAudioUrl="https://signed.url/a.mp3"
      />
    );

    fireEvent.error(container.querySelector("audio")!);

    await waitFor(() => {
      expect(
        screen.getByText("This recording couldn't be loaded.")
      ).toBeInTheDocument();
    });
  });
});
