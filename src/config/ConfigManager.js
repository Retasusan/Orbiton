/**
 * @fileoverview Smart Configuration Manager
 * 
 * Provides intelligent configuration management with automatic defaults,
 * environment detection, configuration merging, and validation.
 * Supports zero-configuration setup with progressive customization.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Logger } from '../utils/Logger.js';
import { Validator } from '../utils/Validator.js';
import { ConfigurationError, FileSystemError, ValidationError } from '../utils/Errors.js';
import { EnvironmentDetector } from './EnvironmentDetector.js';

/**
 * Smart configuration manager with intelligent defaults
 */
export class ConfigManager {
  constructor() {
    this.logger = new Logger('config-manager');
    this.validator = new Validator();
    this.environmentDetector = new EnvironmentDetector();
    
    // Configuration state
    this.userConfig = null;
    this.defaultConfig = null;
    this.environmentConfig = null;
    this.mergedConfig = null;
    
    // Configuration paths
    this.configPaths = [
      '.orbitonrc.json',
      '.orbiton.json',
      path.join(os.homedir(), '.orbitonrc.json'),
      path.join(os.homedir(), '.orbiton', 'config.json')
    ];
    
    // Migration support
    this.legacyConfigPaths = [
      '.orbitonrc.json' // Legacy format
    ];
    
    // Configuration cache
    this.configCache = new Map();
    this.lastLoadTime = null;
  }

