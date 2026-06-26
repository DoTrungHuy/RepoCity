import fs from "node:fs/promises";
import path from "node:path";
import type { AiSummaryResponse, RepoGraph, RepoNode } from "@repocity/shared";
import { config, isInsidePath } from "../config.js";

const maxSourceChars = 12000;

export async function summarizeNode(graph: RepoGraph, node: RepoNode, consentToSendSource = false): Promise<AiSummaryResponse> {
  if (!config.ai.apiKey) {
    return {
      status: "disabled",
      message: "Cloud summaries are disabled. Set AI_API_KEY, AI_BASE_URL, and AI_MODEL to enable them."
    };
  }

  if (graph.sourceType === "local" && !consentToSendSource) {
    return {
      status: "consent_required",
      message: "Local source requires confirmation before it is sent to the cloud summary provider."
    };
  }

  try {
    const source = await readNodeSource(graph, node);
    const prompt = buildPrompt(graph, node, source);
    const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.ai.apiKey}`
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You explain source files for a code visualization tool. Be concise, concrete, and mention likely responsibility, dependencies, and risk hot spots."
          },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `AI provider returned ${response.status}.`
      };
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      status: "ok",
      summary: data.choices?.[0]?.message?.content?.trim() || "No summary returned."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "AI summary failed."
    };
  }
}

async function readNodeSource(graph: RepoGraph, node: RepoNode): Promise<string | undefined> {
  if (!graph.rootPath || node.kind !== "file") return undefined;
  const absolutePath = path.resolve(graph.rootPath, node.path);
  if (!isInsidePath(graph.rootPath, absolutePath)) return undefined;
  const content = await fs.readFile(absolutePath, "utf8").catch(() => undefined);
  return content ? content.slice(0, maxSourceChars) : undefined;
}

function buildPrompt(graph: RepoGraph, node: RepoNode, source?: string): string {
  return [
    `Repository: ${graph.name} (${graph.sourceType})`,
    `File: ${node.path}`,
    `Language: ${node.language ?? "unknown"}`,
    `LOC: ${node.loc}`,
    `Complexity score: ${node.complexity}`,
    `Commit count: ${node.commitCount}`,
    `Import edges: ${node.imports.length}`,
    source ? `Source excerpt:\n\n${source}` : "No source excerpt is available; summarize from metadata only."
  ].join("\n");
}

