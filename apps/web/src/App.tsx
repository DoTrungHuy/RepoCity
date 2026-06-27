import { useEffect, useMemo, useState } from "react";
import type { AiSummaryResponse, ImportRequest, LocalCandidate, RepoGraph, RepoNode, RepoSummary, ScanTask } from "@repocity/shared";
import { AlertCircle, Building2, RefreshCw, X } from "lucide-react";
import { CityScene } from "./components/CityScene";
import { ControlDeck } from "./components/ControlDeck";
import { CosmicBackdrop } from "./components/CosmicBackdrop";
import { GlassSurface } from "./components/GlassSurface";
import { InspectorPanel } from "./components/InspectorPanel";
import { TimelineBar } from "./components/TimelineBar";
import { importRepository, listRepositories, loadGraph, loadScan, summarizeNode } from "./lib/api";

export function App() {
  const [repositories, setRepositories] = useState<RepoSummary[]>([]);
  const [localCandidates, setLocalCandidates] = useState<LocalCandidate[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("sample-vite");
  const [graph, setGraph] = useState<RepoGraph | undefined>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [scan, setScan] = useState<ScanTask | undefined>();
  const [summary, setSummary] = useState<AiSummaryResponse | undefined>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [status, setStatus] = useState("Loading city...");
  const [notice, setNotice] = useState<{ kind: "error" | "info"; title: string; message: string; actionLabel?: string; action?: () => void } | undefined>();
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    void refreshRepositories();
  }, []);

  useEffect(() => {
    if (!selectedRepoId) return;
    void loadSelectedGraph(selectedRepoId);
  }, [selectedRepoId]);

  useEffect(() => {
    if (!scan || scan.status === "complete" || scan.status === "failed") return;
    const timer = window.setInterval(async () => {
      try {
        const nextScan = await loadScan(scan.id);
        setScan(nextScan);
        setStatus(nextScan.message);
        if (nextScan.status === "complete" && nextScan.repoId) {
          await refreshRepositories();
          setSelectedRepoId(nextScan.repoId);
        }
      } catch (error) {
        const message = messageFromError(error, "Could not read scan progress.");
        setScan({
          ...scan,
          status: "failed",
          message: "Scan progress unavailable.",
          error: message,
          completedAt: new Date().toISOString()
        });
        setStatus("Scan progress unavailable.");
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, [scan]);

  const selectedNode = useMemo(() => graph?.nodes.find((node) => node.id === selectedNodeId), [graph, selectedNodeId]);

  async function refreshRepositories() {
    try {
      const response = await listRepositories();
      setRepositories(response.repositories);
      setLocalCandidates(response.localCandidates);
      if (!graph) {
        setSelectedRepoId(response.repositories[0]?.id ?? "sample-vite");
      }
      if (notice?.title === "Repository list unavailable") setNotice(undefined);
    } catch (error) {
      const message = messageFromError(error, "Could not load repositories.");
      setStatus("Repository list unavailable.");
      setNotice({
        kind: "error",
        title: "Repository list unavailable",
        message,
        actionLabel: "Retry",
        action: () => void refreshRepositories()
      });
    }
  }

  async function loadSelectedGraph(repoId: string) {
    try {
      setStatus("Loading city...");
      const nextGraph = await loadGraph(repoId);
      setGraph(nextGraph);
      setSelectedNodeId(undefined);
      setSummary(undefined);
      setTimelineIndex(Math.max(0, nextGraph.timeline.length - 1));
      setStatus(`${nextGraph.name} ready`);
      if (notice?.title === "City failed to load") setNotice(undefined);
    } catch (error) {
      const message = messageFromError(error, "Could not load the repository graph.");
      setGraph(undefined);
      setStatus("City failed to load.");
      setNotice({
        kind: "error",
        title: "City failed to load",
        message,
        actionLabel: "Retry",
        action: () => void loadSelectedGraph(repoId)
      });
    }
  }

  async function handleImport(payload: ImportRequest) {
    if (isScanBusy(scan) || isImporting) return;
    try {
      setIsImporting(true);
      setSummary(undefined);
      setNotice(undefined);
      setStatus("Starting scan...");
      const response = await importRepository(payload);
      setScan({
        id: response.scanId,
        status: "queued",
        message: "Waiting to scan repository.",
        startedAt: new Date().toISOString()
      });
    } catch (error) {
      const message = messageFromError(error, "Could not start the repository scan.");
      setStatus("Scan could not start.");
      setNotice({
        kind: "error",
        title: "Scan could not start",
        message,
        actionLabel: "Retry",
        action: () => void handleImport(payload)
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSummarize(node: RepoNode, consentToSendSource: boolean) {
    if (!graph) return;
    try {
      setSummaryLoading(true);
      setSummary(undefined);
      const result = await summarizeNode({ repoId: graph.id, nodeId: node.id, consentToSendSource });
      setSummary(result);
    } catch (error) {
      setSummary({
        status: "error",
        message: messageFromError(error, "Summary request failed.")
      });
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <CosmicBackdrop />
      <div className="scene-layer">
        {graph ? (
          <CityScene graph={graph} selectedNodeId={selectedNodeId} timelineIndex={timelineIndex} onSelectNode={setSelectedNodeId} />
        ) : (
          <div className="loading-stage">
            <Building2 size={36} />
            <span>{status}</span>
          </div>
        )}
      </div>

      <ControlDeck
        repositories={repositories}
        localCandidates={localCandidates}
        selectedRepoId={selectedRepoId}
        status={status}
        scan={scan}
        isImporting={isImporting}
        graph={graph}
        onSelectRepository={setSelectedRepoId}
        onImportRepository={handleImport}
      />

      <InspectorPanel
        graph={graph}
        node={selectedNode}
        summary={summary}
        summaryLoading={summaryLoading}
        onSummarize={handleSummarize}
      />

      {graph ? <TimelineBar timeline={graph.timeline} value={timelineIndex} onChange={setTimelineIndex} /> : null}

      {scan?.status === "failed" ? (
        <SystemToast
          title="Repository scan failed"
          message={scan.error ?? "The scanner stopped before producing a city."}
          actionLabel="Try again"
          onAction={() => setScan(undefined)}
          onClose={() => setScan(undefined)}
        />
      ) : null}

      {notice ? (
        <SystemToast
          title={notice.title}
          message={notice.message}
          actionLabel={notice.actionLabel}
          onAction={notice.action}
          onClose={() => setNotice(undefined)}
        />
      ) : null}
    </main>
  );
}

function SystemToast({
  title,
  message,
  actionLabel,
  onAction,
  onClose
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <GlassSurface className="toast error" variant="panel" intensity="medium" radius={16} role="alert">
      <AlertCircle size={17} />
      <div className="toast-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {actionLabel && onAction ? (
        <button className="toast-action" type="button" onClick={onAction}>
          <RefreshCw size={14} />
          {actionLabel}
        </button>
      ) : null}
      <button className="toast-close" type="button" aria-label="Dismiss alert" onClick={onClose}>
        <X size={15} />
      </button>
    </GlassSurface>
  );
}

function isScanBusy(scan?: ScanTask) {
  return scan?.status === "queued" || scan?.status === "running";
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
