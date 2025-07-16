/**
 * @fileoverview Plugin Manager
 * 
 * Central plugin management system that orchestrates plugin discovery, loading,
 * and lifecycle management. Provides high-level API for plugin operations
 * with isolation and error containment.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';
import { PluginDiscovery } from './PluginDiscovery.js';
import { PluginRegistry } from './PluginRegistry.js';
import { PluginMetadata } from './PluginMetadata.js';
import { BaseWidget } from './BaseWidget.js';
import { DataWidget } from './DataWidget.js';
import { PluginError, ValidationError } from '../utils/Errors.js';

/**
 * Plugin manager for orchestrating plugin operations
 */
export class PluginManager {
  constructor(options = {}) {
    this.logger = new Logger('plugin-manager');
    
    // Initialize components
    this.registry = new PluginRegistry();
    this.discovery = new PluginDiscovery(this.registry);
    this.metadata = new PluginMetadata();
    
    // Plugin loading state
    this.loadedPlugins = new Map(); // name -> plugin instance
    this.pluginInstances = new Map(); // name -> widget instances
    this.loadingQueue = new Set();
    this.erroredPlugins = new Map(); // name -> error info
    
    // Configuration
    this.options = {
      autoDiscovery: true,
      isolatePlugins: true,
      maxConcurrentLoads: 5,
      loadTimeout: 30000,
      enableHotReload: false,
      ...options
    };
    
    // State
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.loadStats = {
      totalLoaded: 0,
      totalFailed: 0,
      averageLoadTime: 0,
      lastLoadTime: null
    };
    
    // Context for widgets
    this.eventBus = options.eventBus || null;
    this.theme = options.theme || null;
  }

  /**
   * Initialize the plugin manager
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      this.logger.warn('Plugin manager already initialized');
      return;
    }

    this.logger.info('Initializing plugin manager');
    const startTime = Date.now();

    try {
      // Merge options
      Object.assign(this.options, options);

      // Initialize registry
      await this.registry.initialize({
        scanPaths: this.options.scanPaths
      });

      // Initialize discovery
      await this.discovery.initialize({
        scanPaths: this.options.scanPaths,
        excludePatterns: this.options.excludePatterns
      });

      // Auto-discover plugins if enabled
      if (this.options.autoDiscovery) {
        await this.discoverPlugins();
      }

      this.isInitialized = true;
      
      this.logger.timing('Plugin manager initialization', startTime);
      this.logger.info(`Plugin manager initialized with ${this.registry.plugins.size} plugins discovered`);
      
    } catch (error) {
      this.logger.error('Failed to initialize plugin manager:', error);
      throw error;
    }
  }

  /**
   * Discover plugins from configured sources
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Discovery results
   */
  async discoverPlugins(options = {}) {
    this.logger.info('Discovering plugins');
    
    try {
      const results = await this.discovery.discoverPlugins({
        autoRegister: true,
        includeNpm: this.options.includeNpm,
        ...options
      });

      this.logger.info(`Plugin discovery completed: ${results.discovered.length} discovered, ${results.failed.length} failed`);
      return results;
      
    } catch (error) {
      this.logger.error('Plugin discovery failed:', error);
      throw error;
    }
  }

