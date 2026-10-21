import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("@/lib/analyze-audio-key", () => ({
  analyzeKeyFromFile: vi.fn(),
}));

import { UploadWidget } from "./upload-widget";
import { analyzeKeyFromFile } from "@/lib/analyze-audio-key";

const mockAnalyze = vi.mocked(analyzeKeyFromFile);

/** XHR stand-in that completes the PUT successfully on send(). */
class FakeXHR {
  status = 200;
  responseText = "";
  upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send() {
    queueMicrotask(() => this.onload?.());
  }
}

function mockServer() {
  global.fetch = vi.fn((url: string) => {
    if (url.endsWith("/upload-url")) {
      return Promise.resolve(
        new Response(JSON.stringify({ signedUrl: "https://put.example", token: "t", path: "b1/s1/x.mp3" }))
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ version: { id: "v1" } })));
  }) as unknown as typeof fetch;
}

function selectAndUpload() {
  const file = new File(["audio"], "take.mp3", { type: "audio/mpeg" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  return file;
}

function registerBody() {
  const call = vi
    .mocked(global.fetch)
    .mock.calls.find(([url]) => url === "/api/songs/s1/versions");
  return JSON.parse((call![1] as RequestInit).body as string);
}

describe("UploadWidget key detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    mockServer();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("analyzes the selected file and registers the version with its key", async () => {
    mockAnalyze.mockResolvedValue({ tonic: 7, mode: "major", confidence: 0.9 });
    const onDone = vi.fn();
    render(<UploadWidget songId="s1" onDone={onDone} onCancel={vi.fn()} />);

    const file = selectAndUpload();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockAnalyze).toHaveBeenCalledWith(file);
    expect(registerBody()).toEqual({
      path: "b1/s1/x.mp3",
      detectedKey: { tonic: 7, mode: "major", confidence: 0.9 },
    });
  });

  it("still registers the version when no key is detected", async () => {
    mockAnalyze.mockResolvedValue(null);
    const onDone = vi.fn();
    render(<UploadWidget songId="s1" onDone={onDone} onCancel={vi.fn()} />);

    selectAndUpload();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(registerBody()).toEqual({ path: "b1/s1/x.mp3", detectedKey: null });
  });

  it("shows that it is analyzing once the upload finishes first", async () => {
    let resolveKey: (v: null) => void = () => {};
    mockAnalyze.mockReturnValue(new Promise((r) => (resolveKey = r)));
    const onDone = vi.fn();
    render(<UploadWidget songId="s1" onDone={onDone} onCancel={vi.fn()} />);

    selectAndUpload();

    expect(await screen.findByText("Analyzing key…")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    resolveKey(null);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
