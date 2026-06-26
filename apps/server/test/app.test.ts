import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("RepoCity API", () => {
  it("loads the metadata sample graph", async () => {
    const app = createApp();
    const repositories = await request(app).get("/api/repositories").expect(200);
    expect(repositories.body.repositories[0].id).toBe("sample-vite");

    const graph = await request(app).get("/api/repositories/sample-vite/graph").expect(200);
    expect(graph.body.name).toBe("vitejs/vite");
    expect(graph.body.nodes.length).toBeGreaterThan(20);
    expect(graph.body.rootPath).toBeUndefined();
  });

  it("returns a readable failed scan for local paths outside the allowed root", async () => {
    const app = createApp();
    const created = await request(app).post("/api/repositories/import").send({ type: "local", urlOrPath: "C:\\Windows" }).expect(202);
    const scanId = created.body.scanId as string;
    let scan;
    for (let index = 0; index < 10; index += 1) {
      scan = await request(app).get(`/api/scans/${scanId}`).expect(200);
      if (scan.body.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(scan?.body.status).toBe("failed");
    expect(scan?.body.error).toContain("Local scans are limited");
  });

  it("reports disabled AI summaries when no provider key is configured", async () => {
    const app = createApp();
    const graph = await request(app).get("/api/repositories/sample-vite/graph").expect(200);
    const file = graph.body.nodes.find((node: { kind: string }) => node.kind === "file");
    const summary = await request(app).post("/api/ai/summarize").send({ repoId: "sample-vite", nodeId: file.id }).expect(200);
    expect(summary.body.status).toBe("disabled");
  });
});

