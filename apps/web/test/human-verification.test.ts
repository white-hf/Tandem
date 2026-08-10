import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("Human Verification Web contract", () => {
  it("opens review-state Attention Issues in an explicit verification route", () => {
    expect(app).toContain("onReviewIssue={(issue) => selectIssue(issue, true)}");
    expect(app).toContain('${issue.key}${verify ? "/verify" : ""}');
    expect(app).toContain('aria-label={verificationMode ? "Human Verification" : "Detail panel"}');
  });

  it("posts both Human delivery outcomes to the scoped review endpoint", () => {
    expect(app).toContain('/api/v1/human/issues/${encodeURIComponent(issue.key)}/review');
    expect(app).toContain('submitReview("changes_requested")');
    expect(app).toContain('submitReview("approved")');
    expect(app).toContain("Approve & complete");
    expect(app).toContain("Request changes");
  });

  it("requires rationale and exposes authority, pending, and error feedback", () => {
    expect(app).toContain("Decision rationale");
    expect(app).toContain('role="alert"');
    expect(app).toContain("Agents cannot perform this action");
    expect(app).toContain("Recording…");
    expect(app).toContain("Completing…");
  });

  it("visually distinguishes the verification workspace from generic Issue detail", () => {
    expect(css).toContain(".verification-panel");
    expect(css).toContain(".verification-banner");
    expect(css).toContain(".verification-actions");
    expect(css).toContain(".verification-buttons");
  });
});
