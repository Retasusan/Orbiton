import blessed from "blessed";
import contrib from "blessed-contrib";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const donutHeight = Math.floor(rowSpan * 0.55);
  // なぜかlistHeightを0.25足さないとContainer Detailsのbottom borderの位置がズレる
  const listHeight = rowSpan - donutHeight;
  const donut = grid.set(row, col, donutHeight, colSpan, contrib.donut, {
    label: "Docker Containers Status",
    radius: 12,
    arcWidth: 4,
    yPadding: 2,
    data: [],
  });

  // コンテナ詳細リスト用のスクロール可能なテキストボックス
  const listBox = grid.set(
    row + donutHeight,
    col,
    listHeight,
    colSpan,
    blessed.box,
    {
      label: "Container Details",
      tags: true,
      border: { type: "line" },
      style: {
        border: { fg: "cyan" },
        fg: "white",
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        track: { bg: "grey" },
        style: { bg: "cyan" },
      },
      padding: { left: 1, right: 1, top: 1, bottom: 1 },
    }
  );

  async function updateDockerStatus() {
    try {
      const { stdout } = await execAsync(
        'docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"'
      );
      const lines = stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      const statusCounts = { Up: 0, Exited: 0, Other: 0 };
      const containerDetails = [];

      for (const line of lines) {
        const [id, name, image, status, ports, createdAt] = line.split("\t");

        let state = "Other";
        if (/Up/i.test(status)) state = "Up";
        else if (/Exited/i.test(status)) state = "Exited";

        statusCounts[state]++;

        let color = "yellow";
        if (state === "Up") color = "green";
        else if (state === "Exited") color = "red";

        containerDetails.push(
          `{${color}-fg}${name}{/} (${id.slice(0, 12)})\n` +
            `  Image   : ${image}\n` +
            `  Status  : ${status}\n` +
            `  Ports   : ${ports || "-"}\n` +
            `  Created : ${createdAt}\n`
        );
      }

      const total =
        statusCounts.Up + statusCounts.Exited + statusCounts.Other || 1;

      // ドーナツグラフ用データ
      donut.setData([
        {
          label: "Up",
          percent: Math.round((statusCounts.Up / total) * 100),
          color: "green",
        },
        {
          label: "Exited",
          percent: Math.round((statusCounts.Exited / total) * 100),
          color: "red",
        },
        {
          label: "Other",
          percent: Math.round((statusCounts.Other / total) * 100),
          color: "yellow",
        },
      ]);

      // 詳細リスト表示
      listBox.setContent(
        containerDetails.join("\n") ||
          "{yellow-fg}No containers found{/yellow-fg}"
      );

      // 描画更新
      donut.screen.render();
    } catch (err) {
      listBox.setContent(
        `{red-fg}Failed to fetch docker containers: ${err.message}{/red-fg}`
      );
      donut.screen.render();
    }
  }

  updateDockerStatus();
  const timer = setInterval(updateDockerStatus, options.updateInterval || 5000);

  donut.on("destroy", () => clearInterval(timer));

  return donut;
}
