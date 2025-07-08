import path from "path";
import fs from "fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolvePluginPath } from "../config/resolvePlugins.js";

vi.mock("fs");

describe("resolvePluginPath", () => {
  const originalResolve = path.resolve;

  beforeEach(() => {
    // fs.existsSyncのモックを初期化
    fs.existsSync.mockReset();
  });

  it("should return absolute path if plugin exists", () => {
    const pluginName = "weather";
    const expectedPath = `/some/path/plugins/${pluginName}/index.js`;

    // path.resolveの挙動をモックして期待パスを返す
    vi.spyOn(path, "resolve").mockReturnValue(expectedPath);
    fs.existsSync.mockReturnValue(true);

    const result = resolvePluginPath(pluginName);

    expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    expect(result).toBe(expectedPath);

    // path.resolveのモックを元に戻す
    path.resolve.mockRestore();
  });

  it("should throw error if plugin does not exist", () => {
    const pluginName = "nonexistent";
    const expectedPath = `/some/path/plugins/${pluginName}/index.js`;

    vi.spyOn(path, "resolve").mockReturnValue(expectedPath);
    fs.existsSync.mockReturnValue(false);

    expect(() => resolvePluginPath(pluginName)).toThrowError(
      `Plugin not found: "${pluginName}"`
    );

    path.resolve.mockRestore();
  });
});
