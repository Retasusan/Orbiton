export function loadPluginConfig(name) {
  const configPath = path.resolve("plugins", name, "plugin.json");
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      throw new Error(
        `Failed to parse config for plugin "${name}": ${e.message}`
      );
    }
  }
  // 設定ファイルがなければnullや空オブジェクトを返す
  return null;
}
