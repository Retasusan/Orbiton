import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import { loadUserConfig } from "./loadConfig.js";

vi.mock("fs");

describe("loadUserConfig", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("throws an error if config file does not exist", () => {
    fs.existsSync.mockReturnValue(false);

    expect(() => loadUserConfig()).toThrowError(/Configuration file not found/);
  });

  it("returns parsed config if file exists and is valid JSON", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        preset: "custom",
        custom: true,
        plugins: ["plugin1", "plugin2"],
      })
    );

    const config = loadUserConfig();
    expect(config).toEqual({
      preset: "custom",
      custom: true,
      plugins: ["plugin1", "plugin2"],
    });
  });

  it("returns default config and logs error if JSON is invalid", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("invalid json");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const config = loadUserConfig();

    expect(config).toEqual({
      preset: "developer",
      custom: false,
      plugins: [],
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid JSON in .orbitonrc.json"
    );

    consoleErrorSpy.mockRestore();
  });
});
