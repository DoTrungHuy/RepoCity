export type RepoSourceType = "sample" | "github" | "local";

export type RepoNodeKind = "directory" | "file";

export type RepoEdgeKind = "contains" | "imports";

export type ScanStatus = "queued" | "running" | "complete" | "failed";

export interface RepoSummary {
  id: string;
  name: string;
  sourceType: RepoSourceType;
  sourceLabel: string;
  description?: string;
  nodeCount?: number;
  updatedAt?: string;
}

export interface LocalCandidate {
  name: string;
  path: string;
  hasGit: boolean;
}

export interface RepoNode {
  id: string;
  path: string;
  name: string;
  kind: RepoNodeKind;
  parentId?: string;
  district: string;
  language?: string;
  sizeBytes: number;
  loc: number;
  complexity: number;
  commitCount: number;
  lastModified?: string;
  imports: string[];
  aiEligible: boolean;
}

export interface RepoEdge {
  id: string;
  source: string;
  target: string;
  kind: RepoEdgeKind;
}

export interface TimelinePoint {
  label: string;
  date: string;
  commits: number;
  filesChanged: number;
}

export interface LanguageStat {
  language: string;
  files: number;
  loc: number;
  color: string;
}

export interface RepoGraph {
  id: string;
  name: string;
  sourceType: RepoSourceType;
  sourceLabel: string;
  description?: string;
  generatedAt: string;
  rootPath?: string;
  nodes: RepoNode[];
  edges: RepoEdge[];
  timeline: TimelinePoint[];
  languages: LanguageStat[];
}

export interface ImportRequest {
  type: "github" | "local";
  urlOrPath: string;
}

export interface ImportResponse {
  scanId: string;
}

export interface ScanTask {
  id: string;
  status: ScanStatus;
  message: string;
  repoId?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface AiSummaryRequest {
  repoId: string;
  nodeId: string;
  consentToSendSource?: boolean;
}

export interface AiSummaryResponse {
  status: "ok" | "disabled" | "consent_required" | "error";
  summary?: string;
  message?: string;
}

