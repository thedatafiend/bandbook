import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { NewSongModal } from "./new-song-modal";

describe("NewSongModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the initial choose step", () => {
    render(<NewSongModal onClose={onClose} />);
    expect(screen.getByRole("heading", { name: "New Song" })).toBeInTheDocument();
    expect(screen.getByText(/Start with Lyrics/)).toBeInTheDocument();
    expect(screen.getByText(/Upload a Recording/)).toBeInTheDocument();
  });

  it("navigates to lyrics step when clicking Start with Lyrics", () => {
    render(<NewSongModal onClose={onClose} />);
    // Click the button that contains the "Start with Lyrics" text
    const btn = screen.getByText(/Start with Lyrics/).closest("button")!;
    fireEvent.click(btn);
    expect(screen.getByPlaceholderText("Song title")).toBeInTheDocument();
    expect(screen.getByText("Create Song")).toBeInTheDocument();
  });

  it("shows error when creating song with API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Song title is required" }),
    });

    render(<NewSongModal onClose={onClose} />);
    const btn = screen.getByText(/Start with Lyrics/).closest("button")!;
    fireEvent.click(btn);

    // Type a title to bypass HTML validation, but API returns error
    const input = screen.getByPlaceholderText("Song title");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.submit(screen.getByText("Create Song").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Song title is required")).toBeInTheDocument();
    });
  });

  it("calls onClose when escape key is pressed", () => {
    render(<NewSongModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", () => {
    render(<NewSongModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates back from lyrics step", () => {
    render(<NewSongModal onClose={onClose} />);
    const btn = screen.getByText(/Start with Lyrics/).closest("button")!;
    fireEvent.click(btn);
    expect(screen.getByText("Create Song")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByRole("heading", { name: "New Song" })).toBeInTheDocument();
  });

  it("creates a song and redirects", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ song: { id: "s1" } }),
    });

    render(<NewSongModal onClose={onClose} />);
    const btn = screen.getByText(/Start with Lyrics/).closest("button")!;
    fireEvent.click(btn);

    const input = screen.getByPlaceholderText("Song title");
    fireEvent.change(input, { target: { value: "My New Song" } });
    fireEvent.click(screen.getByText("Create Song"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/songs/s1");
    });
  });

  it("shows error when song creation fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    render(<NewSongModal onClose={onClose} />);
    const btn = screen.getByText(/Start with Lyrics/).closest("button")!;
    fireEvent.click(btn);

    const input = screen.getByPlaceholderText("Song title");
    fireEvent.change(input, { target: { value: "My Song" } });
    fireEvent.click(screen.getByText("Create Song"));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("validates file size on upload", () => {
    render(<NewSongModal onClose={onClose} />);
    const uploadBtn = screen.getByText(/Upload a Recording/).closest("button")!;
    fireEvent.click(uploadBtn);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const bigFile = new File(["x"], "big.mp3");
    Object.defineProperty(bigFile, "size", { value: 600 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });
    expect(screen.getByText("File too large (max 500 MB)")).toBeInTheDocument();
  });

  // Minimal XMLHttpRequest stub so the signed-URL PUT step can "complete"
  // in jsdom. Records the URL/method/body and immediately reports success.
  class FakeXHR {
    static instances: FakeXHR[] = [];
    method = "";
    url = "";
    status = 200;
    responseText = "";
    sent: unknown = null;
    upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
      onprogress: null,
    };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader() {}
    send(body: unknown) {
      this.sent = body;
      FakeXHR.instances.push(this);
      // Resolve asynchronously so the PUT promise settles after send().
      queueMicrotask(() => this.onload?.());
    }
  }

  async function reachUploadDestination() {
    const uploadBtn = screen.getByText(/Upload a Recording/).closest("button")!;
    fireEvent.click(uploadBtn);
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["audio"], "test.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });
  }

  it("uploads a new-song recording via signed URL (not multipart to the API)", async () => {
    FakeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/songs") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ song: { id: "new-song-1" } }),
        });
      }
      if (url.endsWith("/versions/upload-url")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              signedUrl: "https://storage.example/signed",
              token: "tok",
              path: "band-1/new-song-1/abc.mp3",
            }),
        });
      }
      if (url.endsWith("/versions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: { id: "v1" } }),
        });
      }
      // existing-songs list fetch
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ songs: [] }),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<NewSongModal onClose={onClose} />);
    await reachUploadDestination();

    const titleInput = screen.getByPlaceholderText("Song title");
    fireEvent.change(titleInput, { target: { value: "Fresh Track" } });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/songs/new-song-1");
    });

    // The file must go to Supabase Storage via the signed URL (PUT), and the
    // version must be registered with the storage path — never a multipart
    // POST of the file to the API route (the original bug).
    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls).toContain(
      "/api/songs/new-song-1/versions/upload-url"
    );
    const registerCall = fetchMock.mock.calls.find(
      (c) => String(c[0]) === "/api/songs/new-song-1/versions"
    )!;
    expect(registerCall).toBeTruthy();
    expect(JSON.parse((registerCall[1] as RequestInit).body as string)).toEqual(
      { path: "band-1/new-song-1/abc.mp3" }
    );
    expect((registerCall[1] as RequestInit).body).not.toBeInstanceOf(FormData);

    const putCall = FakeXHR.instances.find((x) => x.method === "PUT");
    expect(putCall?.url).toBe("https://storage.example/signed");
    expect(putCall?.sent).toBeInstanceOf(File);

    vi.unstubAllGlobals();
  });

  it("surfaces an error and does not redirect if the signed URL request fails", async () => {
    FakeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/songs") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ song: { id: "new-song-2" } }),
        });
      }
      if (url.endsWith("/versions/upload-url")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          clone: () => ({
            json: () => Promise.resolve({ error: "Failed to create upload URL" }),
          }),
          text: () => Promise.resolve(""),
          json: () => Promise.resolve({ error: "Failed to create upload URL" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ songs: [] }),
      });
    }) as unknown as typeof fetch;

    render(<NewSongModal onClose={onClose} />);
    await reachUploadDestination();

    const titleInput = screen.getByPlaceholderText("Song title");
    fireEvent.change(titleInput, { target: { value: "Doomed Track" } });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(screen.getByText("Failed to create upload URL")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("advances to upload destination after selecting a file", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ songs: [] }),
    });

    render(<NewSongModal onClose={onClose} />);
    const uploadBtn = screen.getByText(/Upload a Recording/).closest("button")!;
    fireEvent.click(uploadBtn);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["audio"], "test.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByRole("heading", { name: "Where should it go?" })).toBeInTheDocument();
    expect(screen.getByText("test.mp3")).toBeInTheDocument();
  });
});
