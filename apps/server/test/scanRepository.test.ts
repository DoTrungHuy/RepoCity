import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { scanRepository } from "../src/scanner/scanRepository.js";

const execFileAsync = promisify(execFile);

describe("scanRepository", () => {
  it("ignores generated folders and maps imports with git stats", async () => {
    const repoPath = await fs.mkdtemp(path.join(os.tmpdir(), "repocity-scan-"));
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
    await fs.mkdir(path.join(repoPath, "node_modules", "pkg"), { recursive: true });
    await fs.mkdir(path.join(repoPath, "dist"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "src", "index.ts"), "import { value } from './util'\nif (value) console.log(value)\n", "utf8");
    await fs.writeFile(path.join(repoPath, "src", "util.ts"), "export const value = 1\n", "utf8");
    await fs.writeFile(path.join(repoPath, "node_modules", "pkg", "ignored.ts"), "export const ignored = true\n", "utf8");
    await fs.writeFile(path.join(repoPath, "dist", "ignored.js"), "export const ignored = true\n", "utf8");

    await git(["init"], repoPath);
    await git(["config", "user.email", "test@example.com"], repoPath);
    await git(["config", "user.name", "RepoCity Test"], repoPath);
    await git(["add", "."], repoPath);
    await git(["commit", "-m", "initial"], repoPath);

    const graph = await scanRepository({
      id: "local-test",
      name: "test",
      repoPath,
      sourceType: "local",
      sourceLabel: repoPath
    });

    expect(graph.nodes.some((node) => node.path.includes("node_modules"))).toBe(false);
    expect(graph.nodes.some((node) => node.path.includes("dist"))).toBe(false);
    const indexNode = graph.nodes.find((node) => node.path === "src/index.ts");
    const utilNode = graph.nodes.find((node) => node.path === "src/util.ts");
    expect(indexNode?.language).toBe("TypeScript");
    expect(indexNode?.commitCount).toBeGreaterThan(0);
    expect(graph.edges.some((edge) => edge.kind === "imports" && edge.source === indexNode?.id && edge.target === utilNode?.id)).toBe(true);
  });
});

async function git(args: string[], cwd: string) {
  await execFileAsync(config.gitBin, args, { cwd, windowsHide: true });
}

