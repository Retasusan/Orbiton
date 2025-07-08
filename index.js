#!/usr/bin/env node

//  License
// This project is licensed under the MIT License, see the LICENSE.txt file for details.

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
