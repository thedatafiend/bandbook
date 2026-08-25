import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = vi.fn();
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mockUseAuth(),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { JoinInvite } from "./join-invite";

type MockResponse = { ok: boolean; status?: number; body?: unknown };
type FetchHandler = (url: string, init?: RequestInit) => MockResponse;

function setupFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const res = handler(url, init);
    return {
      ok: res.ok,
      status: res.status ?? (res.ok ? 200 : 500),
      json: async () => res.body ?? {},
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const band = { id: "b1", name: "The Midnight Ramblers" };

describe("JoinInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows an error for an invalid invite token", async () => {
    setupFetch(() => ({ ok: false, status: 404 }));

    render(<JoinInvite inviteToken="bad-token" />);

    expect(
      await screen.findByText(/invite link is invalid or has expired/i)
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Passcode")).not.toBeInTheDocument();
  });

  it("prompts signed-out invitees to create an account, not the join form", async () => {
    setupFetch(() => ({ ok: true, body: { band } }));

    render(<JoinInvite inviteToken="tok" />);

    expect(await screen.findByText("The Midnight Ramblers")).toBeInTheDocument();
    expect(screen.getByText("Create an account")).toBeInTheDocument();
    expect(screen.getByText("I already have an account")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Passcode")).not.toBeInTheDocument();
  });

  it("claims memberships and shows the join form for a signed-in non-member", async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    const fetchMock = setupFetch((url) => {
      if (url.startsWith("/api/bands/invite/")) return { ok: true, body: { band } };
      if (url === "/api/auth/claim-memberships") return { ok: true, body: { bands: [], count: 0 } };
      return { ok: false, status: 500 };
    });

    render(<JoinInvite inviteToken="tok" />);

    expect(await screen.findByPlaceholderText("Passcode")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/claim-memberships",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("submits the join request and navigates to songs on success", async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    const fetchMock = setupFetch((url) => {
      if (url.startsWith("/api/bands/invite/")) return { ok: true, body: { band } };
      if (url === "/api/auth/claim-memberships") return { ok: true, body: { bands: [], count: 0 } };
      if (url === "/api/bands/join") {
        return { ok: true, body: { band: { id: "b1", name: band.name }, member: { id: "m1" } } };
      }
      return { ok: false, status: 500 };
    });

    render(<JoinInvite inviteToken="tok" />);

    fireEvent.change(await screen.findByPlaceholderText("Passcode"), {
      target: { value: "1234" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your nickname in this band"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByText("Join Band"));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/songs"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bands/join",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ inviteToken: "tok", passcode: "1234", nickname: "Alex" }),
      })
    );
  });

  it("shows the join error when the API rejects the passcode", async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    setupFetch((url) => {
      if (url.startsWith("/api/bands/invite/")) return { ok: true, body: { band } };
      if (url === "/api/auth/claim-memberships") return { ok: true, body: { bands: [], count: 0 } };
      if (url === "/api/bands/join") {
        return { ok: false, status: 401, body: { error: "Incorrect passcode" } };
      }
      return { ok: false, status: 500 };
    });

    render(<JoinInvite inviteToken="tok" />);

    fireEvent.change(await screen.findByPlaceholderText("Passcode"), {
      target: { value: "wrong" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your nickname in this band"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByText("Join Band"));

    expect(await screen.findByText("Incorrect passcode")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("skips the form and activates the band when the user already belongs to it", async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    const fetchMock = setupFetch((url) => {
      if (url.startsWith("/api/bands/invite/")) return { ok: true, body: { band } };
      if (url === "/api/auth/claim-memberships") {
        return { ok: true, body: { bands: [{ band_id: "b1" }], count: 1 } };
      }
      if (url === "/api/auth/switch-band") return { ok: true, body: { ok: true } };
      return { ok: false, status: 500 };
    });

    render(<JoinInvite inviteToken="tok" />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/songs"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/switch-band",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ bandId: "b1" }),
      })
    );
    expect(screen.queryByPlaceholderText("Passcode")).not.toBeInTheDocument();
  });

  it("falls back to the join form when claiming memberships fails", async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    setupFetch((url) => {
      if (url.startsWith("/api/bands/invite/")) return { ok: true, body: { band } };
      if (url === "/api/auth/claim-memberships") return { ok: false, status: 500 };
      return { ok: false, status: 500 };
    });

    render(<JoinInvite inviteToken="tok" />);

    expect(await screen.findByPlaceholderText("Passcode")).toBeInTheDocument();
  });
});
