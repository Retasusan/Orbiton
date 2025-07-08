import { resolvePluginPath } from "../config/resolvePlugins.js";

export async function loadPlugins(pluginConfigs) {
  const plugins = [];
  const failedPlugins = [];

  for (const { name } of pluginConfigs) {
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
