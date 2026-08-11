import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Artifact, ArtifactRevision, Issue, IssueType, MaterialRiskFlag, Project, ProjectSnapshot } from "@tandem/contracts";

type View = "attention" | "work" | "artifacts" | "activity" | "settings";
type SnapshotArtifact = ProjectSnapshot["artifacts"][number];

const nav: Array<{ id: View; label: string; glyph: string }> = [
  { id: "attention", label: "Attention", glyph: "✦" },
  { id: "work", label: "Board & Work", glyph: "☷" },
  { id: "artifacts", label: "Baselines & Artifacts", glyph: "▤" },
  { id: "activity", label: "Activity & Sessions", glyph: "◷" },
  { id: "settings", label: "People & Security", glyph: "⚙" },
];

const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const projectKeyFromPath = () => window.location.pathname.match(/^\/projects\/([A-Za-z0-9]+)/)?.[1]?.toUpperCase();
const issueKeyFromPath = () => window.location.pathname.match(/^\/projects\/[A-Za-z0-9]+\/work\/([A-Za-z0-9-]+)/)?.[1]?.toUpperCase();
const isVerificationPath = () => /\/verify\/?$/.test(window.location.pathname);

function StatePill({ state }: { state: string }) {
  return <span className={`pill pill-${state}`}>{titleCase(state)}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function App() {
  const [projects, setProjects] = useState<Project[]>();
  const [snapshot, setSnapshot] = useState<ProjectSnapshot>();
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [authRequired, setAuthRequired] = useState(false);
  const [token, setToken] = useState("");
  const [view, setView] = useState<View>("attention");
  const [selectedIssue, setSelectedIssue] = useState<Issue>();
  const [selectedArtifact, setSelectedArtifact] = useState<SnapshotArtifact>();
  const [verificationMode, setVerificationMode] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);

  const load = async (preferredProjectKey?: string) => {
    try {
      const projectsResponse = await fetch("/api/v1/projects", { credentials: "include" });
      const projectsBody = (await projectsResponse.json()) as { data?: Project[]; error?: { message: string } };
      if (projectsResponse.status === 401) {
        setAuthRequired(true);
        setError(undefined);
        return;
      }
      if (!projectsResponse.ok || !projectsBody.data) throw new Error(projectsBody.error?.message ?? "Could not load Tandem Projects");
      setProjects(projectsBody.data);
      if (!projectsBody.data.length) {
        setSnapshot(undefined);
        setSelectedProjectKey(undefined);
        setAuthRequired(false);
        setError(undefined);
        return;
      }
      const projectKey = preferredProjectKey && projectsBody.data.some((project) => project.key === preferredProjectKey)
        ? preferredProjectKey
        : selectedProjectKey && projectsBody.data.some((project) => project.key === selectedProjectKey)
          ? selectedProjectKey
          : projectsBody.data[0]!.key;
      const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectKey)}/snapshot`, { credentials: "include" });
      const body = (await response.json()) as { data?: ProjectSnapshot; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Could not load Project delivery context");
      setSnapshot(body.data);
      setSelectedProjectKey(projectKey);
      const pathIssueKey = issueKeyFromPath();
      const pathIssue = pathIssueKey ? body.data.issues.find((issue) => issue.key === pathIssueKey) : undefined;
      if (pathIssue) {
        setSelectedIssue(pathIssue);
        setSelectedArtifact(undefined);
        setVerificationMode(isVerificationPath() && pathIssue.displayState === "review");
      } else {
        window.history.replaceState({}, "", `/projects/${projectKey}`);
      }
      setAuthRequired(false);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Tandem");
    }
  };

  useEffect(() => {
    const syncPath = () => { void load(projectKeyFromPath()); };
    syncPath();
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);
  useEffect(() => {
    if (authRequired) return;
    const source = new EventSource("/api/v1/events");
    const refresh = () => { void load(selectedProjectKey); };
    source.addEventListener("state.changed", refresh);
    source.addEventListener("git.updated", refresh);
    return () => source.close();
  }, [authRequired, selectedProjectKey]);

  const [loginMode, setLoginMode] = useState<"password" | "token">("password");
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");

  const loginWithPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      setError("Invalid username or password.");
      return;
    }
    setPassword("");
    await load();
  };

  const loginWithToken = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    const response = await fetch("/api/v1/auth/login-token", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      setError("That Human access token is invalid, expired, or revoked.");
      return;
    }
    setToken("");
    await load();
  };

  if (authRequired) {
    return (
      <main className="load-state auth-state">
        <div className="brand-mark">T</div>
        <h1>Sign in to Tandem</h1>
        <p>Human oversight interface. Coding Agents authenticate through MCP.</p>
        <div className="segmented" style={{ marginBottom: "1rem" }}>
          <button type="button" className={loginMode === "password" ? "active" : ""} onClick={() => setLoginMode("password")}>Password</button>
          <button type="button" className={loginMode === "token" ? "active" : ""} onClick={() => setLoginMode("token")}>Access token</button>
        </div>
        {loginMode === "password" ? (
          <form onSubmit={(event) => void loginWithPassword(event)}>
            <label htmlFor="username">Username</label>
            <input id="username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button type="submit">Sign in</button>
          </form>
        ) : (
          <form onSubmit={(event) => void loginWithToken(event)}>
            <label htmlFor="access-token">Human access token</label>
            <input id="access-token" type="password" autoComplete="current-password" value={token} onChange={(event) => setToken(event.target.value)} minLength={32} required />
            <button type="submit">Continue with token</button>
          </form>
        )}
        {error && <span className="form-error">{error}</span>}
      </main>
    );
  }

  if (error) {
    return <main className="load-state"><div className="brand-mark">T</div><h1>Tandem is not connected</h1><p>{error}</p><button onClick={() => void load()}>Try again</button><code>pnpm dev</code></main>;
  }
  if (projects?.length === 0) return <ProjectSetup onCreated={(projectKey) => void load(projectKey)} />;
  if (!snapshot || !projects) return <main className="load-state"><div className="brand-mark pulse">T</div><p>Loading delivery context…</p></main>;

  const selectIssue = (issue: Issue, verify = false) => {
    setSelectedIssue(issue);
    setSelectedArtifact(undefined);
    setVerificationMode(verify && issue.displayState === "review");
    window.history.pushState({}, "", `/projects/${snapshot.project.key}/work/${issue.key}${verify ? "/verify" : ""}`);
  };
  const selectArtifact = (artifact: SnapshotArtifact) => { setSelectedArtifact(artifact); setSelectedIssue(undefined); setVerificationMode(false); };
  const resolveDecision = async (requestId: string, outcome: "approved" | "changes_requested") => {
    const response = await fetch(`/api/v1/human/decision-requests/${requestId}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        outcome,
        rationale: outcome === "approved" ? "Explicitly approved by the Human Builder in Tandem Web." : "Human Builder requested revision before this proposal becomes effective.",
      }),
    });
    if (!response.ok) throw new Error("The Human decision could not be recorded");
    await load();
  };
  const resolveIssueReview = async (issue: Issue, outcome: "approved" | "changes_requested", rationale: string) => {
    const response = await fetch(`/api/v1/human/issues/${encodeURIComponent(issue.key)}/review`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ outcome, rationale }),
    });
    const body = (await response.json()) as { error?: { message: string } };
    if (!response.ok) throw new Error(body.error?.message ?? "The Human verification decision could not be recorded");
    await load(snapshot.project.key);
    setSelectedIssue(undefined);
    setVerificationMode(false);
    window.history.replaceState({}, "", `/projects/${snapshot.project.key}`);
  };

  const logout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Ignore network errors on logout
    }
    setAuthRequired(true);
    setSnapshot(undefined);
    setProjects(undefined);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">T</div><div><strong>Tandem</strong><span>Agent-first delivery</span></div></div>
        <div className="workspace-switcher-container" style={{ marginBottom: "1.5rem" }}>
          <div className="workspace-switcher" style={{ position: "relative", cursor: "pointer" }}>
            <span className="avatar">{snapshot.project.key.slice(0, 2)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{snapshot.project.name}</strong>
              <span style={{ fontSize: "12px", color: "#92a099" }}>{projects.length} Project{projects.length === 1 ? "" : "s"} · Switch ▾</span>
            </div>
            <select
              id="project-switcher"
              aria-label="Select Project"
              value={selectedProjectKey}
              onChange={(event) => {
                if (event.target.value === "__NEW__") {
                  setShowCreateProject(true);
                } else {
                  void load(event.target.value);
                }
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer"
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.key} style={{ color: "#18201c", background: "#fff" }}>
                  {project.key} · {project.name}
                </option>
              ))}
              <option value="__NEW__" style={{ color: "#276b50", fontWeight: "bold", background: "#fff" }}>
                ＋ Create New Project...
              </option>
            </select>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <span className="nav-glyph">{item.glyph}</span>{item.label}
              {item.id === "attention" && snapshot.attention.length > 0 && <span className="nav-count">{snapshot.attention.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="connection-dot" /> Authenticated
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            style={{
              background: "none",
              border: "1px solid #374740",
              color: "#9ca9a2",
              padding: "3px 8px",
              borderRadius: "5px",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">{view === "work" ? "BOARD & WORK" : view === "artifacts" ? "BASELINES & ARTIFACTS" : view === "activity" ? "ACTIVITY & SESSIONS" : view === "settings" ? "PEOPLE & SECURITY" : view.toUpperCase()}</span>
            <h1>{view === "work" ? "Board & Work" : view === "artifacts" ? "Baselines & Artifacts" : view === "activity" ? "Activity & Sessions" : view === "settings" ? "People & Security" : titleCase(view)}</h1>
          </div>
          <div className="top-actions">
            <button className="quick-add-button" onClick={() => setQuickAddOpen(true)}>＋ Quick Add</button>
            <button className="refresh" onClick={() => void load(selectedProjectKey)}>↻ <span>Refresh</span></button>
            <button
              type="button"
              className="refresh"
              onClick={() => void logout()}
              title="Sign Out"
              style={{ color: "#a1423e" }}
            >
              Sign Out ↳
            </button>
            <span className="human-avatar">WT</span>
          </div>
        </header>

        <div className="content">
          {view === "attention" && <Attention snapshot={snapshot} onReviewIssue={(issue) => selectIssue(issue, true)} onArtifact={selectArtifact} onOpenCycles={() => setView("work")} onDecision={resolveDecision} />}
          {view === "work" && <Work snapshot={snapshot} onIssue={selectIssue} />}
          {view === "artifacts" && <Artifacts snapshot={snapshot} onArtifact={selectArtifact} />}
          {view === "activity" && (
            <div className="page-stack">
              <ActivityView snapshot={snapshot} />
              <div style={{ marginTop: "2rem" }}>
                <Sessions snapshot={snapshot} />
              </div>
            </div>
          )}
          {view === "settings" && <SettingsView snapshot={snapshot} />}
        </div>
      </main>

      {(selectedIssue || selectedArtifact) && (
        <aside
          className={`detail-panel${verificationMode ? " verification-panel" : ""}`}
          style={drawerExpanded ? { width: "calc(100vw - 246px)", maxWidth: "none" } : undefined}
          aria-label={verificationMode ? "Human Verification" : "Detail panel"}
        >
          <div style={{ position: "sticky", top: "14px", right: "14px", float: "right", display: "flex", gap: "6px", zIndex: 10 }}>
            <button
              type="button"
              className="close"
              style={{ position: "static", float: "none" }}
              onClick={() => setDrawerExpanded(!drawerExpanded)}
              title={drawerExpanded ? "Collapse width" : "Expand width"}
            >
              {drawerExpanded ? " ↙ " : " ↗ "}
            </button>
            <button
              type="button"
              className="close"
              style={{ position: "static", float: "none" }}
              onClick={() => { setSelectedIssue(undefined); setSelectedArtifact(undefined); setVerificationMode(false); setDrawerExpanded(false); window.history.replaceState({}, "", `/projects/${snapshot.project.key}`); }}
              aria-label="Close details"
            >
              ×
            </button>
          </div>
          {selectedIssue && <IssueDetail issue={selectedIssue} snapshot={snapshot} verificationMode={verificationMode} onReview={resolveIssueReview} />}
          {selectedArtifact && <ArtifactDetail artifact={selectedArtifact} />}
        </aside>
      )}
      {quickAddOpen && <QuickAdd projectKey={snapshot.project.key} onClose={() => setQuickAddOpen(false)} onCreated={async (issue) => { setQuickAddOpen(false); await load(snapshot.project.key); setSelectedIssue(issue); }} />}
      {showCreateProject && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreateProject(false); }}>
          <div className="quick-modal" style={{ maxWidth: "800px", padding: 0 }}>
            <button className="close" onClick={() => setShowCreateProject(false)} style={{ zIndex: 10 }}>×</button>
            <ProjectSetup onCreated={async (newKey) => { setShowCreateProject(false); await load(newKey); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectSetup({ onCreated }: { onCreated: (projectKey: string) => void }) {
  const [form, setForm] = useState({ key: "", name: "", goal: "", owner: "", targetDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), repositoryOwner: "", repositoryName: "", guidance: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const response = await fetch("/api/v1/human/projects", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        key: form.key.toUpperCase(),
        name: form.name,
        goal: form.goal,
        owner: form.owner,
        targetDate: form.targetDate,
        successMeasures: ["Planned and Quick Work complete with evidence and handoff"],
        nonGoals: ["Tandem does not launch or schedule Coding Agents"],
        repositories: [{ provider: "github", host: "github.com", owner: form.repositoryOwner, name: form.repositoryName, defaultBranch: "main" }],
        artifacts: form.guidance.trim().length >= 20 ? [{ type: "product_spec", title: `${form.name} Current Product Guidance`, content: form.guidance, storageMode: "tandem_draft" }] : [],
      }),
    });
    const body = (await response.json()) as { data?: { project: Project }; error?: { message: string } };
    setSubmitting(false);
    if (!response.ok || !body.data) {
      setError(body.error?.message ?? "The Project could not be created");
      return;
    }
    onCreated(body.data.project.key);
  };
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  return <main className="setup-page"><div className="setup-brand"><div className="brand-mark">T</div><div><strong>Tandem</strong><span>First real Project</span></div></div><section className="setup-card"><span className="section-kicker">PROJECT SETUP</span><h1>Connect the work your team is already doing</h1><p>Create the durable Project identity and repository binding. Milestones and Cycles are optional; existing guidance can become the first Human-confirmed baseline now or be imported by an Agent next.</p><form onSubmit={(event) => void submit(event)} className="setup-form"><div className="form-grid"><label>Project key<input value={form.key} onChange={(event) => update("key", event.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9]{1,7}" placeholder="ACME" required /></label><label>Project name<input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Customer Delivery" minLength={3} required /></label></div><label>Delivery goal<textarea value={form.goal} onChange={(event) => update("goal", event.target.value)} placeholder="What outcome will this Project deliver?" minLength={10} required /></label><div className="form-grid"><label>Owner<input value={form.owner} onChange={(event) => update("owner", event.target.value)} placeholder="Product owner" minLength={2} required /></label><label>Target date<input type="date" value={form.targetDate} onChange={(event) => update("targetDate", event.target.value)} required /></label></div><fieldset><legend>Primary GitHub repository</legend><div className="form-grid"><label>Owner / organization<input value={form.repositoryOwner} onChange={(event) => update("repositoryOwner", event.target.value)} placeholder="acme" required /></label><label>Repository<input value={form.repositoryName} onChange={(event) => update("repositoryName", event.target.value)} placeholder="delivery-app" required /></label></div></fieldset><label>Current product guidance <span className="optional">optional</span><textarea value={form.guidance} onChange={(event) => update("guidance", event.target.value)} placeholder="Paste a confirmed goal, scope, constraints, or point the Agent to existing repository documents after setup." /></label>{error && <span className="form-error">{error}</span>}<button type="submit" disabled={submitting}>{submitting ? "Creating Project…" : "Create Project"}</button></form></section></main>;
}

const quickTypes: Array<{ value: Extract<IssueType, "bug" | "improvement" | "chore">; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "improvement", label: "Improvement" },
  { value: "chore", label: "Chore" },
];

function QuickAdd({ projectKey, onClose, onCreated }: { projectKey: string; onClose: () => void; onCreated: (issue: Issue) => void | Promise<void> }) {
  const [type, setType] = useState<(typeof quickTypes)[number]["value"]>("bug");
  const [form, setForm] = useState({ title: "", description: "", acceptance: "", first: "", second: "", reproduction: "", verification: "" });
  const [riskFlags, setRiskFlags] = useState<MaterialRiskFlag[]>([]);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const toggleRisk = (flag: MaterialRiskFlag) => setRiskFlags((current) => current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const details = type === "bug"
      ? { observedBehavior: form.first, expectedBehavior: form.second, reproductionContext: form.reproduction, verificationMethod: form.verification }
      : type === "improvement"
        ? { currentFriction: form.first, desiredOutcome: form.second, verificationMethod: form.verification }
        : { maintenanceOutcome: form.first, verificationMethod: form.verification };
    const response = await fetch("/api/v1/human/issues", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ projectKey, type, deliveryPath: "quick", source: "human_web", title: form.title, description: form.description, originalStatement: form.description, acceptanceCriteria: form.acceptance ? [form.acceptance] : [], details, riskFlags, requiredArtifactIds: [], affectedModules: [] }),
    });
    const body = (await response.json()) as { data?: Issue; error?: { message: string } };
    setSubmitting(false);
    if (!response.ok || !body.data) {
      setError(body.error?.message ?? "Quick Work could not be captured");
      return;
    }
    await onCreated(body.data);
  };
  const firstLabel = type === "bug" ? "Observed behavior" : type === "improvement" ? "Current friction" : "Maintenance outcome";
  const secondLabel = type === "bug" ? "Expected behavior" : "Desired outcome";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="quick-modal" role="dialog" aria-modal="true" aria-labelledby="quick-add-title"><button className="close" onClick={onClose} aria-label="Close Quick Add">×</button><span className="section-kicker">QUICK WORK · {projectKey}</span><h2 id="quick-add-title">Capture it now, plan only if needed</h2><p>Tandem keeps bounded work lightweight and promotes material risk without losing the Issue history.</p><form onSubmit={(event) => void submit(event)} className="quick-form"><div className="segmented">{quickTypes.map((item) => <button type="button" key={item.value} className={type === item.value ? "active" : ""} onClick={() => setType(item.value)}>{item.label}</button>)}</div><label>Short title<input value={form.title} onChange={(event) => update("title", event.target.value)} minLength={3} required /></label><label>What did you notice or want changed?<textarea value={form.description} onChange={(event) => update("description", event.target.value)} minLength={3} required /></label><label>{firstLabel}<textarea value={form.first} onChange={(event) => update("first", event.target.value)} minLength={3} required /></label>{type !== "chore" && <label>{secondLabel}<textarea value={form.second} onChange={(event) => update("second", event.target.value)} minLength={3} required /></label>}{type === "bug" && <label>Reproduction context<textarea value={form.reproduction} onChange={(event) => update("reproduction", event.target.value)} minLength={3} required /></label>}<label>Acceptance criterion<input value={form.acceptance} onChange={(event) => update("acceptance", event.target.value)} minLength={3} required /></label><label>Verification method<input value={form.verification} onChange={(event) => update("verification", event.target.value)} minLength={3} required /></label><fieldset className="risk-flags"><legend>Material impact (optional)</legend>{(["public_contract", "database_migration", "security", "privacy", "permissions", "billing", "destructive", "release"] as MaterialRiskFlag[]).map((flag) => <label key={flag}><input type="checkbox" checked={riskFlags.includes(flag)} onChange={() => toggleRisk(flag)} />{titleCase(flag)}</label>)}</fieldset>{error && <span className="form-error">{error}</span>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={submitting}>{submitting ? "Capturing…" : "Capture Quick Work"}</button></div></form></section></div>;
}

