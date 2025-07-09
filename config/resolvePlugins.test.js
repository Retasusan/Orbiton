import fs from "fs";
import path from "path";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { resolvePluginPath } from "./resolvePlugins.js";

describe("resolvePluginPath", () => {
  const pluginName = "examplePlugin";
  const expectedPath = path.resolve("plugins", pluginName, "index.js");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the resolved plugin path if file exists", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((p) => p === expectedPath);

    const result = resolvePluginPath(pluginName);
    expect(result).toBe(expectedPath);
  });

  it("throws error if plugin path does not exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(() => resolvePluginPath(pluginName)).toThrowError(
      `Plugin not found: "${pluginName}"`
    );
  });
});
