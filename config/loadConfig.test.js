import fs from "fs";
import path from "path";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadUserConfig } from "./loadConfig.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

describe("loadUserConfig", () => {
  const configPath = path.join(__dirname, "..", ".orbitonrc.json");

  beforeEach(() => {
    // fs.existsSyncとfs.readFileSyncのモックを準備
    vi.restoreAllMocks();
  });

  it("throws error if config file does not exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(() => loadUserConfig()).toThrowError(/Configuration file not found/);
  });

  it("returns parsed config if file exists and valid JSON", () => {
    const dummyConfig = {
      preset: "developer",
      custom: false,
      plugins: ["weather"],
    };

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(dummyConfig));

    const config = loadUserConfig();
    expect(config).toEqual(dummyConfig);
  });

  it("returns default config on invalid JSON", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("invalid json");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const config = loadUserConfig();

    expect(config).toEqual({ preset: "developer", custom: false, plugins: [] });
    expect(consoleSpy).toHaveBeenCalledWith("Invalid JSON in .orbitonrc.json");
  });
});
