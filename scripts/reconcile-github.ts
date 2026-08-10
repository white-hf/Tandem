import { createHash } from "node:crypto";
import { PostgresEventStore, PostgresStateRepository } from "@tandem/db";

const databaseUrl = process.env.DATABASE_URL;
const token = process.env.GITHUB_READ_TOKEN;
const repository = process.env.TANDEM_GITHUB_REPOSITORY ?? "whitetang/tandem";
if (!databaseUrl) throw new Error("DATABASE_URL is required for GitHub reconciliation");
if (!token) throw new Error("GITHUB_READ_TOKEN is required for GitHub reconciliation");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("TANDEM_GITHUB_REPOSITORY must be owner/repository");

const github = async <T>(path: string): Promise<T> => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2026-03-10",
      "user-agent": "tandem-pilot-reconciler",
    },
  });
  if (!response.ok) throw new Error(`GitHub ${path} failed with ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
};

interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  merged_at: string | null;
  updated_at: string;
  head: { sha: string };
}

interface CheckRun {
  id: number;
  name: string;
  html_url: string;
  status: string;
  conclusion: string | null;
}

const migrations = new PostgresStateRepository(databaseUrl);
await migrations.migrate();
await migrations.close();
const events = new PostgresEventStore(databaseUrl);

try {
  const pulls = await github<PullRequest[]>(`/repos/${repository}/pulls?state=all&sort=updated&direction=desc&per_page=100`);
  let projected = 0;
  for (const pull of pulls) {
    const payload = {
      repository: { full_name: repository },
      pull_request: { number: pull.number, title: pull.title, body: pull.body, html_url: pull.html_url, state: pull.state, merged: Boolean(pull.merged_at), updated_at: pull.updated_at },
    };
    const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const result = await events.ingestGitHub(`reconcile:pull:${pull.number}:${pull.updated_at}`, "pull_request", digest, payload);
    projected += result.artifacts.length;

    const checks = await github<{ check_runs: CheckRun[] }>(`/repos/${repository}/commits/${pull.head.sha}/check-runs?per_page=100`);
    for (const check of checks.check_runs) {
      const checkPayload = { repository: { full_name: repository }, check_run: { ...check, pull_requests: [{ number: pull.number }] } };
      const checkDigest = createHash("sha256").update(JSON.stringify(checkPayload)).digest("hex");
      const checkResult = await events.ingestGitHub(`reconcile:check:${check.id}:${check.status}:${check.conclusion ?? "pending"}`, "check_run", checkDigest, checkPayload);
      projected += checkResult.artifacts.length;
    }
  }
  console.log(`GitHub reconciliation complete: ${pulls.length} pull requests inspected, ${projected} linked projections written.`);
} finally {
  await events.close();
}
