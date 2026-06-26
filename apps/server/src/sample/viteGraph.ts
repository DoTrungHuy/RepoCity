import crypto from "node:crypto";
import type { RepoEdge, RepoGraph, RepoNode } from "@repocity/shared";
import { colorForLanguage, languageForPath } from "../scanner/languages.js";

interface SampleFile {
  path: string;
  loc: number;
  sizeBytes: number;
  complexity: number;
  commitCount: number;
  lastModified: string;
  imports?: string[];
}

const files: SampleFile[] = [
  { path: "packages/vite/src/node/server/index.ts", loc: 420, sizeBytes: 18800, complexity: 36, commitCount: 84, lastModified: "2026-05-17T10:00:00.000Z", imports: ["packages/vite/src/node/config.ts", "packages/vite/src/node/plugins/index.ts"] },
  { path: "packages/vite/src/node/config.ts", loc: 760, sizeBytes: 34200, complexity: 68, commitCount: 132, lastModified: "2026-05-21T14:00:00.000Z", imports: ["packages/vite/src/node/utils.ts"] },
  { path: "packages/vite/src/node/plugins/index.ts", loc: 220, sizeBytes: 9800, complexity: 24, commitCount: 57, lastModified: "2026-04-04T09:00:00.000Z", imports: ["packages/vite/src/node/plugins/css.ts", "packages/vite/src/node/plugins/importAnalysis.ts"] },
  { path: "packages/vite/src/node/plugins/css.ts", loc: 980, sizeBytes: 48100, complexity: 91, commitCount: 146, lastModified: "2026-05-09T08:00:00.000Z", imports: ["packages/vite/src/node/utils.ts"] },
  { path: "packages/vite/src/node/plugins/importAnalysis.ts", loc: 690, sizeBytes: 31800, complexity: 73, commitCount: 121, lastModified: "2026-05-15T13:00:00.000Z", imports: ["packages/vite/src/shared/utils.ts"] },
  { path: "packages/vite/src/node/plugins/asset.ts", loc: 330, sizeBytes: 14900, complexity: 35, commitCount: 76, lastModified: "2026-03-30T17:00:00.000Z" },
  { path: "packages/vite/src/node/plugins/html.ts", loc: 570, sizeBytes: 26700, complexity: 58, commitCount: 103, lastModified: "2026-05-11T11:00:00.000Z", imports: ["packages/vite/src/node/utils.ts"] },
  { path: "packages/vite/src/node/plugins/worker.ts", loc: 290, sizeBytes: 12700, complexity: 31, commitCount: 62, lastModified: "2026-02-21T10:00:00.000Z" },
  { path: "packages/vite/src/node/optimizer/index.ts", loc: 860, sizeBytes: 39100, complexity: 88, commitCount: 119, lastModified: "2026-05-19T16:00:00.000Z", imports: ["packages/vite/src/node/optimizer/scan.ts"] },
  { path: "packages/vite/src/node/optimizer/scan.ts", loc: 510, sizeBytes: 23600, complexity: 51, commitCount: 83, lastModified: "2026-04-28T12:00:00.000Z" },
  { path: "packages/vite/src/node/ssr/ssrModuleLoader.ts", loc: 340, sizeBytes: 15400, complexity: 41, commitCount: 69, lastModified: "2026-05-06T15:00:00.000Z", imports: ["packages/vite/src/node/server/index.ts"] },
  { path: "packages/vite/src/node/ssr/fetchModule.ts", loc: 190, sizeBytes: 8700, complexity: 20, commitCount: 42, lastModified: "2026-03-02T09:00:00.000Z" },
  { path: "packages/vite/src/node/build.ts", loc: 650, sizeBytes: 30100, complexity: 66, commitCount: 111, lastModified: "2026-05-20T09:00:00.000Z", imports: ["packages/vite/src/node/config.ts"] },
  { path: "packages/vite/src/node/preview.ts", loc: 260, sizeBytes: 11800, complexity: 28, commitCount: 49, lastModified: "2026-04-18T19:00:00.000Z", imports: ["packages/vite/src/node/server/index.ts"] },
  { path: "packages/vite/src/node/logger.ts", loc: 210, sizeBytes: 9400, complexity: 17, commitCount: 58, lastModified: "2026-04-10T13:00:00.000Z" },
  { path: "packages/vite/src/node/utils.ts", loc: 720, sizeBytes: 31500, complexity: 74, commitCount: 137, lastModified: "2026-05-18T18:00:00.000Z", imports: ["packages/vite/src/shared/utils.ts"] },
  { path: "packages/vite/src/client/client.ts", loc: 470, sizeBytes: 21300, complexity: 43, commitCount: 97, lastModified: "2026-05-14T20:00:00.000Z", imports: ["packages/vite/src/shared/hmr.ts"] },
  { path: "packages/vite/src/client/env.ts", loc: 70, sizeBytes: 2900, complexity: 4, commitCount: 26, lastModified: "2026-01-22T10:00:00.000Z" },
  { path: "packages/vite/src/shared/hmr.ts", loc: 230, sizeBytes: 10100, complexity: 24, commitCount: 53, lastModified: "2026-03-26T09:00:00.000Z" },
  { path: "packages/vite/src/shared/utils.ts", loc: 380, sizeBytes: 17100, complexity: 37, commitCount: 88, lastModified: "2026-04-30T12:00:00.000Z" },
  { path: "packages/create-vite/src/index.ts", loc: 300, sizeBytes: 13400, complexity: 29, commitCount: 64, lastModified: "2026-04-25T16:00:00.000Z" },
  { path: "packages/plugin-react/src/index.ts", loc: 260, sizeBytes: 11900, complexity: 22, commitCount: 51, lastModified: "2026-04-07T12:00:00.000Z" },
  { path: "packages/plugin-legacy/src/index.ts", loc: 410, sizeBytes: 19000, complexity: 40, commitCount: 62, lastModified: "2026-03-18T11:00:00.000Z" },
  { path: "docs/guide/index.md", loc: 210, sizeBytes: 9600, complexity: 4, commitCount: 77, lastModified: "2026-05-05T09:00:00.000Z" },
  { path: "docs/guide/features.md", loc: 360, sizeBytes: 16200, complexity: 6, commitCount: 95, lastModified: "2026-05-08T14:00:00.000Z" },
  { path: "docs/config/index.md", loc: 280, sizeBytes: 13100, complexity: 5, commitCount: 73, lastModified: "2026-04-19T09:00:00.000Z" },
  { path: "docs/public/config.js", loc: 120, sizeBytes: 5100, complexity: 12, commitCount: 32, lastModified: "2026-02-27T18:00:00.000Z" },
  { path: "playground/react/package.json", loc: 44, sizeBytes: 1800, complexity: 2, commitCount: 19, lastModified: "2026-01-12T11:00:00.000Z" },
  { path: "playground/react/src/main.jsx", loc: 88, sizeBytes: 3700, complexity: 8, commitCount: 34, lastModified: "2026-03-11T10:00:00.000Z" },
  { path: "playground/ssr/src/entry-server.js", loc: 140, sizeBytes: 6100, complexity: 13, commitCount: 41, lastModified: "2026-03-29T15:00:00.000Z" },
  { path: "scripts/release.ts", loc: 240, sizeBytes: 11100, complexity: 26, commitCount: 55, lastModified: "2026-05-02T08:00:00.000Z" },
  { path: "scripts/dev.ts", loc: 170, sizeBytes: 7600, complexity: 18, commitCount: 43, lastModified: "2026-04-02T08:00:00.000Z" },
  { path: "package.json", loc: 96, sizeBytes: 4400, complexity: 3, commitCount: 102, lastModified: "2026-05-20T20:00:00.000Z" },
  { path: "README.md", loc: 190, sizeBytes: 8500, complexity: 2, commitCount: 116, lastModified: "2026-05-03T09:00:00.000Z" }
];