  /**
   * Load a plugin by name
   * @param {string} pluginName - Plugin name to load
   * @param {Object} options - Load options
   * @returns {Promise<Object>} Loaded plugin instance
   */
  async loadPlugin(pluginName, options = {}) {
    if (this.loadingQueue.has(pluginName)) {
      this.logger.debug(`Plugin ${pluginName} is already being loaded`);
      return this.waitForPluginLoad(pluginName);
    }

    if (this.loadedPlugins.has(pluginName)) {
      this.logger.debug(`Plugin ${pluginName} is already loaded`);
      return this.loadedPlugins.get(pluginName);
    }

    this.loadingQueue.add(pluginName);
    const startTime = Date.now();

    try {
      this.logger.info(`Loading plugin: ${pluginName}`);

      // Get plugin metadata
      const pluginMetadata = this.registry.getPlugin(pluginName);
      if (!pluginMetadata) {
        throw new PluginError(pluginName, 'Plugin not found in registry');
      }

      // Validate compatibility
      const compatibility = await this.registry.validatePluginCompatibility(pluginName);
      if (!compatibility.isCompatible) {
        throw new PluginError(
          pluginName,
          `Plugin compatibility check failed: ${compatibility.issues.join(', ')}`
        );
      }

      // Load dependencies first
      await this.loadPluginDependencies(pluginName);

      // Load the plugin module
      const pluginInstance = await this.loadPluginModule(pluginMetadata, options);

      // Initialize the plugin
      await this.initializePlugin(pluginInstance, pluginMetadata, options);

      // Register as loaded
      this.loadedPlugins.set(pluginName, pluginInstance);
      this.registry.markPluginLoaded(pluginName, pluginInstance);

      // Update stats
      const loadTime = Date.now() - startTime;
      this.updateLoadStats(true, loadTime);

      this.logger.info(`Successfully loaded plugin: ${pluginName} (${loadTime}ms)`);
      return pluginInstance;

    } catch (error) {
      this.logger.error(`Failed to load plugin ${pluginName}:`, error);
      
      // Track error
      this.erroredPlugins.set(pluginName, {
        error: error.message,
        timestamp: new Date(),
        attempts: (this.erroredPlugins.get(pluginName)?.attempts || 0) + 1
      });

      this.updateLoadStats(false, Date.now() - startTime);
      throw error;
      
    } finally {
      this.loadingQueue.delete(pluginName);
    }
  }

  /**
   * Load plugin dependencies
   * @private
   * @param {string} pluginName - Plugin name
   * @returns {Promise<void>}
   */
  async loadPluginDependencies(pluginName) {
    const pluginMetadata = this.registry.getPlugin(pluginName);
    const dependencies = pluginMetadata.dependencies || [];

    if (dependencies.length === 0) {
      return;
    }

    this.logger.debug(`Loading dependencies for ${pluginName}: ${dependencies.join(', ')}`);

    // Resolve dependency order
    const orderedDeps = this.registry.resolveDependencies(dependencies);

    // Load dependencies in order
    for (const depName of orderedDeps) {
      if (!this.loadedPlugins.has(depName)) {
        await this.loadPlugin(depName);
      }
    }
  }

  /**
   * Load plugin module from file system
   * @private
   * @param {Object} pluginMetadata - Plugin metadata
   * @param {Object} options - Load options
   * @returns {Promise<Object>} Plugin module
   */
  async loadPluginModule(pluginMetadata, options = {}) {
    const pluginPath = pluginMetadata.pluginPath;
    const mainFile = path.join(pluginPath, 'index.js');

    try {
      // Check if main file exists
      await fs.access(mainFile);

      // Load the module
      let PluginClass;
      
      if (this.options.isolatePlugins) {
        // Load with isolation (future enhancement)
        PluginClass = await this.loadPluginWithIsolation(mainFile);
      } else {
        // Direct import
        const module = await import(mainFile);
        PluginClass = module.default || module[pluginMetadata.name] || module;
      }

      // Validate plugin class
      if (typeof PluginClass !== 'function') {
        throw new PluginError(
          pluginMetadata.name,
          'Plugin must export a class or constructor function'
        );
      }

      // Check if it extends BaseWidget or DataWidget
      if (!this.isValidPluginClass(PluginClass)) {
        this.logger.warn(`Plugin ${pluginMetadata.name} does not extend BaseWidget or DataWidget`);
      }

      return PluginClass;

    } catch (error) {
      throw new PluginError(
        pluginMetadata.name,
        `Failed to load plugin module: ${error.message}`,
        error
      );
    }
  }

  /**
   * Load plugin with isolation (placeholder for future implementation)
   * @private
   * @param {string} mainFile - Main plugin file path
   * @returns {Promise<Function>} Plugin class
   */
  async loadPluginWithIsolation(mainFile) {
    // For now, just do a regular import
    // Future: implement proper plugin isolation using worker threads or vm
    const module = await import(mainFile);
    return module.default || module;
  }