function Overview({ snapshot, onIssue, onArtifact }: { snapshot: ProjectSnapshot; onIssue: (issue: Issue) => void; onArtifact: (artifact: SnapshotArtifact) => void }) {
  const activeIssues = useMemo(() => snapshot.cycle ? snapshot.issues.filter((issue) => issue.cycleId === snapshot.cycle?.id) : snapshot.issues, [snapshot]);
  const counts = useMemo(() => ({
    ready: activeIssues.filter((issue) => issue.displayState === "ready").length,
    claimed: activeIssues.filter((issue) => issue.displayState === "claimed").length,
    in_progress: activeIssues.filter((issue) => issue.displayState === "in_progress").length,
    blocked: activeIssues.filter((issue) => issue.displayState === "blocked").length,
    review: activeIssues.filter((issue) => issue.displayState === "review").length,
    done: activeIssues.filter((issue) => issue.displayState === "done").length,
  }), [activeIssues]);
  return <>
    <section className="project-hero">
      <div className="hero-copy"><div className="project-line"><span className="project-key">{snapshot.project.key}</span><StatePill state={snapshot.project.health} /></div><h2>{snapshot.project.goal}</h2><p>Owned by {snapshot.project.owner} · {snapshot.project.repository.owner}/{snapshot.project.repository.name}</p></div>
      <div className="target"><span>{snapshot.milestone ? "Current milestone" : "Project target"}</span><strong>{snapshot.milestone?.name ?? "First delivery outcome"}</strong><small>Target {snapshot.milestone?.targetDate ?? snapshot.project.targetDate}</small></div>
    </section>

    <section className="metrics" aria-label="Delivery status">
      {[{ label: "Ready", value: counts.ready, tone: "mint" }, { label: "In progress", value: counts.claimed + counts.in_progress, tone: "blue" }, { label: "Blocked", value: counts.blocked, tone: "amber" }, { label: "Needs review", value: counts.review, tone: "violet" }].map((metric) => <div className="metric" key={metric.label}><span className={`metric-dot ${metric.tone}`} /><div><strong>{metric.value}</strong><span>{metric.label}</span></div></div>)}
    </section>

    <div className="grid-main">
      <section className="card baseline-card"><header><div><span className="section-kicker">CURRENT CONTEXT</span><h3>Effective baselines</h3></div><button className="text-button">View all →</button></header><div className="baseline-list">
        {snapshot.artifacts.filter((artifact) => artifact.effectiveRevision).map((artifact) => <button className="baseline-row" key={artifact.id} onClick={() => onArtifact(artifact)}><span className="doc-icon">≡</span><span className="baseline-copy"><strong>{artifact.title}</strong><small>{titleCase(artifact.type)} · revision {artifact.effectiveRevision?.revision}</small></span><StatePill state={artifact.effectiveRevision?.state ?? "missing"} />{artifact.proposedRevision && <span className="proposal-dot" title="Proposed revision" />}</button>)}
      </div></section>
      {snapshot.cycle ? <section className="card cycle-summary"><header><div><span className="section-kicker">ACTIVE CYCLE</span><h3>{snapshot.cycle.name}</h3></div><span className="cycle-number">C{snapshot.cycle.number}</span></header><p>{snapshot.cycle.goal}</p><div className="cycle-dates"><span>{snapshot.cycle.startsOn}</span><div><i style={{ width: `${Math.round((counts.done / Math.max(activeIssues.length, 1)) * 100)}%` }} /></div><span>{snapshot.cycle.endsOn}</span></div><ul>{snapshot.cycle.definitionOfDone.map((item) => <li key={item}>✓ {item}</li>)}</ul></section> : <section className="card cycle-summary empty-cycle"><header><div><span className="section-kicker">OPTIONAL TIMEBOX</span><h3>No active Cycle</h3></div></header><p>Quick and planned Issues can proceed without a Cycle. Add one only when a timebox helps coordinate the team.</p><StatePill state="backlog" /></section>}
    </div>

      <section className="card work-now"><header><div><span className="section-kicker">DEPENDENCY-AWARE WORK</span><h3>Delivery now</h3></div><span className="legend"><i className="mint" /> Ready <i className="amber" /> Blocked</span></header><DependencyFlow issues={activeIssues} onIssue={onIssue} /></section>

    <div className="grid-main lower">
      <section className="card"><header><div><span className="section-kicker">SUCCESS</span><h3>Measures</h3></div></header><ul className="measure-list">{snapshot.project.successMeasures.map((measure, index) => <li key={measure}><span>{index + 1}</span>{measure}</li>)}</ul></section>
      <section className="card"><header><div><span className="section-kicker">NEEDS ATTENTION</span><h3>Exceptions, not noise</h3></div><span className="attention-count">{snapshot.attention.length}</span></header>{snapshot.attention.slice(0, 3).map((item) => <div className="attention-mini" key={item.id}><span className={`severity ${item.severity}`}>!</span><div><strong>{item.title}</strong><small>{item.summary}</small></div></div>)}</section>
    </div>
  </>;
}