export function createViteSampleGraph(): RepoGraph {
  const directoryPaths = new Set<string>([""]);
  for (const file of files) {
    const segments = file.path.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      directoryPaths.add(segments.slice(0, i).join("/"));
    }
  }

  const nodes: RepoNode[] = [];
  const edges: RepoEdge[] = [];
  const directoryIds = new Map<string, string>();

  for (const directoryPath of [...directoryPaths].sort(comparePathDepth)) {
    const id = nodeId("dir", directoryPath || ".");
    directoryIds.set(directoryPath, id);
    const parentPath = directoryPath.includes("/") ? directoryPath.slice(0, directoryPath.lastIndexOf("/")) : "";
    const node: RepoNode = {
      id,
      path: directoryPath || ".",
      name: directoryPath ? directoryPath.split("/").at(-1)! : "vite",
      kind: "directory",
      parentId: directoryPath ? directoryIds.get(parentPath) : undefined,
      district: districtForPath(directoryPath),
      sizeBytes: 0,
      loc: 0,
      complexity: 1,
      commitCount: 0,
      imports: [],
      aiEligible: false
    };
    nodes.push(node);
    if (directoryPath) {
      edges.push({
        id: `contains:${directoryIds.get(parentPath)}:${id}`,
        source: directoryIds.get(parentPath) ?? directoryIds.get("")!,
        target: id,
        kind: "contains"
      });
    }
  }

  const fileNodeByPath = new Map<string, RepoNode>();
  for (const file of files) {
    const directoryPath = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    const id = nodeId("file", file.path);
    const node: RepoNode = {
      id,
      path: file.path,
      name: file.path.split("/").at(-1)!,
      kind: "file",
      parentId: directoryIds.get(directoryPath),
      district: districtForPath(file.path),
      language: languageForPath(file.path),
      sizeBytes: file.sizeBytes,
      loc: file.loc,
      complexity: file.complexity,
      commitCount: file.commitCount,
      lastModified: file.lastModified,
      imports: [],
      aiEligible: true
    };
    nodes.push(node);
    fileNodeByPath.set(file.path, node);
    edges.push({
      id: `contains:${directoryIds.get(directoryPath)}:${id}`,
      source: directoryIds.get(directoryPath) ?? directoryIds.get("")!,
      target: id,
      kind: "contains"
    });
  }

  for (const file of files) {
    const source = fileNodeByPath.get(file.path);
    if (!source) continue;
    source.imports = (file.imports ?? []).map((targetPath) => fileNodeByPath.get(targetPath)?.id).filter(Boolean) as string[];
    for (const targetId of source.imports) {
      edges.push({
        id: `imports:${source.id}:${targetId}`,
        source: source.id,
        target: targetId,
        kind: "imports"
      });
    }
  }

  rollup(nodes);

  return {
    id: "sample-vite",
    name: "vitejs/vite",
    sourceType: "sample",
    sourceLabel: "public sample metadata",
    description: "Metadata-only city sample based on the public Vite repository shape.",
    generatedAt: "2026-06-25T00:00:00.000Z",
    nodes,
    edges,
    timeline: [
      { label: "2026-01", date: "2026-01-01T00:00:00.000Z", commits: 42, filesChanged: 76 },
      { label: "2026-02", date: "2026-02-01T00:00:00.000Z", commits: 56, filesChanged: 91 },
      { label: "2026-03", date: "2026-03-01T00:00:00.000Z", commits: 68, filesChanged: 124 },
      { label: "2026-04", date: "2026-04-01T00:00:00.000Z", commits: 73, filesChanged: 138 },
      { label: "2026-05", date: "2026-05-01T00:00:00.000Z", commits: 81, filesChanged: 152 }
    ],
    languages: buildLanguages(nodes)
  };
}

