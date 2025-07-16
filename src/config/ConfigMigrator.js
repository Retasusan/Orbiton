/**
 * Configuration Migrator - Handles migration from legacy configuration formats
 * 
 * This class provides comprehensive migration utilities to convert old Orbiton
 * configurations to the new format, with validation, rollback capabilities,
 * and detailed progress reporting.
 */

import fs from 'fs/promises';
import path from 'path';
import { ConfigValidator } from './ConfigValidator.js';

export class ConfigMigrator {
  constructor(options = {}) {
    this.validator = new ConfigValidator();
    this.logger = options.logger || console;
    this.backupEnabled = options.backupEnabled !== false;
    this.validateAfterMigration = options.validateAfterMigration !== false;
    
    // Migration mappings
    this.fieldMappings = new Map();
    this.transformers = new Map();
    this.validators = new Map();
    
    this.setupMigrationRules();
  }

  /**
   * Setup migration rules and transformations
   */
  setupMigrationRules() {
    // Field mappings from old to new format
    this.fieldMappings.set('widgets', 'plugins');
    this.fieldMappings.set('refreshInterval', 'updateInterval');
    this.fieldMappings.set('gridRows', 'layout.grid.rows');
    this.fieldMappings.set('gridCols', 'layout.grid.cols');
    this.fieldMappings.set('customTheme', 'theme');

    // Widget/Plugin transformations
    this.addTransformer('widgets', (widgets) => {
      if (!Array.isArray(widgets)) return [];
      
      return widgets.map(widget => ({
        name: widget.type || widget.name,
        enabled: widget.enabled !== false,
        position: this.transformPosition(widget),
        options: this.transformWidgetOptions(widget),
        updateInterval: widget.refreshInterval || widget.updateInterval
      })).filter(plugin => plugin.name);
    });

    // Layout transformations
    this.addTransformer('layout', (oldConfig) => {
      const layout = {};
      
      if (oldConfig.preset) {
        layout.preset = oldConfig.preset;
      }
      
      if (oldConfig.gridRows || oldConfig.gridCols) {
        layout.grid = {
          rows: oldConfig.gridRows || 4,
          cols: oldConfig.gridCols || 4
        };
        layout.custom = true;
      }
      
      if (oldConfig.responsive !== undefined) {
        layout.responsive = oldConfig.responsive;
      }
      
      return Object.keys(layout).length > 0 ? layout : undefined;
    });

    // Theme transformations
    this.addTransformer('theme', (themeConfig) => {
      if (typeof themeConfig === 'string') {
        return themeConfig;
      }
      
      if (typeof themeConfig === 'object' && themeConfig !== null) {
        return this.transformThemeObject(themeConfig);
      }
      
      return 'default';
    });

    // Performance configuration transformations
    this.addTransformer('performance', (oldConfig) => {
      const performance = {};
      
      if (oldConfig.maxConcurrentUpdates) {
        performance.maxConcurrentUpdates = oldConfig.maxConcurrentUpdates;
      }
      
      if (oldConfig.globalRefreshInterval) {
        performance.updateInterval = oldConfig.globalRefreshInterval;
      }
      
      if (oldConfig.maxMemoryUsage) {
        performance.maxMemoryUsage = oldConfig.maxMemoryUsage;
      }
      
      return Object.keys(performance).length > 0 ? performance : undefined;
    });
  }

  /**
   * Add a field transformer
   * @param {string} field - Field name
   * @param {Function} transformer - Transformation function
   */
  addTransformer(field, transformer) {
    this.transformers.set(field, transformer);
  }

  /**
   * Add a field validator
   * @param {string} field - Field name
   * @param {Function} validator - Validation function
   */
  addValidator(field, validator) {
    this.validators.set(field, validator);
  }

