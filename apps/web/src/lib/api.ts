import type {
  AiSummaryRequest,
  AiSummaryResponse,
  ImportRequest,
  LocalCandidate,
  RepoGraph,
  RepoSummary,
  ScanTask
} from "@repocity/shared";

export interface RepositoryListResponse {
  repositories: RepoSummary[];
  localCandidates: LocalCandidate[];
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function listRepositories() {
  return requestJson<RepositoryListResponse>("/api/repositories");
}

export function loadGraph(repoId: string) {
  return requestJson<RepoGraph>(`/api/repositories/${encodeURIComponent(repoId)}/graph`);
}

export function importRepository(payload: ImportRequest) {
  return requestJson<{ scanId: string }>("/api/repositories/import", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function loadScan(scanId: string) {
  return requestJson<ScanTask>(`/api/scans/${encodeURIComponent(scanId)}`);
}

export function summarizeNode(payload: AiSummaryRequest) {
  return requestJson<AiSummaryResponse>("/api/ai/summarize", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

