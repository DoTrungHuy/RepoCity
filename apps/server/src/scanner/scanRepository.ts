import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { LanguageStat, RepoEdge, RepoGraph, RepoNode, RepoSourceType } from "@repocity/shared";
import { colorForLanguage, ignoredDirectoryNames, isTextLikePath, languageForPath } from "./languages.js";
import { collectGitStats, normalizeRepoRelativePath } from "./git.js";

const maxFileBytesForContent = 512 * 1024;
const importPattern =
  /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|require\(|from\s+)(["'])([^"']+)\1/g;

export interface ScanOptions {
  id: string;
  name: string;
  repoPath: string;
  sourceType: RepoSourceType;
  sourceLabel: string;
  description?: string;
}

interface RawFile {
  absolutePath: string;
  relativePath: string;
  statSize: number;
}

export async function scanRepository(options: ScanOptions): Promise<RepoGraph> {
  const rawFiles: RawFile[] = [];
  const directoryPaths = new Set<string>([""]);
  await walkRepository(options.repoPath, rawFiles, directoryPaths);

  const gitStats = await collectGitStats(options.repoPath);
  const nodes: RepoNode[] = [];
  const edges: RepoEdge[] = [];
  const directoryIds = new Map<string, string>();

  for (const directoryPath of [...directoryPaths].sort(comparePathDepth)) {
    const name = directoryPath ? path.posix.basename(directoryPath) : options.name;
    const id = nodeId("dir", directoryPath || ".");
    directoryIds.set(directoryPath, id);
    const parentPath = directoryPath.includes("/") ? directoryPath.slice(0, directoryPath.lastIndexOf("/")) : "";
    nodes.push({
      id,
      path: directoryPath || ".",
      name,
      kind: "directory",
      parentId: directoryPath ? directoryIds.get(parentPath) : undefined,
      district: topLevelDistrict(directoryPath),
      sizeBytes: 0,
      loc: 0,
      complexity: 1,
      commitCount: 0,
      imports: [],
      aiEligible: false
    });
    if (directoryPath) {
      edges.push({
        id: `contains:${directoryIds.get(parentPath)}:${id}`,
        source: directoryIds.get(parentPath) ?? directoryIds.get("")!,
        target: id,
        kind: "contains"
      });
    }
  }

  const fileNodesByPath = new Map<string, RepoNode>();
  const fileImportSpecs = new Map<string, string[]>();

  for (const file of rawFiles) {
    const language = languageForPath(file.relativePath);
    const directoryPath = path.posix.dirname(file.relativePath) === "." ? "" : path.posix.dirname(file.relativePath);
    const parentId = directoryIds.get(directoryPath) ?? directoryIds.get("");
    const gitFileStat = gitStats.files.get(file.relativePath) ?? { commitCount: 0 };
    const content = await readTextContent(file.absolutePath);
    const imports = content ? extractImportSpecs(content) : [];
    const loc = content ? countLoc(content) : 0;
    const complexity = estimateComplexity(content ?? "", imports.length);
    const id = nodeId("file", file.relativePath);
    const node: RepoNode = {
      id,
      path: file.relativePath,
      name: path.posix.basename(file.relativePath),
      kind: "file",
      parentId,
      district: topLevelDistrict(file.relativePath),
      language,
      sizeBytes: file.statSize,
      loc,
      complexity,
      commitCount: gitFileStat.commitCount,
      lastModified: gitFileStat.lastModified,
      imports: [],
      aiEligible: true
    };
    nodes.push(node);
    fileNodesByPath.set(file.relativePath, node);
    fileImportSpecs.set(file.relativePath, imports);
    edges.push({
      id: `contains:${parentId}:${id}`,
      source: parentId ?? directoryIds.get("")!,
      target: id,
      kind: "contains"
    });
  }

  for (const [sourcePath, imports] of fileImportSpecs.entries()) {
    const sourceNode = fileNodesByPath.get(sourcePath);
    if (!sourceNode) continue;
    const resolvedTargets = imports
      .map((specifier) => resolveImport(sourcePath, specifier, fileNodesByPath))
      .filter((value): value is RepoNode => Boolean(value));
    sourceNode.imports = [...new Set(resolvedTargets.map((node) => node.id))];
    for (const target of resolvedTargets) {
      edges.push({
        id: `imports:${sourceNode.id}:${target.id}`,
        source: sourceNode.id,
        target: target.id,
        kind: "imports"
      });
    }
  }

  rollupDirectoryMetrics(nodes);

  return {
    id: options.id,
    name: options.name,
    sourceType: options.sourceType,
    sourceLabel: options.sourceLabel,
    description: options.description,
    generatedAt: new Date().toISOString(),
    rootPath: options.sourceType === "sample" ? undefined : options.repoPath,
    nodes,
    edges,
    timeline: gitStats.timeline,
    languages: buildLanguageStats(nodes)
  };
}

async function walkRepository(repoPath: string, files: RawFile[], directories: Set<string>, relative = ""): Promise<void> {
  const absolute = path.join(repoPath, relative);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) continue;
    const nextRelative = relative ? path.join(relative, entry.name) : entry.name;
    const normalized = nextRelative.replaceAll("\\", "/");
    if (entry.isDirectory()) {
      directories.add(normalized);
      await walkRepository(repoPath, files, directories, nextRelative);
    } else if (entry.isFile() && isTextLikePath(entry.name)) {
      const absolutePath = path.join(repoPath, nextRelative);
      const stat = await fs.stat(absolutePath);
      files.push({
        absolutePath,
        relativePath: normalizeRepoRelativePath(repoPath, absolutePath),
        statSize: stat.size
      });
    }
  }
}

