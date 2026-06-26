import { useState } from "react";
import type { AiSummaryResponse, RepoGraph, RepoNode } from "@repocity/shared";
import { BrainCircuit, FileCode2, Radar, ShieldCheck } from "lucide-react";
import { buildingProfileForNode } from "../lib/layout";
import { GlassSurface } from "./GlassSurface";

interface InspectorPanelProps {
  graph?: RepoGraph;
  node?: RepoNode;
  summary?: AiSummaryResponse;
  summaryLoading: boolean;
  onSummarize: (node: RepoNode, consentToSendSource: boolean) => void;
}

export function InspectorPanel({ graph, node, summary, summaryLoading, onSummarize }: InspectorPanelProps) {
  const [consent, setConsent] = useState(false);
  const needsConsent = graph?.sourceType === "local" && node?.kind === "file";
  const canSummarize = Boolean(node?.kind === "file");
  const profile = node ? buildingProfileForNode(node) : undefined;

  return (
    <GlassSurface as="aside" className={`inspector ${node ? "is-active" : "is-compact"}`} variant="panel" intensity="strong" radius={20} aria-label="File inspector">
      <div className="panel-title">
        <FileCode2 size={18} />
        <span>{node ? node.name : "Select a building"}</span>
      </div>

      {node ? (
        <>
          <div className="path-box">{node.path}</div>
          <dl className="metric-grid">
            <div>
              <dt>Type</dt>
              <dd>{profile?.label ?? "module"}</dd>
            </div>
            <div>
              <dt>LOC</dt>
              <dd>{node.loc.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Complexity</dt>
              <dd>{node.complexity}</dd>
            </div>
            <div>
              <dt>Commits</dt>
              <dd>{node.commitCount}</dd>
            </div>
          </dl>

          <div className="detail-list">
            <span>Size {(node.sizeBytes / 1024).toFixed(1)} KB</span>
            <span>{node.imports.length} import edges</span>
            <span>{node.lastModified ? new Date(node.lastModified).toLocaleDateString() : "No git date"}</span>
          </div>

          {needsConsent ? (
            <label className="consent-row">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <ShieldCheck size={15} />
              Allow cloud summary for this file
            </label>
          ) : null}

          <button className="summary-button" disabled={!canSummarize || summaryLoading || (needsConsent && !consent)} onClick={() => node && onSummarize(node, consent)}>
            <BrainCircuit size={16} />
            {summaryLoading ? "Summarizing..." : "Summarize"}
          </button>

          <SummaryView summary={summary} />
        </>
      ) : (
        <div className="empty-state">
          <Radar size={22} />
          <strong>No node selected</strong>
          <span>Telemetry channel idle.</span>
        </div>
      )}
    </GlassSurface>
  );
}

function SummaryView({ summary }: { summary?: AiSummaryResponse }) {
  if (!summary) return null;
  return (
    <div className={`summary-box ${summary.status}`}>
      <strong>{summary.status === "ok" ? "AI summary" : "Summary status"}</strong>
      <p>{summary.summary ?? summary.message}</p>
    </div>
  );
}
