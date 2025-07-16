/**
 * @fileoverview Plugin Registry
 * 
 * Central registry for managing plugin discovery, registration, and lifecycle.
 * Handles plugin metadata, dependencies, and provides plugin lookup functionality.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { Logger } from '../utils/Logger.js';
import { PluginMetadata } from './PluginMetadata.js';
import { PluginError, ValidationError } from '../utils/Errors.js';

/**
 * Plugin registry for managing discovered plugins
 */
export class PluginRegistry {
  constructor() {
    this.logger = new Logger('plugin-registry');
    this.metadata = new PluginMetadata();
    
    // Plugin storage
    this.plugins = new Map(); // name -> plugin metadata
    this.pluginsByCategory = new Map(); // category -> Set of plugin names
    this.pluginsByKeyword = new Map(); // keyword -> Set of plugin names
    this.loadedPlugins = new Map(); // name -> plugin instance
    
    // Registry state
    this.isInitialized = false;
    this.lastScanTime = null;
    this.scanPaths = [];
  }

  /**
   * Initialize the plugin registry
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      this.logger.warn('Plugin registry already initialized');
      return;
    }

    this.logger.info('Initializing plugin registry');
    
    // Set scan paths
    this.scanPaths = options.scanPaths || [
      './plugins',
      './node_modules/@orbiton',
      process.env.ORBITON_PLUGIN_PATH
    ].filter(Boolean);

    this.isInitialized = true;
    this.logger.info(`Plugin registry initialized with ${this.scanPaths.length} scan paths`);
  }

  /**
   * Register a plugin with the registry
   * @param {Object} pluginMetadata - Plugin metadata
   * @returns {Promise<void>}
   */
  async registerPlugin(pluginMetadata) {
    try {
      this.logger.debug(`Registering plugin: ${pluginMetadata.name}`);
      
      // Validate metadata
      const validationResult = await this.metadata.validateMetadata(pluginMetadata);
      if (!validationResult.isValid) {
        throw new ValidationError(
          `Invalid plugin metadata for ${pluginMetadata.name}`,
          validationResult.errors
        );
      }

      // Check for conflicts
      if (this.plugins.has(pluginMetadata.name)) {
        const existing = this.plugins.get(pluginMetadata.name);
        if (existing.version !== pluginMetadata.version) {
          this.logger.warn(`Plugin ${pluginMetadata.name} version conflict: ${existing.version} -> ${pluginMetadata.version}`);
        }
      }

      // Register plugin
      this.plugins.set(pluginMetadata.name, pluginMetadata);
      
      // Update category index
      this.addToCategory(pluginMetadata.category, pluginMetadata.name);
      
      // Update keyword index
      for (const keyword of pluginMetadata.keywords || []) {
        this.addToKeywordIndex(keyword, pluginMetadata.name);
      }
      
      this.logger.debug(`Successfully registered plugin: ${pluginMetadata.name}@${pluginMetadata.version}`);
      
    } catch (error) {
      throw new PluginError(
        pluginMetadata.name || 'unknown',
        'Failed to register plugin',
        error
      );
    }
  }

  /**
   * Unregister a plugin from the registry
   * @param {string} pluginName - Plugin name to unregister
   * @returns {boolean} Whether plugin was unregistered
   */
  unregisterPlugin(pluginName) {
    if (!this.plugins.has(pluginName)) {
      return false;
    }

    const plugin = this.plugins.get(pluginName);
    
    // Remove from main registry
    this.plugins.delete(pluginName);
    
    // Remove from category index
    this.removeFromCategory(plugin.category, pluginName);
    
    // Remove from keyword index
    for (const keyword of plugin.keywords || []) {
      this.removeFromKeywordIndex(keyword, pluginName);
    }
    
    // Remove from loaded plugins if present
    if (this.loadedPlugins.has(pluginName)) {
      this.loadedPlugins.delete(pluginName);
    }
    
    this.logger.debug(`Unregistered plugin: ${pluginName}`);
    return true;
  }

  /**
   * Get plugin metadata by name
   * @param {string} pluginName - Plugin name
   * @returns {Object|null} Plugin metadata or null if not found
   */
  getPlugin(pluginName) {
    return this.plugins.get(pluginName) || null;
  }

  /**
   * Get all registered plugins
   * @returns {Array<Object>} Array of plugin metadata
   */
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by category
   * @param {string} category - Plugin category
   * @returns {Array<Object>} Array of plugin metadata
   */
  getPluginsByCategory(category) {
    const pluginNames = this.pluginsByCategory.get(category) || new Set();
    return Array.from(pluginNames).map(name => this.plugins.get(name)).filter(Boolean);
  }

