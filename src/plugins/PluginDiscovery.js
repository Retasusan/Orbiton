/**
 * @fileoverview Plugin Discovery System
 * 
 * Discovers plugins from various sources including local directories,
 * npm packages, and remote repositories. Handles plugin scanning,
 * validation, and registration.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';
import { PluginMetadata } from './PluginMetadata.js';
import { PluginRegistry } from './PluginRegistry.js';
import { FileSystemError, PluginError } from '../utils/Errors.js';

/**
 * Plugin discovery system
 */
export class PluginDiscovery {
  constructor(registry = null) {
    this.logger = new Logger('plugin-discovery');
    this.metadata = new PluginMetadata();
    this.registry = registry || new PluginRegistry();
    
    // Discovery configuration
    this.scanPaths = [];
    this.excludePatterns = [
      'node_modules',
      '.git',
      '.DS_Store',
      'dist',
      'build',
      '*.log'
    ];
    
    // Discovery state
    this.isScanning = false;
    this.lastScanResults = null;
    this.scanHistory = [];
  }

  /**
   * Initialize plugin discovery
   * @param {Object} options - Discovery options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    this.logger.info('Initializing plugin discovery');
    
    // Set scan paths
    this.scanPaths = options.scanPaths || [
      './plugins',
      './node_modules',
      process.env.ORBITON_PLUGIN_PATH,
      path.join(process.env.HOME || process.env.USERPROFILE || '.', '.orbiton', 'plugins')
    ].filter(Boolean);

    // Set exclude patterns
    if (options.excludePatterns) {
      this.excludePatterns = [...this.excludePatterns, ...options.excludePatterns];
    }

    // Initialize registry if not provided
    if (!this.registry.isInitialized) {
      await this.registry.initialize({ scanPaths: this.scanPaths });
    }

    this.logger.info(`Plugin discovery initialized with ${this.scanPaths.length} scan paths`);
  }

  /**
   * Discover all plugins from configured sources
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Discovery results
   */
  async discoverPlugins(options = {}) {
    if (this.isScanning) {
      this.logger.warn('Plugin discovery already in progress');
      return this.lastScanResults;
    }

    this.isScanning = true;
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting plugin discovery scan');
      
      const results = {
        discovered: [],
        failed: [],
        skipped: [],
        scanTime: null,
        scanPaths: [...this.scanPaths],
        timestamp: new Date()
      };

      // Discover from each source
      for (const scanPath of this.scanPaths) {
        try {
          const pathResults = await this.discoverFromPath(scanPath, options);
          results.discovered.push(...pathResults.discovered);
          results.failed.push(...pathResults.failed);
          results.skipped.push(...pathResults.skipped);
        } catch (error) {
          this.logger.error(`Failed to scan path ${scanPath}:`, error);
          results.failed.push({
            path: scanPath,
            error: error.message,
            type: 'scan-error'
          });
        }
      }

      // Discover from npm if enabled
      if (options.includeNpm !== false) {
        try {
          const npmResults = await this.discoverFromNpm(options);
          results.discovered.push(...npmResults.discovered);
          results.failed.push(...npmResults.failed);
        } catch (error) {
          this.logger.warn('NPM discovery failed:', error);
        }
      }

      results.scanTime = Date.now() - startTime;
      this.lastScanResults = results;
      
      // Add to scan history
      this.scanHistory.push({
        timestamp: results.timestamp,
        discovered: results.discovered.length,
        failed: results.failed.length,
        scanTime: results.scanTime
      });
      
      // Keep only last 10 scan results
      if (this.scanHistory.length > 10) {
        this.scanHistory.shift();
      }

      this.logger.info(`Plugin discovery completed: ${results.discovered.length} discovered, ${results.failed.length} failed, ${results.scanTime}ms`);
      
      return results;
      
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Discover plugins from a specific path
   * @param {string} scanPath - Path to scan
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Path discovery results
   */
  async discoverFromPath(scanPath, options = {}) {
    const results = {
      discovered: [],
      failed: [],
      skipped: []
    };

    try {
      const resolvedPath = path.resolve(scanPath);
      
      // Check if path exists
      try {
        await fs.access(resolvedPath);
      } catch {
        this.logger.debug(`Scan path does not exist: ${resolvedPath}`);
        return results;
      }

      this.logger.debug(`Scanning path: ${resolvedPath}`);
      
      // Get directory contents
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const entryPath = path.join(resolvedPath, entry.name);
        
        // Skip excluded patterns
        if (this.shouldSkipPath(entry.name)) {
          results.skipped.push({
            path: entryPath,
            reason: 'excluded-pattern'
          });
          continue;
        }

        try {
          const plugin = await this.discoverPlugin(entryPath, options);
          if (plugin) {
            results.discovered.push(plugin);
            
            // Register plugin if auto-register is enabled
            if (options.autoRegister !== false) {
              await this.registry.registerPlugin(plugin);
            }
          }
        } catch (error) {
          results.failed.push({
            path: entryPath,
            error: error.message,
            type: 'plugin-error'
          });
        }
      }

    } catch (error) {
      throw new FileSystemError(
        `Failed to scan directory: ${error.message}`,
        scanPath,
        'read'
      );
    }

    return results;
  }

