import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const workspaceRoot = path.resolve(process.cwd(), "../..");

export const config = {
  port: Number(process.env.REPOCITY_PORT ?? 4107),
  workspaceRoot,
  dataDir: process.env.REPOCITY_DATA_DIR ?? path.join(workspaceRoot, ".repocity"),
  allowedLocalRoot: path.resolve(process.env.REPOCITY_ALLOWED_LOCAL_ROOT ?? "D:\\Projects"),
  gitBin: process.env.GIT_BIN ?? "git",
  ai: {
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "gpt-4.1-mini"
  }
};

export function isInsidePath(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