  /**
   * Search plugins by keyword
   * @param {string} keyword - Search keyword
   * @returns {Array<Object>} Array of plugin metadata
   */
  searchPlugins(keyword) {
    const results = new Set();
    
    // Search by exact keyword match
    const keywordMatches = this.pluginsByKeyword.get(keyword.toLowerCase()) || new Set();
    for (const pluginName of keywordMatches) {
      results.add(pluginName);
    }
    
    // Search by name and description
    for (const [name, plugin] of this.plugins) {
      if (name.toLowerCase().includes(keyword.toLowerCase()) ||
          plugin.description.toLowerCase().includes(keyword.toLowerCase())) {
        results.add(name);
      }
    }
    
    return Array.from(results).map(name => this.plugins.get(name));
  }

  /**
   * Get plugins with dependencies resolved
   * @param {Array<string>} pluginNames - Plugin names to resolve
   * @returns {Array<string>} Ordered plugin names with dependencies
   */
  resolveDependencies(pluginNames) {
    // Build dependency graph for requested plugins
    const requestedPlugins = pluginNames
      .map(name => this.plugins.get(name))
      .filter(Boolean);
    
    this.metadata.buildDependencyGraph(requestedPlugins);
    
    // Resolve load order
    return this.metadata.resolveDependencyOrder(pluginNames);
  }

  /**
   * Validate plugin compatibility
   * @param {string} pluginName - Plugin name to validate
   * @returns {Promise<Object>} Compatibility result
   */
  async validatePluginCompatibility(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new PluginError(pluginName, 'Plugin not found in registry');
    }

    const context = {
      availablePlugins: Array.from(this.plugins.keys()),
      loadedPlugins: Array.from(this.loadedPlugins.values()),
      allRegisteredPlugins: Array.from(this.plugins.values())
    };