  /**
   * Discover a single plugin from a directory
   * @param {string} pluginPath - Plugin directory path
   * @param {Object} options - Discovery options
   * @returns {Promise<Object|null>} Plugin metadata or null
   */
  async discoverPlugin(pluginPath, options = {}) {
    try {
      this.logger.debug(`Discovering plugin at: ${pluginPath}`);
      
      // Check for plugin.json
      const metadataPath = path.join(pluginPath, 'plugin.json');
      try {
        await fs.access(metadataPath);
      } catch {
        // Not a plugin directory
        return null;
      }

      // Load plugin metadata
      const metadata = await this.metadata.loadMetadata(pluginPath);
      
      // Check if plugin main file exists
      const mainFile = path.join(pluginPath, 'index.js');
      try {
        await fs.access(mainFile);
        metadata.hasMainFile = true;
      } catch {
        metadata.hasMainFile = false;
        this.logger.warn(`Plugin ${metadata.name} missing main file: index.js`);
      }

      // Validate plugin structure
      await this.validatePluginStructure(pluginPath, metadata);
      
      // Add discovery metadata
      metadata.discoveredAt = new Date();
      metadata.discoverySource = 'local';
      metadata.pluginPath = path.resolve(pluginPath);
      
      this.logger.debug(`Successfully discovered plugin: ${metadata.name}@${metadata.version}`);
      return metadata;
      
    } catch (error) {
      this.logger.error(`Error discovering plugin at ${pluginPath}:`, error);
      throw new PluginError(
        path.basename(pluginPath),
        `Failed to discover plugin: ${error.message}`,
        error
      );
    }
  }

