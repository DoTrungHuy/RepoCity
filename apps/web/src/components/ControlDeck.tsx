import { FormEvent, useEffect, useState } from "react";
import type { ImportRequest, LocalCandidate, RepoGraph, RepoSummary, ScanTask } from "@repocity/shared";
import { ChevronDown, ChevronUp, Github, HardDrive, Loader2, Map, RadioTower } from "lucide-react";
import { GlassSurface } from "./GlassSurface";

interface ControlDeckProps {
  repositories: RepoSummary[];
  localCandidates: LocalCandidate[];
  selectedRepoId: string;
  status: string;
  scan?: ScanTask;
  isImporting?: boolean;
  graph?: RepoGraph;
  onSelectRepository: (repoId: string) => void;
  onImportRepository: (payload: ImportRequest) => void;
}

export function ControlDeck({
  repositories,
  localCandidates,
  selectedRepoId,
  status,
  scan,
  isImporting = false,
  graph,
  onSelectRepository,
  onImportRepository
}: ControlDeckProps) {
  const [importType, setImportType] = useState<ImportRequest["type"]>("github");
  const [urlOrPath, setUrlOrPath] = useState("https://github.com/vitejs/vite");
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia?.("(max-width: 900px)").matches;
    if (isMobile) setIsCollapsed(true);
  }, []);

  useEffect(() => {
    if (importType === "local" && localCandidates[0]) {
      setUrlOrPath(localCandidates[0].path);
    }
    if (importType === "github") {
      setUrlOrPath("https://github.com/vitejs/vite");
    }
  }, [importType, localCandidates]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onImportRepository({ type: importType, urlOrPath });
  }

  const fileCount = graph?.nodes.filter((node) => node.kind === "file").length ?? 0;
  const importEdges = graph?.edges.filter((edge) => edge.kind === "imports").length ?? 0;
  const topLanguages = graph?.languages.slice(0, 5) ?? [];
  const currentStatus = scan?.message ?? status;
  const scanBusy = isImporting || scan?.status === "running" || scan?.status === "queued";

  if (isCollapsed) {
    return (
      <GlassSurface as="section" className="control-deck is-collapsed" variant="dock" intensity="medium" radius={18} aria-label="Repository controls">
        <button
          type="button"
          className="deck-toggle"
          aria-label="Open repository controls"
          aria-expanded="false"
          title="Open controls"
          onClick={() => setIsCollapsed(false)}
        >
          <ChevronDown size={18} />
        </button>
        <div className="brand-row">
          <div className="brand-mark">
            <Map size={20} />
          </div>
          <div>
            <h1>RepoCity</h1>
            <p>{graph?.name ?? "Repository to 3D code city"}</p>
          </div>
        </div>
        <div className="status-line">
          <span className={scan?.status === "failed" ? "status-dot error" : "status-dot"} />
          <span>{currentStatus}</span>
        </div>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface as="section" className="control-deck" variant="dock" intensity="medium" radius={20} aria-label="Repository controls">
      <button
        type="button"
        className="deck-toggle"
        aria-label="Collapse repository controls"
        aria-expanded="true"
        title="Collapse controls"
        onClick={() => setIsCollapsed(true)}
      >
        <ChevronUp size={18} />
      </button>
      <div className="brand-row">
        <div className="brand-mark">
          <Map size={22} />
        </div>
        <div>
          <h1>RepoCity</h1>
          <p>Repository to 3D code city</p>
        </div>
      </div>

      <div className="repository-picker">
        <label className="field-label" htmlFor="repository-select">
          City source
        </label>
        <select id="repository-select" value={selectedRepoId} onChange={(event) => onSelectRepository(event.target.value)}>
          {repositories.map((repository) => (
            <option key={repository.id} value={repository.id}>
              {repository.name}
            </option>
          ))}
        </select>
      </div>

      {graph ? (
        <div className="telemetry-grid" aria-label="Repository telemetry">
          <div>
            <span>Files</span>
            <strong>{fileCount}</strong>
          </div>
          <div>
            <span>Links</span>
            <strong>{importEdges}</strong>
          </div>
          <div>
            <span>Lang</span>
            <strong>{graph.languages.length}</strong>
          </div>
        </div>
      ) : null}

      <form className="import-form" onSubmit={submit} aria-label="Scan a repository">
        <div className="segmented" aria-label="Import type">
          <button type="button" className={importType === "github" ? "active" : ""} onClick={() => setImportType("github")}>
            <Github size={15} />
            GitHub
          </button>
          <button type="button" className={importType === "local" ? "active" : ""} onClick={() => setImportType("local")}>
            <HardDrive size={15} />
            Local
          </button>
        </div>
        <input
          value={urlOrPath}
          onChange={(event) => setUrlOrPath(event.target.value)}
          list={importType === "local" ? "local-repositories" : undefined}
          aria-label={importType === "local" ? "Local repository path" : "GitHub repository URL"}
        />
        <datalist id="local-repositories">
          {localCandidates.map((candidate) => (
            <option key={candidate.path} value={candidate.path}>
              {candidate.name}
            </option>
          ))}
        </datalist>
        <button className="primary-action" type="submit" disabled={scanBusy || !urlOrPath.trim()}>
          {scanBusy ? <Loader2 className="spin" size={16} /> : <RadioTower size={16} />}
          {scanBusy ? "Scanning" : "Scan"}
        </button>
      </form>

      <div className="status-line">
        <span className={scan?.status === "failed" ? "status-dot error" : "status-dot"} />
        <span>{currentStatus}</span>
      </div>

      {topLanguages.length ? (
        <div className="language-rail" aria-label="Language legend">
          {topLanguages.map((language) => (
            <div key={language.language} className="language-row">
              <span className="language-swatch" style={{ backgroundColor: language.color }} />
              <span>{language.language}</span>
              <meter min={0} max={Math.max(...topLanguages.map((item) => item.loc), 1)} value={language.loc} />
            </div>
          ))}
        </div>
      ) : null}
    </GlassSurface>
  );
}
