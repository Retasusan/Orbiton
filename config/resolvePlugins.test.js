import { vi, describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { resolvePluginPath } from "./resolvePlugins.js";

vi.mock("fs");

describe("resolvePluginPath", () => {
  it("returns plugin path if plugin exists", () => {
    fs.existsSync.mockReturnValue(true);
    const result = resolvePluginPath("weather");
    expect(result).toBe(path.resolve("plugins", "weather", "index.js"));
  });

  it("throws error if plugin does not exist", () => {
    fs.existsSync.mockReturnValue(false);
    expect(() => resolvePluginPath("nonexistent")).toThrowError(
      /Plugin not found/
    );
  });

  it("throws error with correct path if plugin does not exist", () => {
    fs.existsSync.mockReturnValue(false);
    try {
      resolvePluginPath("nonexistent");
    } catch (e) {
      expect(e.message).toMatch(
        /Expected at: .*plugins\/nonexistent\/index.js/
      );
    }
  });
});