  /**
   * Discover plugins from npm registry
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} NPM discovery results
   */
  async discoverFromNpm(options = {}) {
    const results = {
      discovered: [],
      failed: []
    };

    try {
      this.logger.debug('Discovering plugins from npm registry');
      
      // Search for orbiton plugins
      const searchTerms = options.npmSearchTerms || [
        'orbiton-plugin',
        'orbiton-widget'
      ];

      for (const term of searchTerms) {
        try {
          const npmResults = await this.searchNpmPackages(term, options);
          
          for (const pkg of npmResults) {
            try {
              const plugin = await this.processNpmPackage(pkg);
              if (plugin) {
                results.discovered.push(plugin);
                await this.registry.registerPlugin(plugin);
              }
            } catch (error) {
              results.failed.push({
                package: pkg.name,
                error: error.message,
                type: 'npm-package-error'
              });
            }
          }
        } catch (error) {
          this.logger.warn(`NPM search failed for term "${term}":`, error);
        }
      }

    } catch (error) {
      this.logger.error('NPM discovery failed:', error);
      throw error;
    }

    this.logger.debug(`NPM discovery completed: ${results.discovered.length} discovered, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Search npm packages
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Package results
   */
  async searchNpmPackages(searchTerm, options = {}) {
    this.logger.debug(`Searching npm for: ${searchTerm}`);
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const foundPackages = [];
      for (const [name, version] of Object.entries(dependencies)) {
        if (name.includes(searchTerm) || name.startsWith(searchTerm)) {
          foundPackages.push({ name, version });
        }
      }
      return foundPackages;
    } catch (error) {
      this.logger.error(`Failed to read package.json for npm search: ${error.message}`);
      return [];
    }
  }

  /**
   * Process npm package as plugin
   * @param {Object} pkg - NPM package info
   * @returns {Promise<Object|null>} Plugin metadata or null
   */
  async processNpmPackage(pkg) {
    // Create a minimal plugin metadata object for npm packages
    // This allows them to be registered as 'available' for dependency resolution
    return {
      name: pkg.name,
      version: pkg.version,
      description: `NPM package: ${pkg.name}`,
      author: 'NPM',
      license: 'UNKNOWN',
      keywords: [],
      category: 'npm-dependency',
      size: 'unknown',
      pluginPath: null, // No specific plugin path for npm packages
      isNpm: true,
      discoveredAt: new Date(),
      discoverySource: 'npm'
    };
  }

  /**
   * Validate plugin directory structure
   * @param {string} pluginPath - Plugin directory path
   * @param {Object} metadata - Plugin metadata
   * @returns {Promise<void>}
   */
  async validatePluginStructure(pluginPath, metadata) {
    const requiredFiles = ['index.js', 'plugin.json'];
    const optionalFiles = ['README.md', 'default.json', 'test.js'];
    
    const issues = [];
    
    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(pluginPath, file);
      try {
        await fs.access(filePath);
      } catch {
        issues.push(`Missing required file: ${file}`);
      }
    }
    
    // Check optional files and warn if missing
    for (const file of optionalFiles) {
      const filePath = path.join(pluginPath, file);
      try {
        await fs.access(filePath);
      } catch {
        this.logger.debug(`Plugin ${metadata.name} missing optional file: ${file}`);
      }
    }
    
    if (issues.length > 0) {
      throw new PluginError(
        metadata.name,
        `Plugin structure validation failed: ${issues.join(', ')}`
      );
    }
  }

  /**
   * Check if path should be skipped
   * @param {string} pathName - Path name to check
   * @returns {boolean} Whether to skip path
   */
  shouldSkipPath(pathName) {
    return this.excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        // Simple glob pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(pathName);
      }
      return pathName === pattern || pathName.startsWith(pattern);
    });
  }

  /**
   * Get discovery statistics
   * @returns {Object} Discovery statistics
   */
  getStatistics() {
    const stats = {
      scanPaths: this.scanPaths.length,
      excludePatterns: this.excludePatterns.length,
      isScanning: this.isScanning,
      lastScan: this.lastScanResults ? {
        timestamp: this.lastScanResults.timestamp,
        discovered: this.lastScanResults.discovered.length,
        failed: this.lastScanResults.failed.length,
        scanTime: this.lastScanResults.scanTime
      } : null,
      scanHistory: this.scanHistory.length,
      totalScans: this.scanHistory.length
    };

    if (this.scanHistory.length > 0) {
      const totalScanTime = this.scanHistory.reduce((sum, scan) => sum + scan.scanTime, 0);
      const totalDiscovered = this.scanHistory.reduce((sum, scan) => sum + scan.discovered, 0);
      
      stats.averageScanTime = totalScanTime / this.scanHistory.length;
      stats.averageDiscovered = totalDiscovered / this.scanHistory.length;
    }

    return stats;
  }

  /**
   * Get scan history
   * @returns {Array} Scan history
   */
  getScanHistory() {
    return [...this.scanHistory];
  }

  /**
   * Clear scan history
   */
  clearScanHistory() {
    this.scanHistory = [];
    this.lastScanResults = null;
    this.logger.debug('Scan history cleared');
  }

  /**
   * Add scan path
   * @param {string} scanPath - Path to add
   */
  addScanPath(scanPath) {
    const resolvedPath = path.resolve(scanPath);
    if (!this.scanPaths.includes(resolvedPath)) {
      this.scanPaths.push(resolvedPath);
      this.logger.debug(`Added scan path: ${resolvedPath}`);
    }
  }

  /**
   * Remove scan path
   * @param {string} scanPath - Path to remove
   * @returns {boolean} Whether path was removed
   */
  removeScanPath(scanPath) {
    const resolvedPath = path.resolve(scanPath);
    const index = this.scanPaths.indexOf(resolvedPath);
    if (index !== -1) {
      this.scanPaths.splice(index, 1);
      this.logger.debug(`Removed scan path: ${resolvedPath}`);
      return true;
    }
    return false;
  }

  /**
   * Add exclude pattern
   * @param {string} pattern - Pattern to add
   */
  addExcludePattern(pattern) {
    if (!this.excludePatterns.includes(pattern)) {
      this.excludePatterns.push(pattern);
      this.logger.debug(`Added exclude pattern: ${pattern}`);
    }
  }

  /**
   * Remove exclude pattern
   * @param {string} pattern - Pattern to remove
   * @returns {boolean} Whether pattern was removed
   */
  removeExcludePattern(pattern) {
    const index = this.excludePatterns.indexOf(pattern);
    if (index !== -1) {
      this.excludePatterns.splice(index, 1);
      this.logger.debug(`Removed exclude pattern: ${pattern}`);
      return true;
    }
    return false;
  }
}