  /**
   * Migrate configuration from legacy format
   * @param {Object} legacyConfig - Legacy configuration object
   * @returns {Promise<Object>} Migration result
   */
  async migrate(legacyConfig) {
    this.logger.info('Starting configuration migration...');
    
    const migrationResult = {
      success: false,
      migratedConfig: null,
      warnings: [],
      errors: [],
      manualSteps: [],
      backupPath: null
    };

    try {
      // Validate input
      if (!legacyConfig || typeof legacyConfig !== 'object') {
        throw new Error('Invalid legacy configuration provided');
      }

      // Detect configuration version/format
      const configFormat = this.detectConfigFormat(legacyConfig);
      this.logger.info(`Detected configuration format: ${configFormat}`);

      // Apply format-specific migrations
      let migratedConfig = await this.applyFormatMigration(legacyConfig, configFormat);

      // Apply general transformations
      migratedConfig = await this.applyTransformations(migratedConfig, legacyConfig);

      // Validate migrated configuration
      if (this.validateAfterMigration) {
        const validationResult = await this.validator.validate(migratedConfig);
        if (!validationResult.isValid) {
          migrationResult.errors.push(...validationResult.errors);
          migrationResult.warnings.push(...validationResult.warnings);
        }
      }

      // Generate manual migration steps for unsupported features
      const manualSteps = this.generateManualSteps(legacyConfig, migratedConfig);
      migrationResult.manualSteps = manualSteps;

      migrationResult.success = true;
      migrationResult.migratedConfig = migratedConfig;
      
      this.logger.info('Configuration migration completed successfully');

    } catch (error) {
      migrationResult.errors.push({
        message: error.message,
        type: 'migration_error',
        field: null
      });
      this.logger.error('Configuration migration failed:', error);
    }

    return migrationResult;
  }

  /**
   * Migrate configuration file
   * @param {string} legacyConfigPath - Path to legacy configuration file
   * @param {string} newConfigPath - Path for new configuration file
   * @returns {Promise<Object>} Migration result
   */
  async migrateFile(legacyConfigPath, newConfigPath) {
    this.logger.info(`Migrating configuration file: ${legacyConfigPath} -> ${newConfigPath}`);

    const migrationResult = {
      success: false,
      backupPath: null,
      warnings: [],
      errors: [],
      manualSteps: []
    };

    try {
      // Check if legacy file exists
      const legacyExists = await this.fileExists(legacyConfigPath);
      if (!legacyExists) {
        throw new Error(`Legacy configuration file not found: ${legacyConfigPath}`);
      }

      // Read legacy configuration
      const legacyContent = await fs.readFile(legacyConfigPath, 'utf8');
      const legacyConfig = JSON.parse(legacyContent);

      // Create backup if enabled
      if (this.backupEnabled) {
        const backupPath = `${legacyConfigPath}.backup.${Date.now()}`;
        await fs.copyFile(legacyConfigPath, backupPath);
        migrationResult.backupPath = backupPath;
        this.logger.info(`Created backup: ${backupPath}`);
      }

      // Migrate configuration
      const result = await this.migrate(legacyConfig);
      
      if (result.success) {
        // Write new configuration
        const newConfigContent = JSON.stringify(result.migratedConfig, null, 2);
        await fs.writeFile(newConfigPath, newConfigContent, 'utf8');
        
        migrationResult.success = true;
        migrationResult.warnings = result.warnings;
        migrationResult.errors = result.errors;
        migrationResult.manualSteps = result.manualSteps;
        
        this.logger.info(`New configuration written to: ${newConfigPath}`);
      } else {
        migrationResult.errors = result.errors;
        migrationResult.warnings = result.warnings;
      }

    } catch (error) {
      migrationResult.errors.push({
        message: error.message,
        type: 'file_error',
        field: null
      });
      this.logger.error('File migration failed:', error);
    }

    return migrationResult;
  }

  /**
   * Detect configuration format
   * @param {Object} config - Configuration object
   * @returns {string} Configuration format
   */
  detectConfigFormat(config) {
    // Check for v1 format indicators
    if (config.widgets && Array.isArray(config.widgets)) {
      return 'v1';
    }

    // Check for v0 format indicators
    if (config.dashboard && config.dashboard.widgets) {
      return 'v0';
    }

    // Check for current format
    if (config.plugins && Array.isArray(config.plugins)) {
      return 'current';
    }

    // Default to unknown
    return 'unknown';
  }

  /**
   * Apply format-specific migrations
   * @param {Object} config - Configuration object
   * @param {string} format - Configuration format
   * @returns {Promise<Object>} Migrated configuration
   */
  async applyFormatMigration(config, format) {
    switch (format) {
      case 'v0':
        return this.migrateFromV0(config);
      case 'v1':
        return this.migrateFromV1(config);
      case 'current':
        return config; // No migration needed
      default:
        this.logger.warn(`Unknown configuration format: ${format}`);
        return config;
    }
  }