function rollup(nodes: RepoNode[]): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const file of nodes.filter((node) => node.kind === "file")) {
    let parentId = file.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      parent.sizeBytes += file.sizeBytes;
      parent.loc += file.loc;
      parent.complexity += file.complexity;
      parent.commitCount += file.commitCount;
      parentId = parent.parentId;
    }
  }
}

function buildLanguages(nodes: RepoNode[]) {
  const stats = new Map<string, { files: number; loc: number }>();
  for (const node of nodes) {
    if (node.kind !== "file") continue;
    const language = node.language ?? "Other";
    const current = stats.get(language) ?? { files: 0, loc: 0 };
    current.files += 1;
    current.loc += node.loc;
    stats.set(language, current);
  }
  return [...stats.entries()]
    .sort(([, a], [, b]) => b.loc - a.loc)
    .map(([language, stat]) => ({
      language,
      files: stat.files,
      loc: stat.loc,
      color: colorForLanguage(language)
    }));
}

function nodeId(kind: "dir" | "file", value: string): string {
  return `${kind}-${crypto.createHash("sha1").update(`${kind}:${value}`).digest("hex").slice(0, 12)}`;
}

function districtForPath(filePath: string): string {
  if (!filePath || filePath === ".") return "root";
  return filePath.split("/")[0] || "root";
}

function comparePathDepth(left: string, right: string): number {
  const leftDepth = left ? left.split("/").length : 0;
  const rightDepth = right ? right.split("/").length : 0;
  return leftDepth - rightDepth || left.localeCompare(right);
}