  /**
   * Load configuration with intelligent defaults
   * @param {string|Object} [options] - Config path string or options object
   * @returns {Promise<Object>} Merged configuration
   */
  async loadConfig(options = null) {
    try {
      this.logger.info('Loading configuration...');
      const startTime = Date.now();

      // Handle both string and object parameters for backward compatibility
      let configPath = null;
      let configOptions = {};
      
      if (typeof options === 'string') {
        configPath = options;
      } else if (options && typeof options === 'object') {
        configPath = options.configPath;
        configOptions = options;
      }

      // Load user configuration
      this.userConfig = await this.loadUserConfig(configPath);
      
      // Detect environment and generate environment-specific config
      this.environmentConfig = await this.detectEnvironment();
      
      // Generate intelligent defaults
      this.defaultConfig = await this.generateDefaults(this.environmentConfig);
      
      // Merge configurations (defaults < environment < user)
      this.mergedConfig = this.mergeConfigs(
        this.defaultConfig,
        this.environmentConfig,
        this.userConfig
      );
      
      // Validate merged configuration
      const validationResult = await this.validateConfiguration(this.mergedConfig);
      if (!validationResult.isValid) {
        throw new ConfigurationError(
          'Configuration validation failed',
          validationResult.errors,
          this.getActiveConfigPath()
        );
      }
      
      // Apply post-processing
      this.mergedConfig = await this.postProcessConfig(this.mergedConfig);
      
      this.lastLoadTime = new Date();
      
      this.logger.timing('Configuration loading', startTime);
      this.logger.info(`Configuration loaded successfully (${this.mergedConfig.plugins?.length || 0} plugins)`);
      
      return this.mergedConfig;
      
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Load user configuration from file
   * @param {string} [configPath] - Specific config path
   * @returns {Promise<Object|null>} User configuration or null
   */
  async loadUserConfig(configPath = null) {
    const pathsToTry = configPath ? [configPath] : this.configPaths;
    
    for (const configFilePath of pathsToTry) {
      try {
        const resolvedPath = path.resolve(configFilePath);
        
        // Check if file exists
        await fs.access(resolvedPath);
        
        this.logger.debug(`Loading user config from: ${resolvedPath}`);
        
        // Check cache
        const cacheKey = resolvedPath;
        if (this.configCache.has(cacheKey)) {
          const cached = this.configCache.get(cacheKey);
          const stats = await fs.stat(resolvedPath);
          
          if (stats.mtime <= cached.loadTime) {
            this.logger.debug('Using cached configuration');
            return cached.config;
          }
        }
        
        // Read and parse configuration
        const configContent = await fs.readFile(resolvedPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // Cache configuration
        const stats = await fs.stat(resolvedPath);
        this.configCache.set(cacheKey, {
          config,
          loadTime: stats.mtime,
          path: resolvedPath
        });
        
        this.logger.debug(`User configuration loaded from: ${resolvedPath}`);
        return config;
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, try next path
          continue;
        }
        
        if (error instanceof SyntaxError) {
          throw new ConfigurationError(
            `Invalid JSON in configuration file: ${configFilePath}`,
            [{ field: 'json', message: error.message }],
            configFilePath
          );
        }
        
        throw new FileSystemError(
          `Failed to read configuration file: ${error.message}`,
          configFilePath,
          'read'
        );
      }
    }
    
    // No user configuration found
    this.logger.debug('No user configuration found, using defaults');
    return null;
  }

  /**
   * Detect environment and generate environment-specific configuration
   * @returns {Promise<Object>} Environment configuration
   */
  async detectEnvironment() {
    this.logger.debug('Detecting environment...');
    
    const envProfile = await this.environmentDetector.detectEnvironment();
    
    // Generate configuration based on environment
    const envConfig = {
      autoDetect: true,
      environment: envProfile.platform,
      capabilities: envProfile.capabilities,
      
      // Suggest plugins based on environment
      plugins: envProfile.suggestedPlugins.map(pluginName => ({
        name: pluginName,
        enabled: true,
        options: {}
      })),
      
      // Suggest layout based on environment
      layout: {
        preset: envProfile.suggestedLayout || 'developer',
        custom: false
      },
      
      // Performance settings based on environment
      performance: this.generatePerformanceConfig(envProfile)
    };
    
    this.logger.debug(`Environment detected: ${envProfile.platform} with ${envProfile.capabilities.length} capabilities`);
    return envConfig;
  }

  /**
   * Generate intelligent default configuration
   * @param {Object} environmentConfig - Environment-specific config
   * @returns {Promise<Object>} Default configuration
   */
  async generateDefaults(environmentConfig) {
    const defaults = {
      // Core settings
      autoDetect: true,
      version: '2.0.0',
      
      // Layout configuration
      layout: {
        preset: 'developer',
        custom: false,
        grid: {
          rows: 12,
          cols: 12
        }
      },
      
      // Plugin configuration
      plugins: [
        {
          name: 'system-info',
          enabled: true,
          position: [0, 0, 6, 6],
          options: {
            updateInterval: 5000
          }
        },
        {
          name: 'clock',
          enabled: true,
          position: [0, 6, 6, 6],
          options: {
            format: '24h',
            updateInterval: 1000
          }
        }
      ],
      
      // Theme configuration
      theme: 'default',
      
      // Performance settings
      performance: {
        updateInterval: 5000,
        maxConcurrentUpdates: 5,
        maxMemoryUsage: 100 * 1024 * 1024 // 100MB
      },
      
      // Development settings
      development: {
        hotReload: false,
        debugMode: false,
        logLevel: 'info'
      }
    };
    
    // Adjust defaults based on environment
    if (environmentConfig.environment === 'server') {
      defaults.plugins = [
        {
          name: 'system-info',
          enabled: true,
          position: [0, 0, 6, 12],
          options: { updateInterval: 10000 }
        },
        {
          name: 'process-monitor',
          enabled: true,
          position: [6, 0, 6, 12],
          options: { updateInterval: 5000 }
        }
      ];
      defaults.performance.updateInterval = 10000;
    } else if (environmentConfig.environment === 'minimal') {
      defaults.plugins = [
        {
          name: 'clock',
          enabled: true,
          position: [0, 0, 12, 12],
          options: { format: '24h' }
        }
      ];
      defaults.performance.maxConcurrentUpdates = 2;
    }
    
    return defaults;
  }

  /**
   * Generate performance configuration based on environment
   * @param {Object} envProfile - Environment profile
   * @returns {Object} Performance configuration
   */
  generatePerformanceConfig(envProfile) {
    const performance = {
      updateInterval: 5000,
      maxConcurrentUpdates: 5,
      maxMemoryUsage: 100 * 1024 * 1024
    };
    
    // Adjust based on system capabilities
    if (envProfile.capabilities.system?.hasLowMemory) {
      performance.maxMemoryUsage = 50 * 1024 * 1024; // 50MB
      performance.maxConcurrentUpdates = 3;
      performance.updateInterval = 10000;
    }
    
    if (envProfile.capabilities.system?.hasBattery) {
      // Battery-powered device, be more conservative
      performance.updateInterval = 10000;
      performance.maxConcurrentUpdates = 3;
    }
    
    return performance;
  }

  /**
   * Merge multiple configuration objects
   * @param {...Object} configs - Configuration objects to merge (priority: left to right)
   * @returns {Object} Merged configuration
   */
  mergeConfigs(...configs) {
    const merged = {};
    
    for (const config of configs) {
      if (!config) continue;
      
      this.deepMerge(merged, config);
    }
    
    return merged;
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (this.isObject(source[key]) && this.isObject(target[key])) {
          this.deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
    return target;
  }

  /**
   * Check if value is an object
   * @param {any} obj - Value to check
   * @returns {boolean} Whether value is an object
   */
  isObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateConfiguration(config) {
    return this.validator.validateDashboardConfig(config);
  }

  /**
   * Post-process configuration after merging and validation
   * @param {Object} config - Configuration to process
   * @returns {Promise<Object>} Processed configuration
   */
  async postProcessConfig(config) {
    const processed = { ...config };
    
    // Resolve plugin positions if using preset
    if (!processed.layout.custom && processed.layout.preset) {
      processed.plugins = await this.resolvePluginPositions(
        processed.plugins,
        processed.layout.preset
      );
    }
    
    // Add computed fields
    processed._computed = {
      loadTime: new Date(),
      configSource: this.getActiveConfigPath(),
      pluginCount: processed.plugins?.length || 0,
      hasUserConfig: this.userConfig !== null,
      environment: processed.environment || 'unknown'
    };
    
    return processed;
  }

  /**
   * Resolve plugin positions based on preset
   * @param {Array} plugins - Plugin configurations
   * @param {string} preset - Layout preset name
   * @returns {Promise<Array>} Plugins with resolved positions
   */
  async resolvePluginPositions(plugins, preset) {
    const presetLayouts = {
      developer: [
        [0, 0, 6, 6],   // system-info
        [0, 6, 6, 6],   // clock
        [6, 0, 6, 12],  // additional plugins
      ],
      server: [
        [0, 0, 6, 12],  // system-info
        [6, 0, 6, 12],  // process-monitor
      ],
      minimal: [
        [0, 0, 12, 12], // single widget
      ],
      monitoring: [
        [0, 0, 4, 4],   // cpu
        [0, 4, 4, 4],   // memory
        [0, 8, 4, 4],   // disk
        [4, 0, 8, 12],  // detailed info
      ]
    };
    
    const layout = presetLayouts[preset] || presetLayouts.developer;
    
    return plugins.map((plugin, index) => ({
      ...plugin,
      position: plugin.position || layout[index] || [0, 0, 4, 4]
    }));
  }

  /**
   * Save configuration to file
   * @param {Object} config - Configuration to save
   * @param {string} [configPath] - Path to save to
   * @returns {Promise<void>}
   */
  async saveConfig(config, configPath = null) {
    const savePath = configPath || this.getActiveConfigPath() || '.orbitonrc.json';
    
    try {
      this.logger.debug(`Saving configuration to: ${savePath}`);
      
      // Create directory if it doesn't exist
      const dir = path.dirname(savePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Remove computed fields before saving
      const configToSave = { ...config };
      delete configToSave._computed;
      
      // Write configuration
      const configContent = JSON.stringify(configToSave, null, 2);
      await fs.writeFile(savePath, configContent, 'utf-8');
      
      // Update cache
      const stats = await fs.stat(savePath);
      this.configCache.set(path.resolve(savePath), {
        config: configToSave,
        loadTime: stats.mtime,
        path: savePath
      });
      
      this.logger.info(`Configuration saved to: ${savePath}`);
      
    } catch (error) {
      throw new FileSystemError(
        `Failed to save configuration: ${error.message}`,
        savePath,
        'write'
      );
    }
  }

  /**
   * Initialize default configuration
   * @param {Object} options - Initialization options
   * @returns {Promise<Object>} Created configuration
   */
  async initializeConfig(options = {}) {
    this.logger.info('Initializing default configuration...');
    
    // Detect environment
    const envConfig = await this.detectEnvironment();
    
    // Generate defaults
    const defaults = await this.generateDefaults(envConfig);
    
    // Merge with any provided options
    const config = this.mergeConfigs(defaults, envConfig, options);
    
    // Save configuration
    const configPath = options.configPath || '.orbitonrc.json';
    await this.saveConfig(config, configPath);
    
    this.logger.info(`Default configuration created at: ${configPath}`);
    return config;
  }

  /**
   * Migrate legacy configuration
   * @returns {Promise<Object>} Migration result
   */
  async migrateFromLegacy() {
    this.logger.info('Checking for legacy configuration...');
    
    for (const legacyPath of this.legacyConfigPaths) {
      try {
        await fs.access(legacyPath);
        
        this.logger.info(`Found legacy configuration: ${legacyPath}`);
        
        // Load legacy config
        const legacyContent = await fs.readFile(legacyPath, 'utf-8');
        const legacyConfig = JSON.parse(legacyContent);
        
        // Migrate configuration
        const migratedConfig = await this.migrateLegacyConfig(legacyConfig);
        
        // Save migrated config
        const newConfigPath = '.orbitonrc.json';
        await this.saveConfig(migratedConfig, newConfigPath);
        
        // Backup legacy config
        const backupPath = `${legacyPath}.backup`;
        await fs.copyFile(legacyPath, backupPath);
        
        this.logger.info(`Configuration migrated successfully. Backup saved to: ${backupPath}`);
        
        return {
          success: true,
          message: 'Configuration migrated successfully',
          backupPath,
          newConfigPath
        };
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue; // File doesn't exist, try next
        }
        
        this.logger.error(`Failed to migrate legacy config ${legacyPath}:`, error);
        return {
          success: false,
          message: 'Migration failed',
          error: error.message,
          legacyPath
        };
      }
    }
    
    return {
      success: false,
      message: 'No legacy configuration found'
    };
  }

  /**
   * Migrate legacy configuration format
   * @param {Object} legacyConfig - Legacy configuration
   * @returns {Promise<Object>} Migrated configuration
   */
  async migrateLegacyConfig(legacyConfig) {
    const migrated = {
      version: '2.0.0',
      autoDetect: true,
      layout: {
        preset: legacyConfig.preset || 'developer',
        custom: legacyConfig.custom || false
      },
      plugins: [],
      theme: legacyConfig.theme || 'default'
    };
    
    // Migrate plugins
    if (legacyConfig.plugins) {
      migrated.plugins = legacyConfig.plugins.map(plugin => ({
        name: plugin.name,
        enabled: plugin.enabled !== false,
        position: plugin.position || [0, 0, 4, 4],
        options: plugin.options || {}
      }));
    }
    
    // Migrate performance settings
    if (legacyConfig.performance) {
      migrated.performance = legacyConfig.performance;
    }
    
    return migrated;
  }

  /**
   * Get active configuration file path
   * @returns {string|null} Active config path or null
   */
  getActiveConfigPath() {
    for (const [path, cached] of this.configCache) {
      if (cached.config) {
        return cached.path;
      }
    }
    return null;
  }

  /**
   * Get configuration file path (for compatibility)
   * @returns {string} Configuration file path
   */
  getConfigPath() {
    return this.getActiveConfigPath() || this.configPaths[0];
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getConfigSummary() {
    if (!this.mergedConfig) {
      return { loaded: false };
    }
    
    return {
      loaded: true,
      source: this.getActiveConfigPath(),
      lastLoadTime: this.lastLoadTime,
      pluginCount: this.mergedConfig.plugins?.length || 0,
      preset: this.mergedConfig.layout?.preset,
      customLayout: this.mergedConfig.layout?.custom,
      theme: this.mergedConfig.theme,
      autoDetect: this.mergedConfig.autoDetect,
      environment: this.mergedConfig.environment,
      hasUserConfig: this.userConfig !== null
    };
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.configCache.clear();
    this.userConfig = null;
    this.defaultConfig = null;
    this.environmentConfig = null;
    this.mergedConfig = null;
    this.lastLoadTime = null;
    
    this.logger.debug('Configuration cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.configCache.size,
      lastLoadTime: this.lastLoadTime,
      configPaths: this.configPaths.length,
      hasUserConfig: this.userConfig !== null,
      hasMergedConfig: this.mergedConfig !== null
    };
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateConfig(config) {
    try {
      const validator = new (await import('../config/ConfigValidator.js')).ConfigValidator();
      return await validator.validate(config);
    } catch (error) {
      return {
        isValid: false,
        errors: [{ message: `Validation failed: ${error.message}` }],
        warnings: []
      };
    }
  }

  /**
   * Generate default configuration
   * @returns {Promise<Object>} Default configuration
   */
  async generateDefaultConfig() {
    const envConfig = await this.detectEnvironment();
    return await this.generateDefaults(envConfig);
  }
}