    const compatibilityResult = await this.metadata.validateCompatibility(plugin, { ...context, allRegisteredPlugins: Array.from(this.plugins.values()) });
    if (!compatibilityResult.compatible) {
      const errorMessages = compatibilityResult.issues.map(issue => issue.message).join(', ');
      throw new PluginError(pluginName, `Plugin compatibility check failed: ${errorMessages}`);
    }
    return compatibilityResult;
  }

  /**
   * Get plugin statistics
   * @returns {Object} Registry statistics
   */
  getStatistics() {
    const categories = {};
    const sizes = {};
    let totalDependencies = 0;
    
    for (const plugin of this.plugins.values()) {
      // Count by category
      categories[plugin.category] = (categories[plugin.category] || 0) + 1;
      
      // Count by size
      sizes[plugin.size] = (sizes[plugin.size] || 0) + 1;
      
      // Count dependencies
      totalDependencies += (plugin.dependencies || []).length;
    }
    
    return {
      totalPlugins: this.plugins.size,
      loadedPlugins: this.loadedPlugins.size,
      categories,
      sizes,
      totalDependencies,
      averageDependencies: this.plugins.size > 0 ? totalDependencies / this.plugins.size : 0,
      lastScanTime: this.lastScanTime,
      scanPaths: this.scanPaths.length
    };
  }

  /**
   * Get registry health status
   * @returns {Object} Health status
   */
  async getHealthStatus() {
    const issues = [];
    const warnings = [];
    
    // Check for plugins with missing dependencies
    for (const [name, plugin] of this.plugins) {
      for (const dep of plugin.dependencies || []) {
        const depInfo = this.metadata.parseDependency(dep);
        if (!this.plugins.has(depInfo.name)) {
          issues.push({
            type: 'missing-dependency',
            plugin: name,
            dependency: depInfo.name,
            message: `Plugin ${name} depends on ${depInfo.name} which is not available`
          });
        }
      }
    }
    
    // Check for circular dependencies
    try {
      const allPluginNames = Array.from(this.plugins.keys());
      this.resolveDependencies(allPluginNames);
    } catch (error) {
      if (error.message.includes('Circular dependency')) {
        issues.push({
          type: 'circular-dependency',
          message: error.message
        });
      }
    }
    
    // Check for version conflicts
    const versionGroups = new Map();
    for (const plugin of this.plugins.values()) {
      const baseName = plugin.name.replace(/@.*$/, '');
      if (!versionGroups.has(baseName)) {
        versionGroups.set(baseName, []);
      }
      versionGroups.get(baseName).push(plugin);
    }
    
    for (const [baseName, versions] of versionGroups) {
      if (versions.length > 1) {
        warnings.push({
          type: 'version-conflict',
          plugin: baseName,
          versions: versions.map(v => v.version),
          message: `Multiple versions of ${baseName} are registered`
        });
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      warnings,
      checkedAt: new Date()
    };
  }

  /**
   * Export registry data
   * @returns {Object} Registry export data
   */
  exportRegistry() {
    return {
      plugins: Array.from(this.plugins.entries()),
      categories: Array.from(this.pluginsByCategory.entries()).map(([cat, plugins]) => [
        cat,
        Array.from(plugins)
      ]),
      keywords: Array.from(this.pluginsByKeyword.entries()).map(([keyword, plugins]) => [
        keyword,
        Array.from(plugins)
      ]),
      metadata: {
        lastScanTime: this.lastScanTime,
        scanPaths: this.scanPaths,
        isInitialized: this.isInitialized
      }
    };
  }

  /**
   * Import registry data
   * @param {Object} data - Registry import data
   * @returns {Promise<void>}
   */
  async importRegistry(data) {
    this.logger.info('Importing plugin registry data');
    
    // Clear existing data
    this.clear();
    
    // Import plugins
    for (const [name, plugin] of data.plugins) {
      this.plugins.set(name, plugin);
    }
    
    // Import categories
    for (const [category, plugins] of data.categories) {
      this.pluginsByCategory.set(category, new Set(plugins));
    }
    
    // Import keywords
    for (const [keyword, plugins] of data.keywords) {
      this.pluginsByKeyword.set(keyword, new Set(plugins));
    }
    
    // Import metadata
    this.lastScanTime = data.metadata.lastScanTime;
    this.scanPaths = data.metadata.scanPaths;
    this.isInitialized = data.metadata.isInitialized;
    
    this.logger.info(`Imported ${this.plugins.size} plugins to registry`);
  }

  /**
   * Clear all registry data
   */
  clear() {
    this.plugins.clear();
    this.pluginsByCategory.clear();
    this.pluginsByKeyword.clear();
    this.loadedPlugins.clear();
    this.metadata.clearCache();
    
    this.lastScanTime = null;
    this.logger.debug('Plugin registry cleared');
  }

  /**
   * Add plugin to category index
   * @private
   * @param {string} category - Category name
   * @param {string} pluginName - Plugin name
   */
  addToCategory(category, pluginName) {
    if (!this.pluginsByCategory.has(category)) {
      this.pluginsByCategory.set(category, new Set());
    }
    this.pluginsByCategory.get(category).add(pluginName);
  }

  /**
   * Remove plugin from category index
   * @private
   * @param {string} category - Category name
   * @param {string} pluginName - Plugin name
   */
  removeFromCategory(category, pluginName) {
    if (this.pluginsByCategory.has(category)) {
      this.pluginsByCategory.get(category).delete(pluginName);
      if (this.pluginsByCategory.get(category).size === 0) {
        this.pluginsByCategory.delete(category);
      }
    }
  }

  /**
   * Add plugin to keyword index
   * @private
   * @param {string} keyword - Keyword
   * @param {string} pluginName - Plugin name
   */
  addToKeywordIndex(keyword, pluginName) {
    const normalizedKeyword = keyword.toLowerCase();
    if (!this.pluginsByKeyword.has(normalizedKeyword)) {
      this.pluginsByKeyword.set(normalizedKeyword, new Set());
    }
    this.pluginsByKeyword.get(normalizedKeyword).add(pluginName);
  }

  /**
   * Remove plugin from keyword index
   * @private
   * @param {string} keyword - Keyword
   * @param {string} pluginName - Plugin name
   */
  removeFromKeywordIndex(keyword, pluginName) {
    const normalizedKeyword = keyword.toLowerCase();
    if (this.pluginsByKeyword.has(normalizedKeyword)) {
      this.pluginsByKeyword.get(normalizedKeyword).delete(pluginName);
      if (this.pluginsByKeyword.get(normalizedKeyword).size === 0) {
        this.pluginsByKeyword.delete(normalizedKeyword);
      }
    }
  }

  /**
   * Mark plugin as loaded
   * @param {string} pluginName - Plugin name
   * @param {Object} pluginInstance - Plugin instance
   */
  markPluginLoaded(pluginName, pluginInstance) {
    this.loadedPlugins.set(pluginName, {
      name: pluginName,
      instance: pluginInstance,
      loadedAt: new Date()
    });
    
    this.logger.debug(`Marked plugin as loaded: ${pluginName}`);
  }

  /**
   * Mark plugin as unloaded
   * @param {string} pluginName - Plugin name
   */
  markPluginUnloaded(pluginName) {
    if (this.loadedPlugins.delete(pluginName)) {
      this.logger.debug(`Marked plugin as unloaded: ${pluginName}`);
      return true;
    }
    return false;
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
   * Get loaded plugin instance
   * @param {string} pluginName - Plugin name
   * @returns {Object|null} Plugin instance or null
   */
  getLoadedPlugin(pluginName) {
    const loaded = this.loadedPlugins.get(pluginName);
    return loaded ? loaded.instance : null;
  }
}