async function readTextContent(filePath: string): Promise<string | undefined> {
  const stat = await fs.stat(filePath);
  if (stat.size > maxFileBytesForContent) return undefined;
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function extractImportSpecs(content: string): string[] {
  const specs: string[] = [];
  for (const match of content.matchAll(importPattern)) {
    specs.push(match[2]);
  }
  return specs;
}

function resolveImport(sourcePath: string, specifier: string, fileNodesByPath: Map<string, RepoNode>): RepoNode | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const sourceDir = path.posix.dirname(sourcePath);
  const candidateBase = path.posix.normalize(path.posix.join(sourceDir, specifier));
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.jsx`,
    `${candidateBase}.mjs`,
    `${candidateBase}.vue`,
    `${candidateBase}.svelte`,
    path.posix.join(candidateBase, "index.ts"),
    path.posix.join(candidateBase, "index.tsx"),
    path.posix.join(candidateBase, "index.js"),
    path.posix.join(candidateBase, "index.jsx")
  ];
  return candidates.map((candidate) => fileNodesByPath.get(candidate)).find(Boolean);
}

function countLoc(content: string): number {
  return content.split(/\r?\n/).filter((line) => line.trim()).length;
}

function estimateComplexity(content: string, importCount: number): number {
  if (!content) return 1;
  const branches = content.match(/\b(if|for|while|case|catch|switch|try)\b|&&|\|\||\?/g)?.length ?? 0;
  return Math.max(1, branches + Math.ceil(importCount / 2));
}

function rollupDirectoryMetrics(nodes: RepoNode[]): void {
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

function buildLanguageStats(nodes: RepoNode[]): LanguageStat[] {
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

function topLevelDistrict(filePath: string): string {
  if (!filePath || filePath === ".") return "root";
  const first = filePath.split("/")[0];
  return first || "root";
}

function nodeId(kind: "dir" | "file", value: string): string {
  const hash = crypto.createHash("sha1").update(`${kind}:${value}`).digest("hex").slice(0, 12);
  return `${kind}-${hash}`;
}

function comparePathDepth(left: string, right: string): number {
  const leftDepth = left ? left.split("/").length : 0;
  const rightDepth = right ? right.split("/").length : 0;
  return leftDepth - rightDepth || left.localeCompare(right);
}
