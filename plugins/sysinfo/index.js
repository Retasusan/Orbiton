import blessed from "blessed";
import contrib, { donut } from "blessed-contrib";
import os from "os";
import psList from "ps-list";
import { exec } from "child_process";
import util from "util";
import { info } from "console";

const execAsync = util.promisify(exec);

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const { updateInterval = 5000, topProcessesCount = 5 } = options;
  const donutHeight = Math.floor(rowSpan * 0.5);
  const infoHeight = rowSpan - donutHeight;

  // ドーナツチャートは3つを横並びに (幅は4列ずつ、計12列)
  const donutCpu = grid.set(
    row,
    col,
    donutHeight,
    Math.floor(colSpan / 3),
    contrib.donut,
    {
      label: "CPU Usage",
      radius: 10,
      arcWidth: 4,
      yPadding: 2,
      data: [],
    }
  );

  const donutMem = grid.set(
    row,
    col + Math.floor(colSpan / 3),
    donutHeight,
    Math.floor(colSpan / 3),
    contrib.donut,
    {
      label: "Memory Usage",
      radius: 10,
      arcWidth: 4,
      yPadding: 2,
      data: [],
    }
  );

  const donutDisk = grid.set(
    row,
    col + 2 * Math.floor(colSpan / 3),
    donutHeight,
    Math.floor(colSpan / 3),
    contrib.donut,
    {
      label: "Disk Usage",
      radius: 10,
      arcWidth: 4,
      yPadding: 2,
      data: [],
    }
  );

  // 下にスクロール可能な詳細情報ボックス (残りの60%縦幅)
  const infoBox = grid.set(
    row + donutHeight,
    col,
    infoHeight,
    colSpan,
    blessed.box,
    {
      label: "System Details",
      tags: true,
      border: { type: "line" },
      style: {
        border: { fg: "yellow" },
        fg: "white",
        bg: "black",
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        track: { bg: "grey" },
        style: { bg: "yellow" },
      },
      padding: { left: 2, right: 2, top: 1, bottom: 1 },
    }
  );

  function formatBytes(bytes) {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  async function getDiskUsage() {
    try {
      // Unix系ならdfコマンドを使ってルートの使用率を取得
      const { stdout } = await execAsync("df -h /");
      const lines = stdout.trim().split("\n");
      if (lines.length < 2) return null;

      // "Filesystem Size Used Avail Use% Mounted on"
      const parts = lines[1].split(/\s+/);
      const usedPercentStr = parts[4]; // "Use%"の列（例: "23%")
      const usedPercent = parseInt(usedPercentStr.replace("%", ""), 10);
      return usedPercent;
    } catch {
      return null;
    }
  }

  async function updateInfo() {
    const memUsed = os.totalmem() - os.freemem();
    const memTotal = os.totalmem();
    const memUsagePercent = Math.min(100, (memUsed / memTotal) * 100);

    const cpuLoadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuUsagePercent = Math.min(100, (cpuLoadAvg / cpuCount) * 100);

    const uptimeSec = os.uptime();

    const diskUsagePercent = await getDiskUsage();

    donutCpu.setData([
      { label: "CPU", percent: Math.round(cpuUsagePercent), color: "green" },
    ]);
    donutMem.setData([
      { label: "Memory", percent: Math.round(memUsagePercent), color: "cyan" },
    ]);
    if (diskUsagePercent !== null) {
      donutDisk.setData([
        { label: "Disk", percent: diskUsagePercent, color: "magenta" },
      ]);
    } else {
      donutDisk.setData([{ label: "Disk", percent: 0, color: "grey" }]);
    }

    // プロセスリスト取得 (top N CPU使用率順)
    let processes = [];
    try {
      const allProcesses = await psList();
      processes = allProcesses
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, topProcessesCount);
    } catch {
      processes = [];
    }

    let procStr = "";
    if (processes.length > 0) {
      procStr = `{bold}Top ${topProcessesCount} Processes by CPU Usage:{/bold}\n`;
      procStr +=
        "{yellow-fg}PID\tCPU%\tMemory%\tName{/yellow-fg}\n" +
        processes
          .map(
            (p) =>
              `{green-fg}${p.pid}{/green-fg}\t` +
              `{red-fg}${p.cpu.toFixed(1)}{/red-fg}\t` +
              `{cyan-fg}${(p.memory * 100).toFixed(1)}{/cyan-fg}\t` +
              `${p.name}`
          )
          .join("\n") +
        "\n\n";
    }

    const content =
      procStr +
      `{bold}CPU Load Average (1m):{/bold} {green-fg}${cpuLoadAvg.toFixed(
        2
      )}{/green-fg}\n` +
      `{bold}Memory Usage:{/bold} {cyan-fg}${formatBytes(
        memUsed
      )}{/cyan-fg} / {cyan-fg}${formatBytes(memTotal)}{/cyan-fg}\n` +
      (diskUsagePercent !== null
        ? `{bold}Disk Usage:{/bold} {magenta-fg}${diskUsagePercent}%{/magenta-fg}\n`
        : `{bold}Disk Usage:{/bold} {red-fg}Unavailable{/red-fg}\n`) +
      `{bold}System Uptime:{/bold} {magenta-fg}${formatUptime(
        uptimeSec
      )}{/magenta-fg}\n\n` +
      `{bold}CPU Details:{/bold}\n` +
      `  Cores: {yellow-fg}${cpuCount}{/yellow-fg}\n`;

    infoBox.setContent(content);
    infoBox.screen.render();
  }

  updateInfo();
  const timer = setInterval(updateInfo, updateInterval);

  infoBox.on("destroy", () => clearInterval(timer));

  return infoBox;
}
