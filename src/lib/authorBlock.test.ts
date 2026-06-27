import { describe, it, expect } from "vitest";
import { isBlockedAuthorName } from "./authorBlock";

describe("isBlockedAuthorName", () => {
  it("matches the aéPiot spam brand across accent + case variants", () => {
    for (const name of ["aéPiot", "aepiot", "AÉPIOT", "aePiot", "AePiOt", "  aéPiot  "]) {
      expect(isBlockedAuthorName(name)).toBe(true);
    }
  });

  it("matches when the brand is embedded in a longer name", () => {
    expect(isBlockedAuthorName("free aéPiot deals")).toBe(true);
    expect(isBlockedAuthorName("aéPiot_bot_2024")).toBe(true);
  });

  it("does not flag normal usernames", () => {
    for (const name of ["Roger A.", "npub1cnmz20a", "piot", "aepi", "satoshi", ""]) {
      expect(isBlockedAuthorName(name)).toBe(false);
    }
  });

  it("handles null/undefined safely", () => {
    expect(isBlockedAuthorName(undefined)).toBe(false);
    expect(isBlockedAuthorName(null)).toBe(false);
  });
});
