import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { VersionDetail } from "./shared";

vi.mock("next/dynamic", () => ({
  default: () => {
    function DynamicStub() {
      return null;
    }
    return DynamicStub;
  },
}));

vi.mock("@/lib/analyze-audio-key", () => ({
  analyzeKeyFromUrl: vi.fn(),
}));

import { VersionsSection } from "./versions-section";
import { analyzeKeyFromUrl } from "@/lib/analyze-audio-key";

const mockAnalyze = vi.mocked(analyzeKeyFromUrl);

const baseVersion: VersionDetail = {
  id: "v1",
  version_number: 1,
  label: null,
  audio_url: "b1/s1/v1.mp3",
  signed_audio_url: "https://storage.example/v1",
  audio_duration: 90,
  notes: null,
  is_current: true,
  detected_key_tonic: null,
  detected_key_mode: null,
  key_confidence: null,
  created_at: "2026-05-10T00:00:00.000Z",
  created_by_member_id: "m1",
  created_by_nickname: "Ryan",
  share_token: null,
};

function renderSection(version: VersionDetail, onUpdate = vi.fn()) {
  render(
    <VersionsSection
      songId="s1"
      versions={[version]}
      playerVersionId={null}
      onPlayVersion={vi.fn()}
      onUpdate={onUpdate}
    />
  );
  return { onUpdate };
}

describe("VersionsSection key detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a version's detected key with its confidence", () => {
    renderSection({
      ...baseVersion,
      detected_key_tonic: 10,
      detected_key_mode: "major",
      key_confidence: 0.76,
    });
    expect(screen.getByTitle("Detected from the audio (confidence 76%)")).toHaveTextContent(
      "B♭ major"
    );
  });

  it("analyzes an existing recording and saves the result", async () => {
    mockAnalyze.mockResolvedValue({ tonic: 2, mode: "minor", confidence: 0.7 });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const { onUpdate } = renderSection(baseVersion);

    fireEvent.click(screen.getByLabelText("Edit version"));
    fireEvent.click(screen.getByRole("button", { name: "Analyze key" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(mockAnalyze).toHaveBeenCalledWith("https://storage.example/v1");
    expect(global.fetch).toHaveBeenCalledWith("/api/versions/v1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detectedKey: { tonic: 2, mode: "minor", confidence: 0.7 } }),
    });
  });

  it("offers re-analysis when a key was already detected", () => {
    renderSection({
      ...baseVersion,
      detected_key_tonic: 0,
      detected_key_mode: "major",
      key_confidence: 0.6,
    });
    fireEvent.click(screen.getByLabelText("Edit version"));
    expect(screen.getByRole("button", { name: "Re-analyze" })).toBeInTheDocument();
  });

  it("explains when no key could be detected and saves nothing", async () => {
    mockAnalyze.mockResolvedValue(null);
    global.fetch = vi.fn();
    const { onUpdate } = renderSection(baseVersion);

    fireEvent.click(screen.getByLabelText("Edit version"));
    fireEvent.click(screen.getByRole("button", { name: "Analyze key" }));

    expect(await screen.findByText("Couldn't detect a key for this recording.")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    mockAnalyze.mockResolvedValue({ tonic: 2, mode: "minor", confidence: 0.7 });
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const { onUpdate } = renderSection(baseVersion);

    fireEvent.click(screen.getByLabelText("Edit version"));
    fireEvent.click(screen.getByRole("button", { name: "Analyze key" }));

    expect(await screen.findByText("Couldn't save the detected key.")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("disables analysis when the recording has no playable URL", () => {
    renderSection({ ...baseVersion, signed_audio_url: null });
    fireEvent.click(screen.getByLabelText("Edit version"));
    expect(screen.getByRole("button", { name: "Analyze key" })).toBeDisabled();
  });
});
