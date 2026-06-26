import { useEffect, useMemo, useState } from "react";
import type { AiSummaryResponse, ImportRequest, LocalCandidate, RepoGraph, RepoNode, RepoSummary, ScanTask } from "@repocity/shared";
import { AlertCircle, Building2 } from "lucide-react";
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
      const nextScan = await loadScan(scan.id);
      setScan(nextScan);
      setStatus(nextScan.message);
      if (nextScan.status === "complete" && nextScan.repoId) {
        await refreshRepositories();
        setSelectedRepoId(nextScan.repoId);
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, [scan]);

  const selectedNode = useMemo(() => graph?.nodes.find((node) => node.id === selectedNodeId), [graph, selectedNodeId]);

  async function refreshRepositories() {
    const response = await listRepositories();
    setRepositories(response.repositories);
    setLocalCandidates(response.localCandidates);
    if (!graph) {
      setSelectedRepoId(response.repositories[0]?.id ?? "sample-vite");
    }
  }

  async function loadSelectedGraph(repoId: string) {
    setStatus("Loading city...");
    const nextGraph = await loadGraph(repoId);
    setGraph(nextGraph);
    setSelectedNodeId(undefined);
    setSummary(undefined);
    setTimelineIndex(Math.max(0, nextGraph.timeline.length - 1));
    setStatus(`${nextGraph.name} ready`);
  }

  async function handleImport(payload: ImportRequest) {
    setSummary(undefined);
    setStatus("Starting scan...");
    const response = await importRepository(payload);
    setScan({
      id: response.scanId,
      status: "queued",
      message: "Waiting to scan repository.",
      startedAt: new Date().toISOString()
    });
  }

  async function handleSummarize(node: RepoNode, consentToSendSource: boolean) {
    if (!graph) return;
    setSummaryLoading(true);
    setSummary(undefined);
    const result = await summarizeNode({ repoId: graph.id, nodeId: node.id, consentToSendSource });
    setSummary(result);
    setSummaryLoading(false);
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
        <GlassSurface className="toast error" variant="panel" intensity="medium" radius={16} role="alert">
          <AlertCircle size={16} />
          <span>{scan.error}</span>
        </GlassSurface>
      ) : null}
    </main>
  );
}
