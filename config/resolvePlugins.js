import path from "path";
import fs from "fs";

export function resolvePluginPath(name) {
  const pluginPath = path.resolve("plugins", name, "index.js");

  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin not found: "${name}"`);
  }

  return pluginPath;
}