  /**
   * Migrate from v0 format
   * @param {Object} config - V0 configuration
   * @returns {Object} Migrated configuration
   */
  migrateFromV0(config) {
    const migrated = {
      autoDetect: true,
      layout: {},
      plugins: [],
      theme: 'default'
    };

    // Migrate dashboard settings
    if (config.dashboard) {
      const dashboard = config.dashboard;
      
      if (dashboard.theme) {
        migrated.theme = dashboard.theme;
      }
      
      if (dashboard.layout) {
        migrated.layout = {
          grid: {
            rows: dashboard.layout.rows || 4,
            cols: dashboard.layout.cols || 4
          }
        };
      }
      
      // Migrate widgets
      if (dashboard.widgets && Array.isArray(dashboard.widgets)) {
        migrated.plugins = dashboard.widgets.map(widget => ({
          name: widget.name || widget.type,
          enabled: widget.enabled !== false,
          position: [
            widget.position?.row || 0,
            widget.position?.col || 0,
            widget.position?.rowSpan || 1,
            widget.position?.colSpan || 1
          ],
          options: widget.config || widget.options || {}
        }));
      }
    }

    return migrated;
  }

  /**
   * Migrate from v1 format
   * @param {Object} config - V1 configuration
   * @returns {Object} Migrated configuration
   */
  migrateFromV1(config) {
    const migrated = {
      autoDetect: config.autoDetect !== false,
      layout: {},
      plugins: [],
      theme: config.theme || 'default'
    };

    // Migrate layout
    if (config.gridRows || config.gridCols) {
      migrated.layout.grid = {
        rows: config.gridRows || 4,
        cols: config.gridCols || 4
      };
      migrated.layout.custom = true;
    }

    // Migrate widgets to plugins
    if (config.widgets && Array.isArray(config.widgets)) {
      migrated.plugins = config.widgets.map(widget => ({
        name: widget.type || widget.name,
        enabled: widget.enabled !== false,
        position: [
          widget.row || 0,
          widget.col || 0,
          widget.rowSpan || 1,
          widget.colSpan || 1
        ],
        options: widget.options || {},
        updateInterval: widget.refreshInterval
      }));
    }

    // Migrate performance settings
    if (config.performance || config.maxConcurrentUpdates || config.globalRefreshInterval) {
      migrated.performance = {
        maxConcurrentUpdates: config.maxConcurrentUpdates || config.performance?.maxConcurrentUpdates,
        updateInterval: config.globalRefreshInterval || config.performance?.updateInterval,
        maxMemoryUsage: config.performance?.maxMemoryUsage
      };
    }

    return migrated;
  }

  /**
   * Apply general transformations
   * @param {Object} config - Configuration to transform
   * @param {Object} originalConfig - Original configuration for reference
   * @returns {Promise<Object>} Transformed configuration
   */
  async applyTransformations(config, originalConfig) {
    const transformed = { ...config };

    // Apply field transformers
    for (const [field, transformer] of this.transformers) {
      if (field === 'layout') {
        const layoutResult = transformer(originalConfig);
        if (layoutResult) {
          transformed.layout = { ...transformed.layout, ...layoutResult };
        }
      } else if (field === 'performance') {
        const perfResult = transformer(originalConfig);
        if (perfResult) {
          transformed.performance = perfResult;
        }
      } else if (originalConfig[field] !== undefined) {
        const result = transformer(originalConfig[field]);
        if (result !== undefined) {
          const targetField = this.fieldMappings.get(field) || field;
          this.setNestedProperty(transformed, targetField, result);
        }
      }
    }

    return transformed;
  }

  /**
   * Transform widget position
   * @param {Object} widget - Widget configuration
   * @returns {Array} Position array [row, col, rowSpan, colSpan]
   */
  transformPosition(widget) {
    return [
      widget.row || widget.position?.row || 0,
      widget.col || widget.position?.col || 0,
      widget.rowSpan || widget.position?.rowSpan || 1,
      widget.colSpan || widget.position?.colSpan || 1
    ];
  }

  /**
   * Transform widget options
   * @param {Object} widget - Widget configuration
   * @returns {Object} Transformed options
   */
  transformWidgetOptions(widget) {
    const options = { ...widget.options };

    // Common option transformations
    if (widget.title) {
      options.title = widget.title;
    }

    if (widget.refreshInterval) {
      options.updateInterval = widget.refreshInterval;
    }

    // Widget-specific transformations
    switch (widget.type) {
      case 'clock':
        if (widget.format) options.format = widget.format;
        if (widget.timezone) options.timezone = widget.timezone;
        break;
      
      case 'system':
      case 'sysinfo':
        if (widget.showDetails !== undefined) options.showDetails = widget.showDetails;
        break;
      
      case 'docker':
        if (widget.showOnlyRunning !== undefined) options.showOnlyRunning = widget.showOnlyRunning;
        break;
    }

    return options;
  }

