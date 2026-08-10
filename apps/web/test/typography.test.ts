import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const selectorUsesSize = (selector: string, token: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped} \\{[^}]*font-size: var\\(--${token}\\)`).test(css);
};

describe("TAN-7 readable typography contract", () => {
  it("defines the reviewed four-level type scale and shared line heights", () => {
    expect(css).toContain("--text-label: 13px");
    expect(css).toContain("--text-meta: 14px");
    expect(css).toContain("--text-control: 15px");
    expect(css).toContain("--text-body: 16px");
    expect(css).toContain("--leading-normal: 1.6");
    expect(css).toContain("--leading-relaxed: 1.75");
  });

  it("does not render any explicit text below the 11px compact-label floor", () => {
    const directSizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
    const shorthandSizes = [...css.matchAll(/font:\s*[^;]*?(\d+(?:\.\d+)?)px(?:\/[^ ;}]+)?[^;]*[;}]/g)].map((match) => Number(match[1]));
    expect([...directSizes, ...shorthandSizes].filter((size) => size < 11)).toEqual([]);
  });

  it("keeps primary navigation, tables, actions, and forms at the 14px control floor", () => {
    expect(selectorUsesSize("nav button", "text-control")).toBe(true);
    expect(selectorUsesSize(".table-row", "text-control")).toBe(true);
    expect(selectorUsesSize(".attention-card button", "text-control")).toBe(true);
    expect(selectorUsesSize(".segmented button", "text-control")).toBe(true);
    expect(css).toMatch(/\.setup-form label,\.quick-form label \{[^}]*font-size: var\(--text-control\)/);
    expect(css).toMatch(/\.setup-form input,[^}]*font: var\(--text-control\) "DM Sans"/);
  });

  it("uses the compact label size only for deliberately compact status or uppercase labels", () => {
    expect(selectorUsesSize(".pill", "text-label")).toBe(true);
    expect(selectorUsesSize(".attention-meta", "text-label")).toBe(true);
    expect(css).toMatch(/\.eyebrow,\.section-kicker \{[^}]*font-size: var\(--text-label\)/);
    expect(css).toMatch(/\.path-label,\.risk-label \{[^}]*font-size: var\(--text-label\)/);
  });

  it("reflows the oversight shell when browser zoom reduces the effective viewport", () => {
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.shell \{ display: block; \}/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.sidebar \{[^}]*position: sticky;[^}]*width: 100%/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?nav \{[^}]*overflow-x: auto/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.detail-panel \{ width: 100%; \}/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.table-row > span \{[^}]*overflow-wrap: anywhere/);
  });
});
