import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { RepoGraph } from "@repocity/shared";

vi.mock("./components/CityScene", () => ({
  CityScene: ({ graph, onSelectNode }: { graph: RepoGraph; onSelectNode: (id: string) => void }) => (
    <button type="button" data-testid="city-scene" onClick={() => onSelectNode(graph.nodes.find((node) => node.kind === "file")!.id)}>
      city
    </button>
  )
}));

const graph: RepoGraph = {
  id: "sample-vite",
  name: "vitejs/vite",
  sourceType: "sample",
  sourceLabel: "public sample metadata",
  generatedAt: "2026-06-25T00:00:00.000Z",
  nodes: [
    {
      id: "file-1",
      path: "src/index.ts",
      name: "index.ts",
      kind: "file",
      district: "src",
      language: "TypeScript",
      sizeBytes: 1024,
      loc: 44,
      complexity: 7,
      commitCount: 3,
      lastModified: "2026-05-01T00:00:00.000Z",
      imports: [],
      aiEligible: true
    }
  ],
  edges: [],
  timeline: [{ label: "2026-05", date: "2026-05-01T00:00:00.000Z", commits: 3, filesChanged: 1 }],
  languages: [{ language: "TypeScript", files: 1, loc: 44, color: "#63C7FF" }]
};

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/repositories") {
          return jsonResponse({
            repositories: [{ id: "sample-vite", name: "vitejs/vite", sourceType: "sample", sourceLabel: "sample" }],
            localCandidates: []
          });
        }
        if (url === "/api/repositories/sample-vite/graph") {
          return jsonResponse(graph);
        }
        if (url === "/api/ai/summarize") {
          return jsonResponse({ status: "disabled", message: "Cloud summaries are disabled." });
        }
        return jsonResponse({ error: "not found" }, 404);
      })
    );
  });

  it("loads the default city and selects a building", async () => {
    render(<App />);
    expect(await screen.findByText("RepoCity")).toBeInTheDocument();
    expect(await screen.findByTestId("city-scene")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("city-scene"));
    expect(await screen.findByText("src/index.ts")).toBeInTheDocument();
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0);
  });

  it("shows disabled AI summary state", async () => {
    render(<App />);
    await userEvent.click(await screen.findByTestId("city-scene"));
    await userEvent.click(screen.getByRole("button", { name: /summarize/i }));
    await waitFor(() => expect(screen.getByText("Cloud summaries are disabled.")).toBeInTheDocument());
  });
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response);
}
