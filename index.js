#!/usr/bin/env node
import { renderDashboard } from "./ui/index.js";

async function main() {
  try {
    await renderDashboard();
  } catch (err) {
    throw new Error(
      `🚫 Failed to start dashboard:\n` + `${err.message || err}`
    );
  }
}

main();
