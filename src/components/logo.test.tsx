import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Logo, LogoMark } from "./logo";

afterEach(cleanup);

describe("LogoMark", () => {
  it("renders an accent square with the music-note glyph", () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector("svg")!;
    const rect = svg.querySelector("rect")!;
    expect(rect.getAttribute("class")).toContain("fill-accent");
    expect(svg.textContent).toContain("♪");
  });

  it("is labelled for assistive tech by default", () => {
    render(<LogoMark />);
    expect(screen.getByRole("img", { name: "BandBook" })).toBeInTheDocument();
  });

  it("is hidden from assistive tech when decorative", () => {
    const { container } = render(<LogoMark decorative />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
  });

  it("applies the given size to width and height", () => {
    const { container } = render(<LogoMark size={48} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("48");
    expect(svg.getAttribute("height")).toBe("48");
  });
});

describe("Logo", () => {
  it("renders only the mark by default", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "BandBook" })).toBeInTheDocument();
    expect(screen.queryByText("BandBook")).toBeNull();
  });

  it("renders the wordmark and makes the mark decorative when requested", () => {
    const { container } = render(<Logo withWordmark />);
    expect(screen.getByText("BandBook")).toBeInTheDocument();
    // The mark no longer carries the label, avoiding a duplicate for screen readers.
    expect(screen.queryByRole("img", { name: "BandBook" })).toBeNull();
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});