  /**
   * Transform theme object
   * @param {Object} themeConfig - Theme configuration
   * @returns {Object} Transformed theme
   */
  transformThemeObject(themeConfig) {
    const transformed = {
      name: themeConfig.name || 'custom',
      colors: {},
      styles: {}
    };

    // Map old color names to new ones
    const colorMappings = {
      primaryColor: 'primary',
      secondaryColor: 'secondary',
      accentColor: 'accent',
      backgroundColor: 'background',
      textColor: 'foreground',
      borderColor: 'border'
    };

    for (const [oldName, newName] of Object.entries(colorMappings)) {
      if (themeConfig[oldName]) {
        transformed.colors[newName] = themeConfig[oldName];
      }
    }

    // Transform styles
    if (themeConfig.styles) {
      transformed.styles = themeConfig.styles;
    }

    return transformed;
  }

  /**
   * Generate manual migration steps
   * @param {Object} legacyConfig - Legacy configuration
   * @param {Object} migratedConfig - Migrated configuration
   * @returns {Array} Manual migration steps
   */
  generateManualSteps(legacyConfig, migratedConfig) {
    const steps = [];

    // Check for unsupported features
    if (legacyConfig.customScripts) {
      steps.push({
        description: 'Custom scripts migration',
        action: 'Custom scripts are no longer supported. Consider converting to plugins.',
        oldFormat: legacyConfig.customScripts,
        newFormat: 'Create custom plugins instead'
      });
    }

    if (legacyConfig.externalAPIs) {
      steps.push({
        description: 'External API configuration',
        action: 'External API configurations should be moved to individual plugin options',
        oldFormat: legacyConfig.externalAPIs,
        newFormat: 'Configure APIs in plugin options'
      });
    }

    if (legacyConfig.customTheme && typeof legacyConfig.customTheme === 'object') {
      const hasComplexTheme = legacyConfig.customTheme.animations || 
                             legacyConfig.customTheme.customCSS ||
                             legacyConfig.customTheme.fonts;
      
      if (hasComplexTheme) {
        steps.push({
          description: 'Complex theme migration',
          action: 'Advanced theme features need manual conversion',
          oldFormat: legacyConfig.customTheme,
          newFormat: 'See theme documentation for new format'
        });
      }
    }

    return steps;
  }

  /**
   * Rollback migration
   * @param {string} configPath - Path to current configuration
   * @param {string} backupPath - Path to backup configuration
   * @returns {Promise<Object>} Rollback result
   */
  async rollback(configPath, backupPath) {
    this.logger.info(`Rolling back configuration: ${backupPath} -> ${configPath}`);

    try {
      // Check if backup exists
      const backupExists = await this.fileExists(backupPath);
      if (!backupExists) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Restore from backup
      await fs.copyFile(backupPath, configPath);
      
      this.logger.info('Configuration rollback completed successfully');
      
      return {
        success: true,
        message: 'Configuration restored from backup'
      };

    } catch (error) {
      this.logger.error('Configuration rollback failed:', error);
      
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Validate migration result
   * @param {Object} migratedConfig - Migrated configuration
   * @returns {Promise<Object>} Validation result
   */
  async validateMigration(migratedConfig) {
    return await this.validator.validate(migratedConfig);
  }

  /**
   * Set nested property using dot notation
   * @param {Object} obj - Target object
   * @param {string} path - Property path (e.g., 'layout.grid.rows')
   * @param {*} value - Value to set
   */
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get migration progress report
   * @param {Object} legacyConfig - Legacy configuration
   * @param {Object} migrationResult - Migration result
   * @returns {Object} Progress report
   */
  generateProgressReport(legacyConfig, migrationResult) {
    const report = {
      totalItems: 0,
      migratedItems: 0,
      skippedItems: 0,
      errorItems: 0,
      details: []
    };

    // Count legacy items
    if (legacyConfig.widgets) {
      report.totalItems += legacyConfig.widgets.length;
    }

    // Count migrated items
    if (migrationResult.migratedConfig?.plugins) {
      report.migratedItems += migrationResult.migratedConfig.plugins.length;
    }

    // Count errors and warnings
    report.errorItems = migrationResult.errors?.length || 0;
    report.skippedItems = report.totalItems - report.migratedItems - report.errorItems;

    // Add details
    report.details = [
      ...migrationResult.warnings?.map(w => ({ type: 'warning', message: w.message })) || [],
      ...migrationResult.errors?.map(e => ({ type: 'error', message: e.message })) || [],
      ...migrationResult.manualSteps?.map(s => ({ type: 'manual', message: s.description })) || []
    ];

    return report;
  }
}