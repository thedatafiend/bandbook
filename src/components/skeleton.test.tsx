import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, SkeletonLine, SkeletonCircle, SkeletonCard } from "./skeleton";

describe("Skeleton primitives", () => {
  describe("Skeleton", () => {
    it("renders an aria-hidden div with pulse animation", () => {
      const { container } = render(<Skeleton />);
      const el = container.firstElementChild!;
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.className).toContain("animate-pulse");
      expect(el.className).toContain("rounded-lg");
      expect(el.className).toContain("bg-surface-alt/60");
    });

    it("accepts custom className", () => {
      const { container } = render(<Skeleton className="h-8 w-24" />);
      const el = container.firstElementChild!;
      expect(el.className).toContain("h-8");
      expect(el.className).toContain("w-24");
    });
  });

  describe("SkeletonLine", () => {
    it("renders with default text-line dimensions", () => {
      const { container } = render(<SkeletonLine />);
      const el = container.firstElementChild!;
      expect(el.className).toContain("h-3");
      expect(el.className).toContain("w-full");
    });

    it("overrides default dimensions with className", () => {
      const { container } = render(<SkeletonLine className="h-5 w-40" />);
      const el = container.firstElementChild!;
      expect(el.className).toContain("h-5");
      expect(el.className).toContain("w-40");
    });
  });

  describe("SkeletonCircle", () => {
    it("renders as a circle by default", () => {
      const { container } = render(<SkeletonCircle />);
      const el = container.firstElementChild!;
      expect(el.className).toContain("rounded-full");
      expect(el.className).toContain("h-8");
      expect(el.className).toContain("w-8");
    });
  });

  describe("SkeletonCard", () => {
    it("renders with project card styles", () => {
      const { container } = render(<SkeletonCard />);
      const el = container.firstElementChild!;
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.className).toContain("rounded-lg");
      expect(el.className).toContain("glass");
    });

    it("renders children inside the card", () => {
      render(
        <SkeletonCard>
          <span data-testid="child">Hello</span>
        </SkeletonCard>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });
});
