import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("renders children", () => {
    render(
      <RootLayout>
        <p>Hello</p>
      </RootLayout>,
      { container: document.documentElement }
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("includes the Vercel Analytics component", () => {
    render(
      <RootLayout>
        <p>Test</p>
      </RootLayout>,
      { container: document.documentElement }
    );
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
  });
});
