import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, vi } from "vitest";

// In-memory localStorage and fixture fetches from public/, so tests use the
// real provider without a browser.
const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear()
};
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", { localStorage: storage });

const publicDir = path.resolve(__dirname, "../public");
vi.stubGlobal("fetch", async (url: string) => {
  try {
    const text = await readFile(path.join(publicDir, url), "utf8");
    return { ok: true, status: 200, text: async () => text };
  } catch {
    return { ok: false, status: 404, text: async () => "" };
  }
});

vi.spyOn(console, "debug").mockImplementation(() => undefined);
vi.spyOn(console, "table").mockImplementation(() => undefined);

beforeEach(() => {
  memory.clear();
});