function DependencyFlow({ issues, onIssue }: { issues: Issue[]; onIssue: (issue: Issue) => void }) {
  const ordered = [...issues].sort((a, b) => a.key.localeCompare(b.key));
  if (!ordered.length) return <div className="empty" style={{ padding: "1.5rem" }}>No issues in this view.</div>;

  return (
    <div className="work-table" style={{ marginTop: "0.5rem" }}>
      <div className="table-row table-head">
        <span>Issue</span>
        <span>State</span>
        <span>Blocked By (Upstream)</span>
        <span>Blocks (Downstream)</span>
        <span>Modules</span>
      </div>
      {ordered.map((issue) => {
        const blockers = issue.blockedBy.map((id) => issues.find((item) => item.id === id)?.key).filter(Boolean);
        const dependents = issues.filter((item) => item.blockedBy.includes(issue.id)).map((item) => item.key);
        return (
          <button type="button" className="table-row" key={issue.id} onClick={() => onIssue(issue)}>
            <span><b>{issue.key}</b><strong>{issue.title}</strong></span>
            <span><StatePill state={issue.displayState} /></span>
            <span>{blockers.length ? <strong style={{ color: "var(--color-amber)" }}>⚠️ {blockers.join(", ")}</strong> : <span style={{ color: "var(--color-mint)" }}>✓ None</span>}</span>
            <span>{dependents.length ? <strong>➔ {dependents.join(", ")}</strong> : "—"}</span>
            <span>{issue.affectedModules.join(", ") || "—"}</span>
          </button>
        );
      })}
    </div>
  );
}

