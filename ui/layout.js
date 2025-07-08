import blessed from "blessed";
import contrib from "blessed-contrib";

export function createLayout() {
  const screen = blessed.screen();
  const grid = new contrib.grid({ rows: 12, cols: 12, screen });

  screen.key(["q", "C-c", "escape"], () => process.exit(0));
  return { screen, grid };
}
