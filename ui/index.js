import { createLayout } from "./layout.js";
import { loadUserConfig } from "../config/loadConfig.js";
import { loadPlugins } from "./loadPlugins.js";
import fs from "fs";
import path from "path";

export async function renderDashboard() {
  const { screen, grid } = createLayout();
  const config = loadUserConfig();

  const { plugins, failedPlugins } = await loadPlugins(config.plugins || []);

  if (failedPlugins.length > 0) {
    throw new Error(
      "Failed to load some plugins:\n" +
        failedPlugins
          .map(({ name, error }) => `- ${name}: ${error}`)
          .join("\n") +
        `\nMake sure all plugins are correctly defined in the config.` +
        `\nSee the following for more details: https://github.com/Retasusan/orbiton/README.md##Plugins`
    );
  }

  let layout = [];

  if (config.custom) {
    // customがtrueならconfig.pluginsのpositionをそのまま使う
    layout = config.plugins.map((w) => w.position);
  } else {
    // customがfalseならpresetのレイアウトを読み込む
    const presetName = config.preset || "developer";
    const presetFile = path.resolve("config", "presets", `${presetName}.json`);

    if (fs.existsSync(presetFile)) {
      layout = JSON.parse(fs.readFileSync(presetFile, "utf-8"));
    } else {
      console.warn(
        `Preset "${presetName}" not found. Falling back to developer.`
      );
      const fallbackFile = path.resolve("config", "presets", "developer.json");
      layout = JSON.parse(fs.readFileSync(fallbackFile, "utf-8"));
    }
  }

  // プラグイン数とレイアウト数を比較してエラー処理
  if (layout.length !== plugins.length) {
    throw new Error(
      `❌ Layout mismatch:\n` +
        `- Plugins: ${plugins.length}\n` +
        `- Layout positions: ${layout.length}\n\n` +
        `💡 Make sure the preset "${
          config.preset || "developer"
        }.json" defines one position per plugin.`
    );
  }

  // プラグインを配置
  for (let i = 0; i < plugins.length; i++) {
    const { mod, name } = plugins[i];
    const configPlugin = config.plugins[i];
    let options = {};

    if (configPlugin.options === "default") {
      const defaultJsonPath = path.resolve("plugins", name, "default.json");
      if (fs.existsSync(defaultJsonPath)) {
        options = JSON.parse(fs.readFileSync(defaultJsonPath, "utf-8"));
      }
    } else if (typeof configPlugin.options === "object") {
      options = configPlugin.options;
    }

    // presetを使うならconfigPlugin.positionは無視してpresetの座標を使う
    // customがtrueならconfigPlugin.positionを使う
    const pos = config.custom ? configPlugin.position : layout[i];

    mod.createWidget(grid, pos, options);
  }

  screen.render();
  screen.key(["q", "C-c", "escape"], () => process.exit(0));
}
