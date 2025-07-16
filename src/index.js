#!/usr/bin/env node

/**
 * @fileoverview Main entry point for Orbiton Dashboard
 * 
 * This is the primary CLI interface that handles command routing,
 * configuration loading, and dashboard initialization.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { main as cliMain } from './cli/CLIRouter.js';
import { Logger } from './utils/Logger.js';

const logger = new Logger('orbiton');

/**
 * Main application entry point
 */
async function main() {
  try {
    await cliMain(process.argv);
  } catch (error) {
    logger.error('Application failed:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };