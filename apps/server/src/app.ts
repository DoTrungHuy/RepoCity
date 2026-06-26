import express from "express";
import cors from "cors";
import type { AiSummaryRequest, ImportRequest } from "@repocity/shared";
import { repositoryStore } from "./services/repositoryStore.js";
import { summarizeNode } from "./services/aiService.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/repositories", async (_request, response, next) => {
    try {
      response.json(await repositoryStore.listRepositories());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/repositories/import", async (request, response, next) => {
    try {
      const body = request.body as Partial<ImportRequest>;
      if ((body.type !== "github" && body.type !== "local") || typeof body.urlOrPath !== "string") {
        response.status(400).json({ error: "Expected { type, urlOrPath }." });
        return;
      }
      const scan = await repositoryStore.importRepository({ type: body.type, urlOrPath: body.urlOrPath });
      response.status(202).json({ scanId: scan.id });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/scans/:id", (request, response) => {
    const scan = repositoryStore.getScan(request.params.id);
    if (!scan) {
      response.status(404).json({ error: "Scan not found." });
      return;
    }
    response.json(scan);
  });

  app.get("/api/repositories/:id/graph", async (request, response, next) => {
    try {
      const graph = await repositoryStore.getGraph(request.params.id);
      if (!graph) {
        response.status(404).json({ error: "Repository graph not found." });
        return;
      }
      response.json(graph);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/summarize", async (request, response, next) => {
    try {
      const body = request.body as Partial<AiSummaryRequest>;
      if (!body.repoId || !body.nodeId) {
        response.status(400).json({ error: "Expected { repoId, nodeId }." });
        return;
      }
      const graph = await repositoryStore.getGraph(body.repoId);
      const node = graph?.nodes.find((candidate) => candidate.id === body.nodeId);
      if (!graph || !node) {
        response.status(404).json({ error: "Repository node not found." });
        return;
      }
      response.json(await summarizeNode(graph, node, Boolean(body.consentToSendSource)));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(500).json({ error: message });
  });

  return app;
}
