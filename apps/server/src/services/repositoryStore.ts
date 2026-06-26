import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { ImportRequest, LocalCandidate, RepoGraph, RepoSummary, ScanTask } from "@repocity/shared";
import { config, isInsidePath } from "../config.js";
import { clonePublicGithubRepository } from "../scanner/git.js";
import { scanRepository } from "../scanner/scanRepository.js";
import { createViteSampleGraph } from "../sample/viteGraph.js";

const sampleGraph = createViteSampleGraph();
const scans = new Map<string, ScanTask>();

export class RepositoryStore {
  private graphsDir = path.join(config.dataDir, "graphs");
  private reposDir = path.join(config.dataDir, "repos");

  async listRepositories(): Promise<{ repositories: RepoSummary[]; localCandidates: LocalCandidate[] }> {
    await this.ensureDirectories();
    const cached = await this.listCachedGraphs();
    return {
      repositories: [summaryFromGraph(sampleGraph), ...cached],
      localCandidates: await this.listLocalCandidates()
    };
  }

  async getGraph(id: string): Promise<RepoGraph | undefined> {
    if (id === sampleGraph.id) return sampleGraph;
    await this.ensureDirectories();
    const graphPath = path.join(this.graphsDir, `${safeFileName(id)}.json`);
    try {
      return JSON.parse(await fs.readFile(graphPath, "utf8")) as RepoGraph;
    } catch {
      return undefined;
    }
  }

  getScan(id: string): ScanTask | undefined {
    return scans.get(id);
  }

  async importRepository(request: ImportRequest): Promise<ScanTask> {
    if (request.type !== "github" && request.type !== "local") {
      throw new Error("Import type must be github or local.");
    }
    const scan: ScanTask = {
      id: crypto.randomUUID(),
      status: "queued",
      message: "Waiting to scan repository.",
      startedAt: new Date().toISOString()
    };
    scans.set(scan.id, scan);
    queueMicrotask(() => {
      void this.runScan(scan.id, request);
    });
    return scan;
  }

  private async runScan(scanId: string, request: ImportRequest): Promise<void> {
    const scan = scans.get(scanId);
    if (!scan) return;
    scan.status = "running";
    scan.message = "Reading repository metadata.";

    try {
      const scanTarget = request.type === "local" ? await this.resolveLocalTarget(request.urlOrPath) : await this.resolveGithubTarget(request.urlOrPath);
      scan.message = "Building code city graph.";
      const graph = await scanRepository(scanTarget);
      await this.saveGraph(graph);
      scan.status = "complete";
      scan.message = "Repository city is ready.";
      scan.repoId = graph.id;
      scan.completedAt = new Date().toISOString();
    } catch (error) {
      scan.status = "failed";
      scan.error = error instanceof Error ? error.message : "Repository scan failed.";
      scan.message = "Repository scan failed.";
      scan.completedAt = new Date().toISOString();
    }
  }

  private async resolveLocalTarget(rawPath: string) {
    const resolved = path.resolve(rawPath);
    if (!isInsidePath(config.allowedLocalRoot, resolved)) {
      throw new Error(`Local scans are limited to ${config.allowedLocalRoot}.`);
    }
    const stat = await fs.stat(resolved).catch(() => undefined);
    if (!stat?.isDirectory()) {
      throw new Error("Local path does not exist or is not a directory.");
    }
    const name = path.basename(resolved);
    return {
      id: `local-${slug(name)}-${shortHash(resolved)}`,
      name,
      repoPath: resolved,
      sourceType: "local" as const,
      sourceLabel: resolved,
      description: "Local repository scan"
    };
  }

  private async resolveGithubTarget(rawUrl: string) {
    const parsed = parseGithubUrl(rawUrl);
    if (!parsed) {
      throw new Error("Use a public GitHub repository URL such as https://github.com/vitejs/vite.");
    }
    await this.ensureDirectories();
    const id = `github-${slug(parsed.owner)}-${slug(parsed.repo)}`;
    const repoPath = path.join(this.reposDir, id);
    const exists = await fs.stat(repoPath).then((stat) => stat.isDirectory()).catch(() => false);
    if (!exists) {
      await clonePublicGithubRepository(parsed.cloneUrl, repoPath);
    }
    return {
      id,
      name: `${parsed.owner}/${parsed.repo}`,
      repoPath,
      sourceType: "github" as const,
      sourceLabel: parsed.htmlUrl,
      description: "Public GitHub repository scan"
    };
  }

  private async listCachedGraphs(): Promise<RepoSummary[]> {
    const entries = await fs.readdir(this.graphsDir).catch(() => []);
    const graphs = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          try {
            return JSON.parse(await fs.readFile(path.join(this.graphsDir, entry), "utf8")) as RepoGraph;
          } catch {
            return undefined;
          }
        })
    );
    return graphs.filter((graph): graph is RepoGraph => Boolean(graph)).map(summaryFromGraph);
  }

  private async listLocalCandidates(): Promise<LocalCandidate[]> {
    const entries = await fs.readdir(config.allowedLocalRoot, { withFileTypes: true }).catch(() => []);
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const candidatePath = path.join(config.allowedLocalRoot, entry.name);
          const hasGit = await fs.stat(path.join(candidatePath, ".git")).then((stat) => stat.isDirectory()).catch(() => false);
          const hasPackage = await fs.stat(path.join(candidatePath, "package.json")).then((stat) => stat.isFile()).catch(() => false);
          if (!hasGit && !hasPackage) return undefined;
          return { name: entry.name, path: candidatePath, hasGit };
        })
    );
    return candidates.filter((candidate): candidate is LocalCandidate => Boolean(candidate));
  }

  private async saveGraph(graph: RepoGraph): Promise<void> {
    await this.ensureDirectories();
    await fs.writeFile(path.join(this.graphsDir, `${safeFileName(graph.id)}.json`), JSON.stringify(graph, null, 2), "utf8");
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.graphsDir, { recursive: true });
    await fs.mkdir(this.reposDir, { recursive: true });
  }
}

export const repositoryStore = new RepositoryStore();

function summaryFromGraph(graph: RepoGraph): RepoSummary {
  return {
    id: graph.id,
    name: graph.name,
    sourceType: graph.sourceType,
    sourceLabel: graph.sourceLabel,
    description: graph.description,
    nodeCount: graph.nodes.length,
    updatedAt: graph.generatedAt
  };
}

function parseGithubUrl(rawUrl: string): { owner: string; repo: string; htmlUrl: string; cloneUrl: string } | undefined {
  try {
    const url = rawUrl.startsWith("git@")
      ? new URL(`https://github.com/${rawUrl.split(":").at(-1)?.replace(/\.git$/, "")}`)
      : new URL(rawUrl);
    if (url.hostname !== "github.com") return undefined;
    const [owner, repoRaw] = url.pathname.replace(/^\/+/, "").split("/");
    const repo = repoRaw?.replace(/\.git$/, "");
    if (!owner || !repo) return undefined;
    return {
      owner,
      repo,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      cloneUrl: `https://github.com/${owner}/${repo}.git`
    };
  } catch {
    return undefined;
  }
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]/gi, "-");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "repo";
}

function shortHash(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
}

