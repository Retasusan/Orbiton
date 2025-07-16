/**
 * @fileoverview Plugin system exports
 * 
 * Main entry point for the plugin system, providing base classes
 * and utilities for plugin development.
 */

export { BaseWidget } from './BaseWidget.js';
export { DataWidget } from './DataWidget.js';
export { PluginManager } from './PluginManager.js';
export { PluginMetadata } from './PluginMetadata.js';
export { PluginRegistry } from './PluginRegistry.js';
export { PluginDiscovery } from './PluginDiscovery.js';

// Re-export utilities that plugins commonly need
export { Logger } from '../utils/Logger.js';
export { Validator } from '../utils/Validator.js';
export { 
  OrbitonError, 
  PluginError, 
  ConfigurationError,
  NetworkError,
  FileSystemError,
  ValidationError,
  createError,
  formatError 
} from '../utils/Errors.js';