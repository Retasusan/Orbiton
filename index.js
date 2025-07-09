#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { renderDashboard } from "./ui/index.js";

async function init() {
  const configPath = path.resolve(process.cwd(), ".orbitonrc.json");
  if (fs.existsSync(configPath)) {
    console.error(".orbitonrc.json already exists.");
    process.exit(1);
  }
  const defaultConfig = {
    custom: false,
    preset: "developer",
    plugins: [
      { name: "docker-monitor", options: "default" },
      { name: "clock", options: "default" },
      { name: "sysinfo", options: "default" },
      { name: "weather", options: "default" },
    ],
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log("Created default .orbitonrc.json");
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "init") {
    await init();
    process.exit(0);
  }

  try {
    await renderDashboard();
  } catch (err) {
    throw new Error(`🚫 Failed to start dashboard:\n${err.message || err}`);
  }
}

main();