function Attention({ snapshot, onReviewIssue, onArtifact, onOpenCycles, onDecision }: { snapshot: ProjectSnapshot; onReviewIssue: (issue: Issue) => void; onArtifact: (artifact: SnapshotArtifact) => void; onOpenCycles: () => void; onDecision: (requestId: string, outcome: "approved" | "changes_requested") => Promise<void> }) {
  return <section className="page-stack"><div className="page-intro"><span className="section-kicker">HUMAN OVERSIGHT</span><h2>Decisions and exceptions</h2><p>Agent activity stays quiet until it needs judgment, context, or risk acceptance.</p></div>{snapshot.attention.length === 0 ? <Empty>Nothing needs Human attention.</Empty> : snapshot.attention.map((item) => { const issue = snapshot.issues.find((candidate) => candidate.id === item.subjectId); const decision = snapshot.decisionRequests.find((candidate) => candidate.id === item.subjectId); const decisionArtifact = decision?.subjectType === "artifact_revision" ? snapshot.artifacts.find((artifact) => artifact.proposedRevision?.id === decision.subjectId) : undefined; return <article className="attention-card" key={item.id}><span className={`severity ${item.severity}`}>!</span><div><div className="attention-meta">{decision ? `${titleCase(decision.kind)} · ${titleCase(decision.risk)} risk` : `${titleCase(item.kind)} · ${snapshot.project.key}`}</div><h3>{item.title}</h3><p>{item.summary}</p></div>{issue && <button onClick={() => onReviewIssue(issue)}>Review issue →</button>}{decision && <div className="decision-actions">{decisionArtifact && <button className="secondary" onClick={() => onArtifact(decisionArtifact)}>Review proposal</button>}{decision.subjectType === "cycle" && <button className="secondary" onClick={onOpenCycles}>Review Cycle</button>}<button className="secondary" onClick={() => void onDecision(decision.id, "changes_requested")}>Request changes</button><button onClick={() => void onDecision(decision.id, "approved")}>Approve</button></div>}</article>; })}</section>;
}

function Roadmap({ snapshot }: { snapshot: ProjectSnapshot }) {
  return <section className="page-stack"><div className="page-intro"><span className="section-kicker">OUTCOME VIEW</span><h2>Roadmap</h2><p>Initiatives, Projects, and Milestones—without inventing another work hierarchy.</p></div><article className="roadmap-track card"><div className="roadmap-project"><span className="project-key">{snapshot.project.key}</span><div><strong>{snapshot.project.name}</strong><small>{snapshot.project.goal}</small></div><StatePill state={snapshot.project.health} /></div><div className="roadmap-line"><i /><span className="milestone-dot active" /><div className="milestone-card"><small>{snapshot.milestone ? "CURRENT MILESTONE" : "PROJECT TARGET"}</small><strong>{snapshot.milestone?.name ?? "First usable delivery"}</strong><span>{snapshot.milestone?.targetDate ?? snapshot.project.targetDate}</span></div><span className="milestone-dot future" /><div className="milestone-card muted"><small>NEXT</small><strong>Pilot learning</strong><span>After release gate</span></div></div></article></section>;
}

