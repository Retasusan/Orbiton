#!/usr/bin/env node

/**
 * @fileoverview Main entry point for Orbiton Dashboard
 * 
 * This file redirects to the new CLI system in src/index.js
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

// Import and run the new CLI system
import('./src/index.js').then(module => {
  module.main();
}).catch(error => {
  console.error('Failed to start Orbiton:', error.message);
  process.exit(1);
});
