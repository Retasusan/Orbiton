import { resolvePluginPath } from "../config/resolvePlugins.js";

export async function loadPlugins(pluginNames) {
  const plugins = [];
  const failedPlugins = [];

  for (const name of pluginNames) {
    try {
      const pluginPath = resolvePluginPath(name);
      const mod = await import(`file://${pluginPath}`);
      plugins.push({ name, mod });
    } catch (e) {
      failedPlugins.push({ name, error: e.message });
    }
  }

  return { plugins, failedPlugins };
}
