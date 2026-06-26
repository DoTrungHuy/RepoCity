import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { config } from "../config.js";
import type { TimelinePoint } from "@repocity/shared";

const execFileAsync = promisify(execFile);

export interface GitFileStat {
  commitCount: number;
  lastModified?: string;
}

export interface GitStats {
  files: Map<string, GitFileStat>;
  timeline: TimelinePoint[];
}

export async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync(config.gitBin, args, {
    cwd,
    maxBuffer: 1024 * 1024 * 12,
    windowsHide: true
  });
  return stdout;
}

export async function clonePublicGithubRepository(url: string, destination: string): Promise<void> {
  await git(["clone", "--depth", "1", url, destination]);
}

export async function collectGitStats(repoPath: string): Promise<GitStats> {
  try {
    const output = await git(["-C", repoPath, "log", "--name-only", "--format=@@%ct"], repoPath);
    const files = new Map<string, GitFileStat>();
    const months = new Map<string, { commits: Set<string>; files: Set<string>; date: string }>();
    let currentTimestamp = "";
    let currentCommitId = 0;

    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("@@")) {
        currentTimestamp = line.slice(2);
        currentCommitId += 1;
        continue;
      }

      const normalized = line.replaceAll("\\", "/");
      const previous = files.get(normalized) ?? { commitCount: 0 };
      previous.commitCount += 1;
      if (currentTimestamp) {
        const date = new Date(Number(currentTimestamp) * 1000);
        previous.lastModified = maxIso(previous.lastModified, date.toISOString());
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        const entry = months.get(key) ?? {
          commits: new Set<string>(),
          files: new Set<string>(),
          date: `${key}-01T00:00:00.000Z`
        };
        entry.commits.add(String(currentCommitId));
        entry.files.add(normalized);
        months.set(key, entry);
      }
      files.set(normalized, previous);
    }

    const timeline = [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-36)
      .map(([label, entry]) => ({
        label,
        date: entry.date,
        commits: entry.commits.size,
        filesChanged: entry.files.size
      }));

    return { files, timeline };
  } catch {
    return { files: new Map(), timeline: [] };
  }
}

export function normalizeRepoRelativePath(repoPath: string, absolutePath: string): string {
  return path.relative(repoPath, absolutePath).replaceAll("\\", "/");
}

function maxIso(left: string | undefined, right: string): string {
  if (!left) return right;
  return left > right ? left : right;
}