  /**
   * Check if plugin class is valid
   * @private
   * @param {Function} PluginClass - Plugin class
   * @returns {boolean} Whether class is valid
   */
  isValidPluginClass(PluginClass) {
    // Check prototype chain for BaseWidget or DataWidget
    let proto = PluginClass.prototype;
    while (proto) {
      if (proto.constructor === BaseWidget || proto.constructor === DataWidget) {
        return true;
      }
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }

  /**
   * Initialize a loaded plugin
   * @private
   * @param {Function} PluginClass - Plugin class
   * @param {Object} pluginMetadata - Plugin metadata
   * @param {Object} options - Initialization options
   * @returns {Promise<Object>} Initialized plugin instance
   */
  async initializePlugin(PluginClass, pluginMetadata, options = {}) {
    try {
      // Create plugin instance
      const pluginOptions = {
        ...pluginMetadata.defaultOptions,
        ...options.pluginOptions,
        metadata: pluginMetadata
      };

      const instance = new PluginClass(pluginOptions);

      // Initialize if method exists
      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }

      return instance;

    } catch (error) {
      throw new PluginError(
        pluginMetadata.name,
        `Failed to initialize plugin: ${error.message}`,
        error
      );
    }
  }

  /**
   * Unload a plugin
   * @param {string} pluginName - Plugin name to unload
   * @returns {Promise<boolean>} Whether plugin was unloaded
   */
  async unloadPlugin(pluginName) {
    if (!this.loadedPlugins.has(pluginName)) {
      this.logger.debug(`Plugin ${pluginName} is not loaded`);
      return false;
    }

    try {
      this.logger.info(`Unloading plugin: ${pluginName}`);

      const pluginInstance = this.loadedPlugins.get(pluginName);

      // Call destroy method if it exists
      if (typeof pluginInstance.destroy === 'function') {
        await pluginInstance.destroy();
      }

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginName);
      this.registry.markPluginUnloaded(pluginName);

      // Remove any widget instances
      if (this.pluginInstances.has(pluginName)) {
        this.pluginInstances.delete(pluginName);
      }

      this.logger.info(`Successfully unloaded plugin: ${pluginName}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Reload a plugin
   * @param {string} pluginName - Plugin name to reload
   * @param {Object} options - Reload options
   * @returns {Promise<Object>} Reloaded plugin instance
   */
  async reloadPlugin(pluginName, options = {}) {
    this.logger.info(`Reloading plugin: ${pluginName}`);

    // Unload first
    await this.unloadPlugin(pluginName);

    // Clear module cache if needed
    if (options.clearCache !== false) {
      await this.clearPluginCache(pluginName);
    }

    // Load again
    return await this.loadPlugin(pluginName, options);
  }

  /**
   * Clear plugin module cache
   * @private
   * @param {string} pluginName - Plugin name
   * @returns {Promise<void>}
   */
  async clearPluginCache(pluginName) {
    const pluginMetadata = this.registry.getPlugin(pluginName);
    if (!pluginMetadata) {
      return;
    }

    const mainFile = path.join(pluginMetadata.pluginPath, 'index.js');
    
    // Clear from Node.js module cache
    delete require.cache[require.resolve(mainFile)];
    
    this.logger.debug(`Cleared cache for plugin: ${pluginName}`);
  }

  /**
   * Create a widget instance from a plugin
   * @param {string} pluginName - Plugin name
   * @param {Object} options - Widget options
   * @returns {Promise<Object>} Widget instance
   */
  async createWidget(pluginName, options = {}) {
    // Ensure plugin is loaded
    if (!this.loadedPlugins.has(pluginName)) {
      await this.loadPlugin(pluginName);
    }

    const PluginClass = this.loadedPlugins.get(pluginName);
    const pluginMetadata = this.registry.getPlugin(pluginName);

    try {
      // Create widget instance
      const widgetOptions = {
        ...pluginMetadata.defaultOptions,
        ...options
      };

      const widget = new PluginClass(pluginName, widgetOptions, {
        eventBus: this.eventBus,
        theme: this.theme
      });

      // Track widget instance
      if (!this.pluginInstances.has(pluginName)) {
        this.pluginInstances.set(pluginName, []);
      }
      this.pluginInstances.get(pluginName).push(widget);

      this.logger.debug(`Created widget instance for plugin: ${pluginName}`);
      return widget;

    } catch (error) {
      throw new PluginError(
        pluginName,
        `Failed to create widget instance: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get all loaded plugins
   * @returns {Array<string>} Array of loaded plugin names
   */
  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.keys());
  }

