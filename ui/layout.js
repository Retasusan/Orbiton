import blessed from "blessed";
import contrib from "blessed-contrib";

export function createLayout() {
  const screen = blessed.screen();
  const grid = new contrib.grid({ rows: 12, cols: 12, screen });

  // grid.setをラップして、返されるboxにスクロールを自動設定
  const originalSet = grid.set.bind(grid);

  grid.set = (...args) => {
    const box = originalSet(...args);

    box.scrollable = true;
    box.alwaysScroll = true;

    box.key(["up", "down", "pageup", "pagedown"], (ch, key) => {
      if (key.name === "up") box.scroll(-1);
      else if (key.name === "down") box.scroll(1);
      else if (key.name === "pageup") box.scroll(-box.height + 1);
      else if (key.name === "pagedown") box.scroll(box.height - 1);
      box.screen.render();
    });

    box.on("wheelup", () => {
      box.scroll(-3);
      box.screen.render();
    });
    box.on("wheeldown", () => {
      box.scroll(3);
      box.screen.render();
    });

    return box;
  };

  screen.key(["q", "C-c", "escape"], () => process.exit(0));
  return { screen, grid };
}
