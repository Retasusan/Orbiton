import blessed from "blessed";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  // デフォルトオプション
  const city = options.city || "Tokyo";

  // Grid上にBoxを作成
  const box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
    label: `Weather - ${city}`,
    content: `Loading weather for ${city}...`,
    border: { type: "line" },
    style: { border: { fg: "blue" } },
    scrollable: true,
    tags: true,
  });

  // 簡単なダミーデータ表示 (実際はAPI取得等の非同期処理を入れる)
  box.setContent(
    `Weather in ${city}:\n🌤️ Sunny\nTemperature: 25°C\nHumidity: 60%`
  );

  return box;
}
