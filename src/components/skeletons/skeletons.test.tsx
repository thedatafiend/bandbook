import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SongsSkeleton } from "./songs-skeleton";
import { SongDetailSkeleton } from "./song-detail-skeleton";
import { SettingsSkeleton } from "./settings-skeleton";

describe("Page skeleton components", () => {
  describe("SongsSkeleton", () => {
    it("renders without crashing", () => {
      const { container } = render(<SongsSkeleton />);
      expect(container.firstElementChild).toBeTruthy();
    });

    it("renders skeleton song cards", () => {
      const { container } = render(<SongsSkeleton />);
      // Should have multiple card-like skeletons (bg-surface border containers)
      const cards = container.querySelectorAll("[aria-hidden='true'].glass");
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });

    it("renders search bar placeholder", () => {
      const { container } = render(<SongsSkeleton />);
      // The search bar skeleton is a full-width block near the top
      const pulseElements = container.querySelectorAll(".animate-pulse");
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it("all elements are aria-hidden", () => {
      const { container } = render(<SongsSkeleton />);
      const ariaHidden = container.querySelectorAll("[aria-hidden='true']");
      expect(ariaHidden.length).toBeGreaterThan(0);
    });
  });

  describe("SongDetailSkeleton", () => {
    it("renders without crashing", () => {
      const { container } = render(<SongDetailSkeleton />);
      expect(container.firstElementChild).toBeTruthy();
    });

    it("renders skeleton version cards", () => {
      const { container } = render(<SongDetailSkeleton />);
      const cards = container.querySelectorAll("[aria-hidden='true'].glass");
      // Audio player card + 3 version cards = 4
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });

    it("renders tab bar skeletons", () => {
      const { container } = render(<SongDetailSkeleton />);
      // Tab bar contains border-b border-border
      const tabBar = container.querySelector(".border-b.border-border");
      expect(tabBar).toBeTruthy();
    });
  });

  describe("SettingsSkeleton", () => {
    it("renders without crashing", () => {
      const { container } = render(<SettingsSkeleton />);
      expect(container.firstElementChild).toBeTruthy();
    });

    it("renders five setting sections", () => {
      const { container } = render(<SettingsSkeleton />);
      const sections = container.querySelectorAll("section");
      expect(sections).toHaveLength(5);
    });

    it("renders member card skeletons", () => {
      const { container } = render(<SettingsSkeleton />);
      const cards = container.querySelectorAll("[aria-hidden='true'].glass");
      // Band name card + 3 member cards + invite link elements = at least 4
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });
  });
});