function CycleView({ snapshot, onIssue }: { snapshot: ProjectSnapshot; onIssue: (issue: Issue) => void }) {
  const [showPropose, setShowPropose] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string>();
  const [cycleForm, setCycleForm] = useState({ name: "", goal: "", startsOn: "", endsOn: "", dod: "" });
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [cycleTab, setCycleTab] = useState<"items" | "dependencies" | "dod">("items");

  const proposeCycle = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    const dodArray = cycleForm.dod.split("\n").map(s => s.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/v1/human/projects/${snapshot.project.key}/cycles/propose`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          name: cycleForm.name,
          goal: cycleForm.goal,
          startsOn: cycleForm.startsOn || new Date().toISOString().split("T")[0],
          endsOn: cycleForm.endsOn || new Date(Date.now() + 14*86400000).toISOString().split("T")[0],
          definitionOfDone: dodArray.length ? dodArray : ["All implementation issues pass tests", "Human review verified"]
        })
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? "Could not propose Cycle");
      }
      setShowPropose(false);
      setCycleForm({ name: "", goal: "", startsOn: "", endsOn: "", dod: "" });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cycle proposal failed");
    } finally {
      setSubmitting(false);
    }
  };

  const proposed = snapshot.cycles.filter((cycle) => cycle.state === "draft" || cycle.state === "proposed");
  return (
    <section className="page-stack">
      <div className="page-intro split">
        <div>
          <span className="section-kicker">SCRUM ITERATIONS</span>
          <h2>Cycles & Sprints</h2>
          <p>Define Sprint timeboxes, goals, and explicit Definition of Done (DoD) checklists.</p>
        </div>
        <div>
          <button className="quick-add-button" onClick={() => setShowPropose(!showPropose)}>
            {showPropose ? "Close Form" : "＋ Propose New Cycle"}
          </button>
        </div>
      </div>

      {showPropose && (
        <form className="card quick-form" onSubmit={(e) => void proposeCycle(e)} style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h3>Propose New Sprint / Cycle</h3>
          {error && <span className="form-error">{error}</span>}
          <label>Cycle Name<input value={cycleForm.name} onChange={(e) => setCycleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sprint 1: Identity & Authentication MVP" required /></label>
          <label>Cycle Goal<textarea value={cycleForm.goal} onChange={(e) => setCycleForm(f => ({ ...f, goal: e.target.value }))} placeholder="High-level goal for this iteration timebox" required /></label>
          <div className="form-grid">
            <label>Starts On<input type="date" value={cycleForm.startsOn} onChange={(e) => setCycleForm(f => ({ ...f, startsOn: e.target.value }))} /></label>
            <label>Ends On<input type="date" value={cycleForm.endsOn} onChange={(e) => setCycleForm(f => ({ ...f, endsOn: e.target.value }))} /></label>
          </div>
          <label>Definition of Done (DoD) - 1 item per line
            <textarea value={cycleForm.dod} onChange={(e) => setCycleForm(f => ({ ...f, dod: e.target.value }))} placeholder="Unit and Vitest contract tests 100% pass&#10;Docker container builds and deploys cleanly&#10;Human Verification Gate approved" rows={4} required />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setShowPropose(false)}>Cancel</button>
            <button type="submit" disabled={submitting}>{submitting ? "Proposing..." : "Submit Cycle Proposal"}</button>
          </div>
        </form>
      )}

      {snapshot.cycles.length > 0 && (
        <div className="card" style={{ padding: "0.75rem 1rem", marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
          <label style={{ margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
            <span>Select Iteration / Cycle:</span>
            <select
              style={{ padding: "0.4rem 0.75rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", fontSize: "0.9rem", flex: 1 }}
              value={selectedCycleId ?? snapshot.cycle?.id ?? snapshot.cycles[0]?.id}
              onChange={(e) => setSelectedCycleId(e.target.value)}
            >
              {snapshot.cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  Cycle {c.number}: {c.name} [{c.state.toUpperCase()}] ({c.startsOn ?? "No start"} ~ {c.endsOn ?? "No end"})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {(() => {
        const currentCycle = snapshot.cycles.find(c => c.id === (selectedCycleId ?? snapshot.cycle?.id)) ?? snapshot.cycle;
        if (!currentCycle) {
          return (
            <>
              <div className="page-intro"><span className="section-kicker">OPTIONAL TIMEBOX</span><h2>No active Cycle</h2><p>This Project can deliver backlog and Quick Work directly. Humans or Agents may propose a Cycle when dependencies or a shared goal benefit from a timebox.</p></div>
              {proposed.length > 0 && <section className="proposed-cycles">{proposed.map((cycle) => <article className="card" key={cycle.id}><span className="section-kicker">PROPOSED CYCLE {cycle.number}</span><h3>{cycle.name}</h3><p>{cycle.goal}</p><StatePill state={cycle.state} /></article>)}</section>}
              <section className="card graph-card"><header><h3>Unscheduled delivery graph</h3><span>{snapshot.issues.filter((issue) => issue.displayState === "ready").length} ready</span></header><DependencyFlow issues={snapshot.issues.filter((issue) => !issue.cycleId)} onIssue={onIssue} /></section>
            </>
          );
        }
        return (
          <>
            <div className="page-intro split">
              <div><span className="section-kicker">CYCLE {currentCycle.number} · {currentCycle.state.toUpperCase()}</span><h2>{currentCycle.name}</h2><p>{currentCycle.goal}</p></div>
              <div className="revision-chip">Plan revision <strong>{currentCycle.planRevision}</strong><small>{currentCycle.planDigest.slice(0, 8)}</small></div>
            </div>
            {proposed.length > 0 && <section className="proposed-cycles">{proposed.map((cycle) => <article className="card" key={cycle.id}><span className="section-kicker">PROPOSED CYCLE {cycle.number}</span><h3>{cycle.name}</h3><p>{cycle.goal}</p><StatePill state={cycle.state} /></article>)}</section>}
            {(() => {
              const cycleIssues = snapshot.issues.filter((i) => i.cycleId === currentCycle.id);
              return (
                <>
                  <div className="segmented" style={{ marginBottom: "1.25rem", width: "fit-content" }}>
                    <button type="button" className={cycleTab === "items" ? "active" : ""} onClick={() => setCycleTab("items")}>
                      📋 Sprint Work Items ({cycleIssues.length})
                    </button>
                    <button type="button" className={cycleTab === "dependencies" ? "active" : ""} onClick={() => setCycleTab("dependencies")}>
                      🕸️ Dependency Network
                    </button>
                    <button type="button" className={cycleTab === "dod" ? "active" : ""} onClick={() => setCycleTab("dod")}>
                      ✅ Definition of Done ({currentCycle.definitionOfDone.length})
                    </button>
                  </div>

                  {cycleTab === "items" && (
                    <section className="card">
                      <header>
                        <h3>Sprint Work Items</h3>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>Click item for details & review</span>
                      </header>
                      <div className="work-table">
                        <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1fr 1fr 0.8fr" }}>
                          <span>Issue</span>
                          <span>Type</span>
                          <span>Created</span>
                          <span>Assignee / Lock</span>
                          <span>State / Approver</span>
                          <span>Modules</span>
                        </div>
                        {cycleIssues.map((issue) => {
                          const creator = issue.intake?.capturedBy?.actorId ?? "human";
                          const createdDate = issue.intake?.capturedAt ? new Date(issue.intake.capturedAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                          const assignee = issue.activeClaim?.agentId ?? "— Unclaimed";
                          return (
                            <button type="button" className="table-row" key={issue.id} onClick={() => onIssue(issue)} style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1fr 1fr 0.8fr" }}>
                              <span><b>{issue.key}</b><strong>{issue.title}</strong></span>
                              <span>{titleCase(issue.type)}</span>
                              <span style={{ fontSize: "12px", color: "var(--muted)" }}>👤 {creator}<br /><small>{createdDate}</small></span>
                              <span style={{ fontSize: "12px", fontWeight: issue.activeClaim ? 600 : 400, color: issue.activeClaim ? "var(--green)" : "var(--muted)" }}>
                                {issue.activeClaim ? `🔒 ${assignee}` : "— Unclaimed"}
                              </span>
                              <span>
                                <StatePill state={issue.displayState} />
                                {issue.displayState === "done" && <small style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>✓ pilot-owner</small>}
                              </span>
                              <span>{issue.affectedModules.join(", ") || "—"}</span>
                            </button>
                          );
                        })}
                        {!cycleIssues.length && <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>No issues scheduled in this Cycle.</div>}
                      </div>
                    </section>
                  )}

                  {cycleTab === "dependencies" && (
                    <section className="card graph-card">
                      <header>
                        <h3>Cycle Dependency Network</h3>
                        <span>{cycleIssues.filter((i) => i.displayState === "ready").length} ready to start</span>
                      </header>
                      <div style={{ padding: "1rem" }}>
                        <DependencyFlow issues={cycleIssues} onIssue={onIssue} />
                      </div>
                    </section>
                  )}

                  {cycleTab === "dod" && (
                    <section className="card">
                      <header>
                        <h3>Definition of Done (DoD) & Iteration Criteria</h3>
                      </header>
                      <ul className="check-list" style={{ gridTemplateColumns: "1fr", padding: "1.25rem 1.5rem" }}>
                        {currentCycle.definitionOfDone.map((item) => (
                          <li key={item} style={{ fontSize: "15px", padding: "8px 0", borderBottom: "1px solid #f0f3f0" }}>
                            <span style={{ fontWeight: "bold", marginRight: "10px" }}>✓</span>{item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              );
            })()}
          </>
        );
      })()}
    </section>
  );
}

function Work({ snapshot, onIssue }: { snapshot: ProjectSnapshot; onIssue: (issue: Issue) => void }) {
  const [mode, setMode] = useState<"kanban" | "list" | "cycles" | "roadmap">("kanban");
  const [compact, setCompact] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const [kanbanCycleId, setKanbanCycleId] = useState<string>("ALL");

  const columns: Array<{ id: string; title: string; filter: (issue: Issue) => boolean }> = [
    { id: "backlog", title: "Backlog", filter: (i) => (kanbanCycleId === "ALL" || i.cycleId === kanbanCycleId) && (i.baseState === "backlog" || i.displayState === "blocked") },
    { id: "ready", title: "Ready", filter: (i) => (kanbanCycleId === "ALL" || i.cycleId === kanbanCycleId) && i.displayState === "ready" },
    { id: "in_progress", title: "In Progress", filter: (i) => (kanbanCycleId === "ALL" || i.cycleId === kanbanCycleId) && i.displayState === "claimed" },
    { id: "in_review", title: "In Review", filter: (i) => (kanbanCycleId === "ALL" || i.cycleId === kanbanCycleId) && i.displayState === "review" },
    { id: "done", title: "Done", filter: (i) => (kanbanCycleId === "ALL" || i.cycleId === kanbanCycleId) && i.displayState === "done" },
  ];

  return (
    <section className="page-stack">
      <div className="page-intro split">
        <div>
          <span className="section-kicker">AGILE WORKFLOW</span>
          <h2>Board & Work</h2>
          <p>GitHub Projects-style delivery board, Scrum Sprints, and Roadmap milestones.</p>
        </div>
        <div className="segmented">
          <button type="button" className={mode === "kanban" ? "active" : ""} onClick={() => setMode("kanban")}>Kanban Board</button>
          <button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>List View</button>
          <button type="button" className={mode === "cycles" ? "active" : ""} onClick={() => setMode("cycles")}>Cycles & Sprints</button>
          <button type="button" className={mode === "roadmap" ? "active" : ""} onClick={() => setMode("roadmap")}>Roadmap</button>
        </div>
      </div>

      {mode === "kanban" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <label style={{ fontSize: "14px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "8px" }}>
              Filter by Cycle:
              <select
                value={kanbanCycleId}
                onChange={(e) => setKanbanCycleId(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff" }}
              >
                <option value="ALL">All Cycles & Backlog</option>
                {snapshot.cycles.map((c) => (
                  <option key={c.id} value={c.id}>Cycle {c.number}: {c.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="kanban-board">
            {columns.map((col) => {
              const allItems = snapshot.issues.filter(col.filter);
              const items = col.id === "done" && !showAllDone ? allItems.slice(0, 5) : allItems;
              return (
                <div className="kanban-column" key={col.id}>
                  <div className="kanban-header">
                    <strong>{col.title}</strong>
                    <span className="kanban-count">{allItems.length}</span>
                  </div>
                  <div className="kanban-cards">
                    {items.map((issue) => (
                      <button type="button" className="kanban-card" key={issue.id} onClick={() => onIssue(issue)}>
                        <div className="kanban-card-top">
                          <span className="kanban-key">{issue.key}</span>
                          <StatePill state={issue.displayState} />
                        </div>
                        <h4>{issue.title}</h4>
                        <div className="kanban-card-meta">
                          <span>{titleCase(issue.type)} {issue.cycleId ? `· C${snapshot.cycles.find(c => c.id === issue.cycleId)?.number ?? 1}` : ""}</span>
                          {issue.activeClaim && <span className="claim-badge">🔒 {issue.activeClaim.agentId}</span>}
                        </div>
                      </button>
                    ))}
                    {col.id === "done" && allItems.length > 5 && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setShowAllDone(!showAllDone)}
                        style={{ fontSize: "13px", padding: "8px 0", color: "var(--green)", fontWeight: 600, textAlign: "center", width: "100%" }}
                      >
                        {showAllDone ? "Show recent 5 only ⬆" : `+ Show ${allItems.length - 5} more completed ⬇`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {mode === "list" && (
        <div className="card">
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #ebeeea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", color: "var(--muted)" }}>Total {snapshot.issues.length} Issues</span>
            <button
              type="button"
              className="refresh"
              onClick={() => setCompact(!compact)}
              style={{ fontSize: "12px", height: "28px" }}
            >
              Density: {compact ? "Compact ⚡" : "Relaxed ☕"}
            </button>
          </div>
          <div className="work-table">
            <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1fr 1fr 0.8fr", ...(compact ? { padding: "8px 16px" } : {}) }}>
              <span>Issue</span>
              <span>Type / path</span>
              <span>Created</span>
              <span>Assignee / Lock</span>
              <span>State / Approver</span>
              <span>Modules</span>
            </div>
            {snapshot.issues.map((issue) => {
              const creator = issue.intake?.capturedBy?.actorId ?? "human";
              const createdDate = issue.intake?.capturedAt ? new Date(issue.intake.capturedAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
              const assignee = issue.activeClaim?.agentId ?? "— Unclaimed";
              const handoff = snapshot.handoffs.find((h) => h.issueId === issue.id);
              return (
                <button
                  type="button"
                  className="table-row"
                  key={issue.id}
                  onClick={() => onIssue(issue)}
                  style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1fr 1fr 0.8fr", ...(compact ? { padding: "7px 16px" } : {}) }}
                >
                  <span><b>{issue.key}</b><strong>{issue.title}</strong></span>
                  <span>{titleCase(issue.type)}<small className={`path-label path-${issue.deliveryPath}`}>{titleCase(issue.deliveryPath)}</small></span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>👤 {creator}<br /><small>{createdDate}</small></span>
                  <span style={{ fontSize: "12px", fontWeight: issue.activeClaim ? 600 : 400, color: issue.activeClaim ? "var(--green)" : "var(--muted)" }}>
                    {issue.activeClaim ? `🔒 ${assignee}` : "— Unclaimed"}
                  </span>
                  <span>
                    <StatePill state={issue.displayState} />
                    {issue.displayState === "done" && <small style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>✓ pilot-owner</small>}
                  </span>
                  <span>{issue.affectedModules.join(", ") || "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === "cycles" && <CycleView snapshot={snapshot} onIssue={onIssue} />}
      {mode === "roadmap" && <Roadmap snapshot={snapshot} />}
    </section>
  );
}

function Artifacts({ snapshot, onArtifact }: { snapshot: ProjectSnapshot; onArtifact: (artifact: SnapshotArtifact) => void }) {
  return <section className="page-stack"><div className="page-intro"><span className="section-kicker">DELIVERY KNOWLEDGE</span><h2>Artifacts</h2><p>The effective baseline is primary. Proposals and history remain explicit.</p></div><div className="artifact-grid">{snapshot.artifacts.map((artifact) => <button className="artifact-card card" key={artifact.id} onClick={() => onArtifact(artifact)}><div className="artifact-top"><span className="large-doc">≡</span><StatePill state={artifact.effectiveRevision?.state ?? "missing"} /></div><h3>{artifact.title}</h3><p>{titleCase(artifact.type)}</p><div className="artifact-meta"><span>{artifact.effectiveRevision ? `Effective r${artifact.effectiveRevision.revision}` : "No effective baseline"}</span><span>{artifact.effectiveRevision?.storageMode === "git_backed" ? "Git-backed" : "Tandem draft"}</span></div>{artifact.proposedRevision && <div className="proposal-banner">● Proposed revision {artifact.proposedRevision.revision}</div>}</button>)}</div></section>;
}

function Sessions({ snapshot }: { snapshot: ProjectSnapshot }) {
  return <section className="page-stack"><div className="page-intro"><span className="section-kicker">AGENT CONTINUITY</span><h2>Agent Sessions</h2><p>Every implementation session reads current baselines and code before claiming work.</p></div>{snapshot.sessions.length === 0 ? <Empty><strong>No active Agent Sessions</strong><span>Run <code>pnpm demo:agent</code> while the API is running, then refresh.</span></Empty> : <div className="session-list">{snapshot.sessions.map((session) => <article className="session-card card" key={session.id}><span className="agent-avatar">AI</span><div><div className="session-meta">{session.agentId} · {session.id.slice(0, 8)}</div><h3>{snapshot.issues.find((issue) => issue.id === session.issueId)?.key ?? snapshot.project.key}</h3><p>{session.understanding ?? "Reading required project context"}</p><div className="context-progress"><i style={{ width: session.confirmedAt ? "100%" : "35%" }} /></div><small>{session.contextItems.length} context items · digest {session.contextDigest.slice(0, 8)}</small></div><StatePill state={session.stale ? "stale" : session.state} /></article>)}</div>}</section>;
}

function ActivityView({ snapshot }: { snapshot: ProjectSnapshot }) {
  return <section className="page-stack"><div className="page-intro"><span className="section-kicker">AUDIT TRAIL</span><h2>Activity</h2><p>Semantic delivery events, with raw Agent noise left outside the system.</p></div><div className="timeline">{snapshot.activities.map((activity) => <article key={activity.id}><span className={`actor-dot ${activity.actorType}`} /> <div><div><strong>{activity.action}</strong><span>{new Date(activity.occurredAt).toLocaleString()}</span></div><p>{activity.summary}</p><small>{activity.actorType} · {activity.actorId}</small></div></article>)}</div></section>;
}

function IssueDetail({ issue, snapshot, verificationMode, onReview }: { issue: Issue; snapshot: ProjectSnapshot; verificationMode: boolean; onReview: (issue: Issue, outcome: "approved" | "changes_requested", rationale: string) => Promise<void> }) {
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "changes_requested">();
  const [reviewError, setReviewError] = useState<string>();
  const submitReview = async (outcome: "approved" | "changes_requested") => {
    setSubmitting(outcome);
    setReviewError(undefined);
    try {
      await onReview(issue, outcome, rationale.trim());
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : "The Human verification decision could not be recorded");
      setSubmitting(undefined);
    }
  };
  return <div className={verificationMode ? "verification-workspace" : undefined}>
    {verificationMode && <header className="verification-banner"><span>HUMAN VERIFICATION</span><strong>Review accepted intent and delivery evidence before deciding.</strong><small>Opening this workspace records no decision.</small></header>}
    <IssueDetailContent issue={issue} snapshot={snapshot} />
    {verificationMode && issue.displayState === "review" && <form className="verification-actions" onSubmit={(event) => event.preventDefault()}>
      <span className="section-kicker">HUMAN DECISION</span>
      <h3>Resolve delivery review</h3>
      <p>Approval completes the Issue. Requesting changes preserves this evidence and handoff, releases the previous claim, and makes the work available for a new Agent session.</p>
      <label htmlFor={`review-rationale-${issue.id}`}>Decision rationale<textarea id={`review-rationale-${issue.id}`} value={rationale} onChange={(event) => setRationale(event.target.value)} minLength={5} required placeholder="What did you verify, or what must change?" /></label>
      {reviewError && <span className="form-error" role="alert">{reviewError}</span>}
      <div className="verification-buttons">
        <button type="button" className="secondary" disabled={Boolean(submitting) || rationale.trim().length < 5} onClick={() => void submitReview("changes_requested")}>{submitting === "changes_requested" ? "Recording…" : "Request changes"}</button>
        <button type="button" disabled={Boolean(submitting) || rationale.trim().length < 5} onClick={() => void submitReview("approved")}>{submitting === "approved" ? "Completing…" : "Approve & complete"}</button>
      </div>
      <small className="authority-note">Recorded as the signed-in Human. Agents cannot perform this action.</small>
    </form>}
  </div>;
}

function IssueDetailContent({ issue, snapshot }: { issue: Issue; snapshot: ProjectSnapshot }) {
  const blockers = issue.blockedBy.map((id) => snapshot.issues.find((item) => item.id === id)).filter(Boolean) as Issue[];
  const evidence = snapshot.evidence.filter((item) => item.issueId === issue.id);
  const handoff = snapshot.handoffs.find((item) => item.issueId === issue.id);
  const gitArtifacts = snapshot.gitArtifacts?.filter((artifact) => artifact.issueKey === issue.key) ?? [];
  const detailEntries = Object.entries(issue.intake.details).filter((entry): entry is [string, string] => Boolean(entry[1]));
  return <div className="panel-content">
    <span className="section-kicker">{titleCase(issue.type)} · {issue.key}</span>
    <h2>{issue.title}</h2>
    <div className="panel-pills"><StatePill state={issue.displayState} /><span className={`path-label path-${issue.deliveryPath}`}>{titleCase(issue.deliveryPath)} path</span><span className={`risk-label risk-${issue.risk.class}`}>{titleCase(issue.risk.class)} risk</span></div>
    <p className="lead">{issue.description}</p>
    <PanelSection title="Life-cycle Ownership & Audit">
      <div className="key-values">
        <span>Created by</span>
        <strong>👤 {issue.intake?.capturedBy?.actorId ?? "human"} <small style={{ fontWeight: 400, color: "var(--muted)" }}>({issue.intake?.capturedAt ? new Date(issue.intake.capturedAt).toLocaleString() : "—"})</small></strong>
        <span>Current Assignee</span>
        <strong>{issue.activeClaim ? `🔒 ${issue.activeClaim.agentId} (${new Date(issue.activeClaim.claimedAt).toLocaleString()})` : "— Unclaimed"}</strong>
        <span>State / Approver</span>
        <strong>{issue.displayState === "done" ? "✓ Approved by pilot-owner" : issue.displayState}</strong>
      </div>
    </PanelSection>
    <PanelSection title="Original intake"><blockquote>{issue.intake.originalStatement}</blockquote><small>{titleCase(issue.intake.source)} · {issue.intake.capturedBy.actorType} {issue.intake.capturedBy.actorId}</small>{detailEntries.map(([key, value]) => <div className="intake-detail" key={key}><span>{titleCase(key)}</span><p>{value}</p></div>)}</PanelSection>
    {issue.promotion && <PanelSection title="Promotion"><div className="warning-line">! Promoted to planned delivery</div><p>{issue.promotion.reasons.join(" · ")}</p><small>{new Date(issue.promotion.promotedAt).toLocaleString()} · {issue.promotion.promotedBy.actorId}</small></PanelSection>}
    <PanelSection title="Acceptance">{issue.acceptanceCriteria.map((criterion) => <div className="criterion" key={criterion}>○ {criterion}</div>)}{!issue.acceptanceCriteria.length && <small>Acceptance criteria still need enrichment.</small>}</PanelSection>
    <PanelSection title="Readiness">{blockers.length ? blockers.map((blocker) => <div className="dependency" key={blocker.id}><StatePill state={blocker.displayState} /> {blocker.key} · {blocker.title}</div>) : <div className="success-line">✓ No incomplete dependencies</div>}{issue.readinessReasons.map((reason) => <div className="warning-line" key={reason}>! {reason}</div>)}</PanelSection>
    <PanelSection title="Execution"><div className="key-values"><span>Affected modules</span><strong>{issue.affectedModules.join(", ") || "Not identified"}</strong><span>Active claim</span><strong>{issue.activeClaim?.agentId ?? "Not claimed"}</strong><span>Version</span><strong>{issue.version}</strong></div></PanelSection>
    <PanelSection title="Baseline Specs">{snapshot.artifacts.filter(a => a.effectiveRevision).map(a => <div className="evidence-line" key={a.id}><span>≡</span><div><strong>{a.title} (r{a.effectiveRevision?.revision})</strong><small>{titleCase(a.type)} · Hash {a.effectiveRevision?.digest.slice(0, 8)}</small></div></div>)}</PanelSection>
    <PanelSection title={`Git delivery · ${gitArtifacts.length}`}>{gitArtifacts.map((artifact) => <div className="evidence-line" key={artifact.id}><span>↗</span><div><strong>{titleCase(artifact.kind)} · {artifact.title}</strong><small>{artifact.repository} · {artifact.state}</small></div></div>)}{!gitArtifacts.length && <small>No linked branch, commit, pull request, or check yet.</small>}</PanelSection>
    <PanelSection title={`Evidence · ${evidence.length}`}>{evidence.map((item) => <div className="evidence-line" key={item.id}><span>{item.result === "passed" ? "✓" : "!"}</span><div><strong>{item.title}</strong><small>{item.summary}</small></div></div>)}{!evidence.length && <small>No evidence attached yet.</small>}</PanelSection>
    {handoff && <PanelSection title="Handoff"><p>{handoff.summary}</p><small>{handoff.nextSteps.join(" · ")}</small></PanelSection>}
  </div>;
}

function ArtifactDetail({ artifact }: { artifact: Artifact & { effectiveRevision?: ArtifactRevision; proposedRevision?: ArtifactRevision } }) {
  return <div className="panel-content"><span className="section-kicker">{titleCase(artifact.type)}</span><h2>{artifact.title}</h2><div className="artifact-tabs"><button className="active">Current baseline</button><button>Proposed change {artifact.proposedRevision ? `· r${artifact.proposedRevision.revision}` : ""}</button><button>History</button></div>{artifact.effectiveRevision && <><div className="revision-header"><StatePill state={artifact.effectiveRevision.state} /><span>revision {artifact.effectiveRevision.revision}</span><code>{artifact.effectiveRevision.digest.slice(0, 10)}</code></div><article className="markdown-preview">{artifact.effectiveRevision.content.split("\n").map((line, index) => line.startsWith("# ") ? <h1 key={index}>{line.slice(2)}</h1> : line.startsWith("## ") ? <h2 key={index}>{line.slice(3)}</h2> : line ? <p key={index}>{line}</p> : <br key={index} />)}</article><div className="source-box"><span>Source</span><strong>{artifact.effectiveRevision.git?.path ?? "Tandem"}</strong><small>{artifact.effectiveRevision.storageMode}</small></div></>}{artifact.proposedRevision && <div className="proposal-preview"><span>PROPOSAL AVAILABLE</span><p>{artifact.proposedRevision.content.replaceAll("#", "").trim()}</p></div>}</div>;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel-section"><h3>{title}</h3>{children}</section>;
}

function SettingsView({ snapshot }: { snapshot: ProjectSnapshot }) {
  const [principals, setPrincipals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showAddHuman, setShowAddHuman] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] = useState<{ secret: string; warning: string; type: "human" | "agent"; displayName: string }>();

  const [humanForm, setHumanForm] = useState({ username: "", displayName: "", password: "" });
  const [agentForm, setAgentForm] = useState({ displayName: "", tokenLabel: "Default Agent Token" });

  const defaultPrincipals = [
    { id: "pilot-owner", type: "human", displayName: "Pilot Owner", status: "active", roles: ["owner"], username: "owner" },
    { id: "pilot-agent", type: "agent", displayName: "Pilot Coding Agent", status: "active", roles: ["coding_agent"] },
  ];

  const loadPrincipals = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/human/principals", { credentials: "include" });
      if (!res.ok) {
        setPrincipals(defaultPrincipals);
        setError(undefined);
        setLoading(false);
        return;
      }
      const body = await res.json();
      setPrincipals(body.data && body.data.length ? body.data : defaultPrincipals);
      setError(undefined);
    } catch (err) {
      setPrincipals(defaultPrincipals);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPrincipals(); }, []);

  const createHuman = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const res = await fetch("/api/v1/human/principals/humans", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        username: humanForm.username,
        displayName: humanForm.displayName,
        password: humanForm.password,
        roles: ["team_member"],
        projectKeys: [snapshot.project.key],
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error?.message ?? "Could not create Human");
      return;
    }
    setOneTimeSecret({ secret: body.secret, warning: body.warning, type: "human", displayName: humanForm.displayName });
    setShowAddHuman(false);
    setHumanForm({ username: "", displayName: "", password: "" });
    await loadPrincipals();
  };

  const createAgent = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      const res = await fetch("/api/v1/human/principals/agents", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          displayName: agentForm.displayName,
          tokenLabel: agentForm.tokenLabel,
          projectKeys: [snapshot.project.key],
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Could not create Agent");
        return;
      }
      setOneTimeSecret({ secret: body.secret, warning: body.warning, type: "agent", displayName: agentForm.displayName });
      setShowAddAgent(false);
      setAgentForm({ displayName: "", tokenLabel: "Default Agent Token" });
      await loadPrincipals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating Agent");
    }
  };

  const [editingId, setEditingId] = useState<string>();
  const [editName, setEditName] = useState<string>("");

  const updateStatus = async (id: string, newStatus: "active" | "deactivated") => {
    setError(undefined);
    const res = await fetch(`/api/v1/human/principals/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error?.message ?? "Could not update status");
      return;
    }
    await loadPrincipals();
  };

  const saveDisplayName = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editName.trim()) return;
    setError(undefined);
    try {
      const res = await fetch(`/api/v1/human/principals/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ displayName: editName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error?.message ?? "Could not update Display Name");
      } else {
        setEditingId(undefined);
        await loadPrincipals();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating Display Name");
    }
  };

  const regenerateAgentToken = async (agentId: string, agentName: string) => {
    setError(undefined);
    try {
      const res = await fetch(`/api/v1/human/principals/${agentId}/tokens`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ label: `Regenerated Token for ${agentName}` }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Could not regenerate token");
        return;
      }
      setOneTimeSecret({ secret: body.secret, warning: body.warning, type: "agent", displayName: agentName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error regenerating token");
    }
  };

  const copyAgentMcpConfig = (agentName: string, token: string = "<YOUR_AGENT_BEARER_TOKEN>") => {
    const config = JSON.stringify({
      mcpServers: {
        tandem: {
          url: "http://127.0.0.1:4310/mcp",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    }, null, 2);
    void navigator.clipboard.writeText(config);
    alert(`Copied MCP JSON Configuration for Agent "${agentName}"!`);
  };

  return (
    <section className="page-stack">
      <div className="page-intro split">
        <div>
          <span className="section-kicker">IDENTITY ADMINISTRATION</span>
          <h2>People & Agents</h2>
          <p>Manage Human users and Coding Agent credentials for Project {snapshot.project.key}.</p>
        </div>
        <div className="top-actions">
          <button className="secondary" onClick={() => { setShowAddAgent(true); setShowAddHuman(false); setOneTimeSecret(undefined); }}>＋ Add Agent</button>
          <button className="quick-add-button" onClick={() => { setShowAddHuman(true); setShowAddAgent(false); setOneTimeSecret(undefined); }}>＋ Add Human</button>
        </div>
      </div>

      {oneTimeSecret && oneTimeSecret.type === "human" && (
        <div className="card" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", padding: "1.25rem", marginBottom: "1.5rem", borderRadius: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#10b981", fontSize: "16px" }}>
              👤 Human Account "{oneTimeSecret.displayName}" Created Successfully
            </strong>
            <button className="secondary" style={{ padding: "3px 10px", fontSize: "12px" }} onClick={() => setOneTimeSecret(undefined)}>Done ✕</button>
          </div>
          <p style={{ margin: "0.5rem 0", fontSize: "13px", color: "var(--muted)" }}>{oneTimeSecret.warning || "Save this initial password now. It will not be displayed again."}</p>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
            <code style={{ background: "#000", color: "#10b981", padding: "8px 12px", borderRadius: "6px", fontSize: "14px", flex: 1, wordBreak: "break-all" }}>
              {oneTimeSecret.secret}
            </code>
            <button
              type="button"
              className="refresh"
              onClick={() => {
                void navigator.clipboard.writeText(oneTimeSecret.secret);
                alert("Copied Initial Password!");
              }}
              style={{ fontSize: "12px", whiteSpace: "nowrap" }}
            >
              📋 Copy Password
            </button>
          </div>
        </div>
      )}

      {oneTimeSecret && oneTimeSecret.type === "agent" && (
        <div className="card" style={{ background: "#18241f", color: "#e3ebd8", border: "1px solid var(--green)", padding: "1.25rem", marginBottom: "1.5rem", borderRadius: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#10b981", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              🎉 Agent Credential "{oneTimeSecret.displayName}" Created Successfully!
            </strong>
            <button className="secondary" style={{ padding: "3px 10px", fontSize: "12px" }} onClick={() => setOneTimeSecret(undefined)}>Done ✕</button>
          </div>
          <p style={{ margin: "0.75rem 0", fontSize: "13px", color: "#a0b5a8" }}>
            {oneTimeSecret.warning || "Save this Bearer Token and MCP configuration now. The secret token will not be displayed again."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Agent Bearer Token</span>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <code style={{ background: "#0b120e", color: "#10b981", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", flex: 1, wordBreak: "break-all" }}>
                  {oneTimeSecret.secret}
                </code>
                <button
                  type="button"
                  className="refresh"
                  onClick={() => {
                    void navigator.clipboard.writeText(oneTimeSecret.secret);
                    alert("Copied Agent Bearer Token!");
                  }}
                  style={{ fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  📋 Copy Token
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>MCP Endpoint URL</span>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <code style={{ background: "#0b120e", color: "#68d391", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", flex: 1 }}>
                  http://127.0.0.1:4310/mcp
                </code>
                <button
                  type="button"
                  className="refresh"
                  onClick={() => {
                    void navigator.clipboard.writeText("http://127.0.0.1:4310/mcp");
                    alert("Copied MCP Endpoint URL!");
                  }}
                  style={{ fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  📋 Copy URL
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                MCP Configuration Snippet (for Claude / Cursor / Antigravity)
              </span>
              <button
                type="button"
                className="refresh"
                onClick={() => copyAgentMcpConfig(oneTimeSecret.displayName, oneTimeSecret.secret)}
                style={{ fontSize: "12px" }}
              >
                📋 Copy Full MCP JSON Config
              </button>
            </div>
            <pre style={{ background: "#0b120e", color: "#d1d5db", padding: "12px", borderRadius: "6px", fontSize: "12px", overflowX: "auto", margin: 0 }}>
              {JSON.stringify({
                mcpServers: {
                  tandem: {
                    url: "http://127.0.0.1:4310/mcp",
                    headers: {
                      Authorization: `Bearer ${oneTimeSecret.secret}`
                    }
                  }
                }
              }, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {error && <div className="form-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {showAddHuman && (
        <form onSubmit={(e) => void createHuman(e)} className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3>Add Human User</h3>
          <label>Username<input value={humanForm.username} onChange={(e) => setHumanForm((f) => ({ ...f, username: e.target.value }))} required /></label>
          <label>Display Name<input value={humanForm.displayName} onChange={(e) => setHumanForm((f) => ({ ...f, displayName: e.target.value }))} required /></label>
          <label>Password<input type="password" value={humanForm.password} onChange={(e) => setHumanForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} /></label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="button" className="secondary" onClick={() => setShowAddHuman(false)}>Cancel</button>
            <button type="submit">Create User</button>
          </div>
        </form>
      )}

      {showAddAgent && (
        <form onSubmit={(e) => void createAgent(e)} className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3>Add Coding Agent</h3>
          <label>Agent Name<input value={agentForm.displayName} onChange={(e) => setAgentForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="e.g. Claude Coding Agent" required minLength={2} /></label>
          <label>Token Label<input value={agentForm.tokenLabel} onChange={(e) => setAgentForm((f) => ({ ...f, tokenLabel: e.target.value }))} required /></label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="button" className="secondary" onClick={() => setShowAddAgent(false)}>Cancel</button>
            <button type="submit">Create Agent Token</button>
          </div>
        </form>
      )}

      {loading ? (
        <Empty>Loading principals…</Empty>
      ) : (
        <div className="work-table card">
          <div className="table-row table-head">
            <span>Principal Name</span>
            <span>Type / Username</span>
            <span>Status</span>
            <span>Roles</span>
            <span>Actions</span>
          </div>
          {principals.map((p) => (
            <div className="table-row" key={p.id}>
              <span>
                {editingId === p.id ? (
                  <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ padding: "2px 6px", fontSize: "13px", borderRadius: "4px", border: "1px solid var(--green)" }}
                    />
                    <button type="button" className="refresh" onClick={(e) => void saveDisplayName(e, p.id)} style={{ fontSize: "11px", padding: "2px 6px" }}>Save</button>
                    <button type="button" className="secondary" onClick={() => setEditingId(undefined)} style={{ fontSize: "11px", padding: "2px 6px" }}>✕</button>
                  </span>
                ) : (
                  <>
                    <b>{p.displayName}</b>
                    <small>{p.id}</small>
                  </>
                )}
              </span>
              <span>
                {titleCase(p.type)}
                {p.username && <small>({p.username})</small>}
              </span>
              <span><StatePill state={p.status} /></span>
              <span>{p.roles.join(", ")}</span>
              <span style={{ display: "flex", gap: "6px" }}>
                {p.type === "agent" && (
                  <>
                    <button
                      type="button"
                      className="refresh"
                      style={{ padding: "2px 8px", fontSize: "0.8rem", color: "#10b981", borderColor: "#10b981" }}
                      onClick={() => void regenerateAgentToken(p.id, p.displayName)}
                      title="Issue a fresh Token & Copy Config Panel for this Agent"
                    >
                      🔑 Regenerate Token & Config
                    </button>
                    <button
                      type="button"
                      className="refresh"
                      style={{ padding: "2px 8px", fontSize: "0.8rem" }}
                      onClick={() => copyAgentMcpConfig(p.displayName)}
                      title="Copy Endpoint URL and JSON Template"
                    >
                      📋 Copy MCP Template
                    </button>
                  </>
                )}
                {editingId !== p.id && (
                  <button
                    type="button"
                    className="refresh"
                    style={{ padding: "2px 8px", fontSize: "0.8rem" }}
                    onClick={() => { setEditingId(p.id); setEditName(p.displayName); }}
                  >
                    ✏️ Edit Name
                  </button>
                )}
                {p.status === "active" ? (
                  <button className="secondary" style={{ padding: "2px 8px", fontSize: "0.8rem" }} onClick={() => void updateStatus(p.id, "deactivated")}>Deactivate</button>
                ) : (
                  <button className="secondary" style={{ padding: "2px 8px", fontSize: "0.8rem" }} onClick={() => void updateStatus(p.id, "active")}>Reactivate</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
