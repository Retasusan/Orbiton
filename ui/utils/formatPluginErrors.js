export function formatPluginErrors(failedPlugins) {
  return failedPlugins
    .map(({ name, error }) => {
      return `🔴 Plugin "${name}" failed to load:\n${error
        .split("\n")
        .map((line) => "    " + line)
        .join("\n")}`;
    })
    .join("\n\n");
}