  /**
   * Get plugin instance
   * @param {string} pluginName - Plugin name
   * @returns {Object|null} Plugin instance or null
   */
  getPluginInstance(pluginName) {
    return this.loadedPlugins.get(pluginName) || null;
  }

  /**
   * Get plugin instance (alias for getPluginInstance)
   * @param {string} pluginName - Plugin name
   * @returns {Object|null} Plugin instance or null
   */
  getPlugin(pluginName) {
    return this.getPluginInstance(pluginName);
  }

  /**
   * Check if plugin is loaded
   * @param {string} pluginName - Plugin name
   * @returns {boolean} Whether plugin is loaded
   */
  isPluginLoaded(pluginName) {
    return this.loadedPlugins.has(pluginName);
  }

  /**
   * Wait for plugin to finish loading
   * @private
   * @param {string} pluginName - Plugin name
   * @returns {Promise<Object>} Plugin instance when loaded
   */
  async waitForPluginLoad(pluginName) {
    const maxWait = this.options.loadTimeout;
    const checkInterval = 100;
    let waited = 0;

    while (this.loadingQueue.has(pluginName) && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    if (this.loadedPlugins.has(pluginName)) {
      return this.loadedPlugins.get(pluginName);
    }

    throw new PluginError(pluginName, 'Plugin load timeout');
  }

  /**
   * Update load statistics
   * @private
   * @param {boolean} success - Whether load was successful
   * @param {number} loadTime - Load time in milliseconds
   */
  updateLoadStats(success, loadTime) {
    if (success) {
      this.loadStats.totalLoaded++;
    } else {
      this.loadStats.totalFailed++;
    }

    // Update average load time
    const total = this.loadStats.totalLoaded + this.loadStats.totalFailed;
    this.loadStats.averageLoadTime = 
      (this.loadStats.averageLoadTime * (total - 1) + loadTime) / total;
    
    this.loadStats.lastLoadTime = new Date();
  }

  /**
   * Get plugin manager statistics
   * @returns {Object} Manager statistics
   */
  getStatistics() {
    return {
      ...this.loadStats,
      registeredPlugins: this.registry.plugins.size,
      loadedPlugins: this.loadedPlugins.size,
      erroredPlugins: this.erroredPlugins.size,
      loadingQueue: this.loadingQueue.size,
      widgetInstances: Array.from(this.pluginInstances.values())
        .reduce((sum, instances) => sum + instances.length, 0),
      registryStats: this.registry.getStatistics(),
      discoveryStats: this.discovery.getStatistics()
    };
  }

  /**
   * Get plugin manager health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    const registryHealth = await this.registry.getHealthStatus();
    const issues = [...registryHealth.issues];
    const warnings = [...registryHealth.warnings];

    // Check for plugins with repeated load failures
    for (const [pluginName, errorInfo] of this.erroredPlugins) {
      if (errorInfo.attempts >= 3) {
        issues.push({
          type: 'repeated-load-failure',
          plugin: pluginName,
          attempts: errorInfo.attempts,
          lastError: errorInfo.error,
          message: `Plugin ${pluginName} has failed to load ${errorInfo.attempts} times`
        });
      }
    }

    // Check for plugins stuck in loading queue
    if (this.loadingQueue.size > 0) {
      warnings.push({
        type: 'stuck-loading',
        plugins: Array.from(this.loadingQueue),
        message: `${this.loadingQueue.size} plugins appear to be stuck loading`
      });
    }

    return {
      healthy: issues.length === 0,
      issues,
      warnings,
      registryHealth,
      checkedAt: new Date()
    };
  }

  /**
   * Shutdown the plugin manager
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down plugin manager');

    try {
      // Unload all plugins
      const loadedPluginNames = Array.from(this.loadedPlugins.keys());
      for (const pluginName of loadedPluginNames) {
        try {
          await this.unloadPlugin(pluginName);
        } catch (error) {
          this.logger.error(`Error unloading plugin ${pluginName} during shutdown:`, error);
        }
      }

      // Clear all state
      this.loadedPlugins.clear();
      this.pluginInstances.clear();
      this.loadingQueue.clear();
      this.erroredPlugins.clear();
      this.registry.clear();

      this.isInitialized = false;
      this.logger.info('Plugin manager shutdown complete');

    } catch (error) {
      this.logger.error('Error during plugin manager shutdown:', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }
}