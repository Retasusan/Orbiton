import blessed from "blessed";
import contrib from "blessed-contrib";

export function createLayout() {
  const screen = blessed.screen();
  const grid = new contrib.grid({ rows: 12, cols: 12, screen });

  // grid.setをラップして、返されるboxにスクロールを自動設定
  const originalSet = grid.set.bind(grid);

  grid.set = (...args) => {
    const widget = originalSet(...args);

    // blessed.boxまたはその派生か判定（typeプロパティがboxかどうか）
    if (widget.type === "box") {
      widget.scrollable = true;
      widget.alwaysScroll = true;

      widget.key(["up", "down", "pageup", "pagedown"], (ch, key) => {
        if (key.name === "up") widget.scroll(-1);
        else if (key.name === "down") widget.scroll(1);
        else if (key.name === "pageup") widget.scroll(-widget.height + 1);
        else if (key.name === "pagedown") widget.scroll(widget.height - 1);
        widget.screen.render();
      });

      widget.on("wheelup", () => {
        widget.scroll(-3);
        widget.screen.render();
      });
      widget.on("wheeldown", () => {
        widget.scroll(3);
        widget.screen.render();
      });
    }

    return widget;
  };

  screen.key(["q", "C-c", "escape"], () => process.exit(0));
  return { screen, grid };
}
