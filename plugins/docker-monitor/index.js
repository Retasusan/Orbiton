import blessed from "blessed";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

function padRight(str, length) {
  if (str.length > length) return str.slice(0, length - 3) + "...";
  return str + " ".repeat(length - str.length);
}

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
    label: "Docker Containers",
    tags: true,
    border: { type: "line" },
    style: {
      border: { fg: "cyan" },
      fg: "white",
      bg: "black",
    },
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    vi: true,
    padding: { left: 1, right: 1, top: 1, bottom: 1 },
    scrollbar: {
      ch: " ",
      track: { bg: "grey" },
      style: { bg: "cyan" },
    },
  });

  async function updateDockerContainers() {
    try {
      const formatStr =
        "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.RunningFor}}\t{{.Status}}";

      const { stdout } = await execAsync(
        `docker ps -a --format "${formatStr}"`
      );

      const lines = stdout.trim().split("\n");

      if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
        box.setContent("{yellow-fg}No containers found{/yellow-fg}");
        box.screen.render();
        return;
      }

      const colWidths = {
        name: 20,
        image: 30,
        uptime: 15,
        status: 25,
      };

      let content =
        `{bold}` +
        padRight("NAME", colWidths.name) +
        padRight("IMAGE", colWidths.image) +
        padRight("UPTIME", colWidths.uptime) +
        padRight("STATUS", colWidths.status) +
        `{\/bold}\n\n`;

      for (const line of lines) {
        const [id, name, image, runningFor, status] = line.split("\t");

        // 色分け（Upは緑、Exitedは赤、それ以外黄色）
        let color = "yellow";
        if (/Exited/i.test(status)) color = "red";
        else if (/Up/i.test(status)) color = "green";

        content +=
          `{${color}-fg}` +
          padRight(name, colWidths.name) +
          padRight(image, colWidths.image) +
          padRight(runningFor, colWidths.uptime) +
          padRight(status, colWidths.status) +
          `{/${color}-fg}\n`;
      }

      box.setContent(content);
      box.screen.render();
    } catch (err) {
      box.setContent(
        `{red-fg}Failed to get docker containers: ${err.message}{/red-fg}`
      );
      box.screen.render();
    }
  }

  updateDockerContainers();
  const timer = setInterval(
    updateDockerContainers,
    options.updateInterval || 5000
  );

  box.on("destroy", () => clearInterval(timer));

  return box;
}
