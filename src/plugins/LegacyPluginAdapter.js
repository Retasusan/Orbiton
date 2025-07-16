/**
 * Legacy Plugin Adapter - Provides compatibility for old plugin formats
 * 
 * This class wraps legacy plugins to work with the new plugin system,
 * providing deprecation warnings and migration guidance while maintaining
 * backward compatibility during the transition period.
 */

import { BaseWidget } from './BaseWidget.js';
import { DataWidget } from './DataWidget.js';

export class LegacyPluginAdapter extends BaseWidget {
  constructor(name, options = {}, legacyPlugin = null) {
    super(name, options);
    
    this.legacyPlugin = legacyPlugin;
    this.legacyFormat = this.detectLegacyFormat(legacyPlugin);
    this.migrationWarnings = [];
    this.deprecationNotices = [];
    
    // Track usage for migration statistics
    this.usageStats = {
      initializeCalls: 0,
      renderCalls: 0,
      updateCalls: 0,
      errorCount: 0
    };
    
    this.logger = options.logger || console;
    
    // Show deprecation warning
    this.showDeprecationWarning();
  }

  /**
   * Detect legacy plugin format
   * @param {Object} plugin - Legacy plugin instance
   * @returns {string} Legacy format version
   */
  detectLegacyFormat(plugin) {
    if (!plugin) return 'unknown';
    
    // Check for v1 format (class-based with specific methods)
    if (typeof plugin.init === 'function' && typeof plugin.draw === 'function') {
      return 'v1';
    }
    
    // Check for v0 format (object-based configuration)
    if (plugin.config && plugin.render && typeof plugin.render === 'function') {
      return 'v0';
    }
    
    // Check for CommonJS format
    if (plugin.module && plugin.module.exports) {
      return 'commonjs';
    }
    
    return 'unknown';
  }

  /**
   * Show deprecation warning
   */
  showDeprecationWarning() {
    const warning = `
╭─────────────────────────────────────────────────────────────╮
│                    DEPRECATION WARNING                      │
├─────────────────────────────────────────────────────────────┤
│ Plugin "${this.name}" uses legacy format (${this.legacyFormat})                │
│                                                             │
│ Legacy plugins are deprecated and will be removed in v3.0  │
│ Please migrate to the new plugin format.                   │
│                                                             │
│ Migration guide: docs/plugin-migration.md                  │
│ Use: orbiton plugin migrate ${this.name}                        │
╰─────────────────────────────────────────────────────────────╯`;

    this.logger.warn(warning);
    
    this.deprecationNotices.push({
      timestamp: new Date(),
      message: `Legacy plugin format detected: ${this.legacyFormat}`,
      migrationCommand: `orbiton plugin migrate ${this.name}`
    });
  }

  /**
   * Initialize the legacy plugin
   */
  async initialize() {
    this.usageStats.initializeCalls++;
    
    try {
      await super.initialize();
      
      // Initialize legacy plugin based on format
      switch (this.legacyFormat) {
        case 'v1':
          await this.initializeV1Plugin();
          break;
        case 'v0':
          await this.initializeV0Plugin();
          break;
        case 'commonjs':
          await this.initializeCommonJSPlugin();
          break;
        default:
          await this.initializeUnknownPlugin();
      }
      
    } catch (error) {
      this.usageStats.errorCount++;
      this.handleLegacyError('initialize', error);
      throw error;
    }
  }

  /**
   * Initialize v1 format plugin
   */
  async initializeV1Plugin() {
    if (typeof this.legacyPlugin.init === 'function') {
      // Map old options format to new format
      const legacyOptions = this.mapOptionsToLegacyFormat(this.options);
      
      // Call legacy init method
      await this.legacyPlugin.init(legacyOptions);
      
      this.migrationWarnings.push({
        method: 'init',
        message: 'Legacy init() method used. Replace with initialize() in new format.',
        newFormat: 'async initialize() { /* setup code */ }'
      });
    }
  }

  /**
   * Initialize v0 format plugin
   */
  async initializeV0Plugin() {
    if (this.legacyPlugin.config) {
      // Apply legacy configuration
      this.legacyConfig = { ...this.legacyPlugin.config, ...this.options };
      
      this.migrationWarnings.push({
        method: 'config',
        message: 'Legacy config object used. Use options parameter in new format.',
        newFormat: 'constructor(name, options) { this.options = options; }'
      });
    }
  }

  /**
   * Initialize CommonJS format plugin
   */
  async initializeCommonJSPlugin() {
    if (this.legacyPlugin.module && this.legacyPlugin.module.exports) {
      const PluginClass = this.legacyPlugin.module.exports;
      
      if (typeof PluginClass === 'function') {
        this.legacyInstance = new PluginClass(this.options);
        
        if (typeof this.legacyInstance.initialize === 'function') {
          await this.legacyInstance.initialize();
        }
      }
      
      this.migrationWarnings.push({
        method: 'module.exports',
        message: 'CommonJS exports used. Use ES6 export default in new format.',
        newFormat: 'export default class MyPlugin extends BaseWidget { }'
      });
    }
  }

  /**
   * Initialize unknown format plugin
   */
  async initializeUnknownPlugin() {
    this.logger.warn(`Unknown legacy plugin format for ${this.name}`);
    
    // Try to find common initialization patterns
    const initMethods = ['init', 'initialize', 'setup', 'start'];
    
    for (const method of initMethods) {
      if (typeof this.legacyPlugin[method] === 'function') {
        try {
          await this.legacyPlugin[method](this.options);
          this.migrationWarnings.push({
            method,
            message: `Legacy ${method}() method detected. Standardize to initialize().`,
            newFormat: 'async initialize() { /* setup code */ }'
          });
          break;
        } catch (error) {
          this.logger.warn(`Failed to call legacy ${method}():`, error.message);
        }
      }
    }
  }

  /**
   * Render the legacy plugin
   */
  async render() {
    this.usageStats.renderCalls++;
    
    try {
      // Call appropriate render method based on format
      switch (this.legacyFormat) {
        case 'v1':
          await this.renderV1Plugin();
          break;
        case 'v0':
          await this.renderV0Plugin();
          break;
        case 'commonjs':
          await this.renderCommonJSPlugin();
          break;
        default:
          await this.renderUnknownPlugin();
      }
      
    } catch (error) {
      this.usageStats.errorCount++;
      this.handleLegacyError('render', error);
      
      // Show error in widget instead of crashing
      this.renderErrorState(error);
    }
  }

  /**
   * Render v1 format plugin
   */
  async renderV1Plugin() {
    if (typeof this.legacyPlugin.draw === 'function') {
      // Create legacy-compatible element wrapper
      const legacyElement = this.createLegacyElementWrapper();
      
      // Call legacy draw method
      await this.legacyPlugin.draw(legacyElement);
      
      this.migrationWarnings.push({
        method: 'draw',
        message: 'Legacy draw() method used. Replace with render() in new format.',
        newFormat: 'async render() { this.element.setContent(content); }'
      });
    }
  }

  /**
   * Render v0 format plugin
   */
  async renderV0Plugin() {
    if (typeof this.legacyPlugin.render === 'function') {
      // Call legacy render with configuration
      const content = await this.legacyPlugin.render(this.legacyConfig);
      
      if (typeof content === 'string' && this.element) {
        this.element.setContent(content);
      }
      
      this.migrationWarnings.push({
        method: 'render',
        message: 'Legacy render() with config parameter. Use this.options in new format.',
        newFormat: 'async render() { /* use this.options instead of config parameter */ }'
      });
    }
  }

  /**
   * Render CommonJS format plugin
   */
  async renderCommonJSPlugin() {
    if (this.legacyInstance && typeof this.legacyInstance.render === 'function') {
      await this.legacyInstance.render();
      
      // Try to get rendered content
      if (this.legacyInstance.element && this.element) {
        // Copy content from legacy element to new element
        this.copyElementContent(this.legacyInstance.element, this.element);
      }
    }
  }

  /**
   * Render unknown format plugin
   */
  async renderUnknownPlugin() {
    // Try common render method names
    const renderMethods = ['render', 'draw', 'display', 'show', 'paint'];
    
    for (const method of renderMethods) {
      if (typeof this.legacyPlugin[method] === 'function') {
        try {
          const result = await this.legacyPlugin[method](this.element || this.createLegacyElementWrapper());
          
          if (typeof result === 'string' && this.element) {
            this.element.setContent(result);
          }
          
          this.migrationWarnings.push({
            method,
            message: `Legacy ${method}() method detected. Standardize to render().`,
            newFormat: 'async render() { this.element.setContent(content); }'
          });
          
          return;
        } catch (error) {
          this.logger.warn(`Failed to call legacy ${method}():`, error.message);
        }
      }
    }
    
    // Fallback: show migration notice
    this.renderMigrationNotice();
  }

  /**
   * Update the legacy plugin
   */
  async update() {
    this.usageStats.updateCalls++;
    
    try {
      // Try legacy update methods
      const updateMethods = ['update', 'refresh', 'reload'];
      
      for (const method of updateMethods) {
        if (typeof this.legacyPlugin[method] === 'function') {
          await this.legacyPlugin[method]();
          
          this.migrationWarnings.push({
            method,
            message: `Legacy ${method}() method used. Standardize to update().`,
            newFormat: 'async update() { /* update logic */ await this.render(); }'
          });
          
          break;
        }
      }
      
      // Always call render after update
      await this.render();
      
    } catch (error) {
      this.usageStats.errorCount++;
      this.handleLegacyError('update', error);
    }
  }

  /**
   * Destroy the legacy plugin
   */
  async destroy() {
    try {
      // Try legacy cleanup methods
      const cleanupMethods = ['destroy', 'cleanup', 'dispose', 'close', 'stop'];
      
      for (const method of cleanupMethods) {
        if (typeof this.legacyPlugin[method] === 'function') {
          await this.legacyPlugin[method]();
          break;
        }
      }
      
      // Clean up legacy instance
      if (this.legacyInstance && typeof this.legacyInstance.destroy === 'function') {
        await this.legacyInstance.destroy();
      }
      
    } catch (error) {
      this.logger.warn(`Legacy plugin cleanup error:`, error.message);
    } finally {
      await super.destroy();
    }
  }

  /**
   * Map new options format to legacy format
   * @param {Object} options - New format options
   * @returns {Object} Legacy format options
   */
  mapOptionsToLegacyFormat(options) {
    const legacyOptions = { ...options };
    
    // Common mappings
    if (options.updateInterval) {
      legacyOptions.refreshInterval = options.updateInterval;
    }
    
    if (options.title) {
      legacyOptions.label = options.title;
    }
    
    return legacyOptions;
  }

  /**
   * Create legacy-compatible element wrapper
   * @returns {Object} Legacy element wrapper
   */
  createLegacyElementWrapper() {
    const self = this;
    
    return {
      // Legacy methods that map to new element
      setText: (text) => {
        if (self.element && self.element.setContent) {
          self.element.setContent(text);
        }
      },
      
      setContent: (content) => {
        if (self.element && self.element.setContent) {
          self.element.setContent(content);
        }
      },
      
      // Legacy properties
      get width() {
        return self.element ? self.element.width : 0;
      },
      
      get height() {
        return self.element ? self.element.height : 0;
      },
      
      // Deprecated method warnings
      draw: (content) => {
        self.migrationWarnings.push({
          method: 'element.draw',
          message: 'Legacy element.draw() used. Use element.setContent().',
          newFormat: 'this.element.setContent(content);'
        });
        
        if (self.element && self.element.setContent) {
          self.element.setContent(content);
        }
      }
    };
  }

  /**
   * Copy content from legacy element to new element
   * @param {Object} legacyElement - Legacy element
   * @param {Object} newElement - New element
   */
  copyElementContent(legacyElement, newElement) {
    try {
      if (legacyElement.content && newElement.setContent) {
        newElement.setContent(legacyElement.content);
      } else if (legacyElement.text && newElement.setContent) {
        newElement.setContent(legacyElement.text);
      }
    } catch (error) {
      this.logger.warn('Failed to copy legacy element content:', error.message);
    }
  }

  /**
   * Handle legacy plugin errors
   * @param {string} method - Method that failed
   * @param {Error} error - Error that occurred
   */
  handleLegacyError(method, error) {
    this.logger.error(`Legacy plugin ${this.name} ${method} error:`, error.message);
    
    // Add to migration warnings
    this.migrationWarnings.push({
      method,
      message: `Error in legacy ${method}(): ${error.message}`,
      newFormat: 'Add proper error handling in new format'
    });
  }

  /**
   * Render error state
   * @param {Error} error - Error that occurred
   */
  renderErrorState(error) {
    if (!this.element || !this.element.setContent) return;
    
    const content = `{center}{red-fg}Legacy Plugin Error{/red-fg}{/center}
{center}{dim}${this.name} (${this.legacyFormat}){/dim}{/center}

{red-fg}${error.message}{/red-fg}

{dim}This plugin uses a legacy format.{/dim}
{dim}Consider migrating to the new format.{/dim}

{center}{dim}Migration: orbiton plugin migrate ${this.name}{/dim}{/center}`;

    this.element.setContent(content);
  }

  /**
   * Render migration notice
   */
  renderMigrationNotice() {
    if (!this.element || !this.element.setContent) return;
    
    const content = `{center}{yellow-fg}Migration Required{/yellow-fg}{/center}
{center}{dim}${this.name}{/dim}{/center}

{dim}This plugin uses a legacy format{/dim}
{dim}that is no longer supported.{/dim}

{center}{bold}Please migrate to new format{/bold}{/center}

{center}{dim}Command: orbiton plugin migrate ${this.name}{/dim}{/center}
{center}{dim}Guide: docs/plugin-migration.md{/dim}{/center}`;

    this.element.setContent(content);
  }

  /**
   * Get configuration schema (legacy compatibility)
   * @returns {Object} Configuration schema
   */
  getOptionsSchema() {
    // Try to get schema from legacy plugin
    if (this.legacyPlugin && typeof this.legacyPlugin.getSchema === 'function') {
      try {
        const legacySchema = this.legacyPlugin.getSchema();
        return this.convertLegacySchema(legacySchema);
      } catch (error) {
        this.logger.warn('Failed to get legacy schema:', error.message);
      }
    }
    
    // Return basic schema
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: this.name
        }
      }
    };
  }

  /**
   * Convert legacy schema to new format
   * @param {Object} legacySchema - Legacy schema
   * @returns {Object} New format schema
   */
  convertLegacySchema(legacySchema) {
    // Basic conversion - this would need to be more sophisticated
    // based on the actual legacy schema formats
    const converted = {
      type: 'object',
      properties: {}
    };
    
    if (legacySchema.options) {
      converted.properties = legacySchema.options;
    } else if (legacySchema.properties) {
      converted.properties = legacySchema.properties;
    }
    
    return converted;
  }

  /**
   * Get migration warnings
   * @returns {Array} Array of migration warnings
   */
  getMigrationWarnings() {
    return this.migrationWarnings;
  }

  /**
   * Get deprecation notices
   * @returns {Array} Array of deprecation notices
   */
  getDeprecationNotices() {
    return this.deprecationNotices;
  }

  /**
   * Get usage statistics
   * @returns {Object} Usage statistics
   */
  getUsageStats() {
    return {
      ...this.usageStats,
      migrationWarnings: this.migrationWarnings.length,
      deprecationNotices: this.deprecationNotices.length,
      legacyFormat: this.legacyFormat
    };
  }

  /**
   * Generate migration report
   * @returns {Object} Migration report
   */
  generateMigrationReport() {
    return {
      pluginName: this.name,
      legacyFormat: this.legacyFormat,
      usageStats: this.getUsageStats(),
      migrationWarnings: this.migrationWarnings,
      deprecationNotices: this.deprecationNotices,
      migrationSteps: this.generateMigrationSteps(),
      estimatedEffort: this.estimateMigrationEffort()
    };
  }

  /**
   * Generate migration steps
   * @returns {Array} Migration steps
   */
  generateMigrationSteps() {
    const steps = [];
    
    steps.push({
      step: 1,
      description: 'Create new plugin structure',
      action: 'Create index.js, plugin.json, and test.js files',
      template: 'Use orbiton plugin create command'
    });
    
    steps.push({
      step: 2,
      description: 'Convert to ES6 class format',
      action: 'Extend BaseWidget or DataWidget',
      example: 'export default class MyPlugin extends BaseWidget { }'
    });
    
    // Add specific steps based on detected legacy methods
    const methodMappings = {
      'init': 'initialize',
      'draw': 'render',
      'refresh': 'update'
    };
    
    for (const [oldMethod, newMethod] of Object.entries(methodMappings)) {
      if (this.migrationWarnings.some(w => w.method === oldMethod)) {
        steps.push({
          step: steps.length + 1,
          description: `Convert ${oldMethod}() to ${newMethod}()`,
          action: `Rename method and update signature`,
          example: `async ${newMethod}() { /* converted code */ }`
        });
      }
    }
    
    steps.push({
      step: steps.length + 1,
      description: 'Update configuration handling',
      action: 'Use this.options instead of legacy config patterns',
      example: 'const title = this.options.title || "Default";'
    });
    
    steps.push({
      step: steps.length + 1,
      description: 'Add proper error handling',
      action: 'Wrap async operations in try-catch blocks',
      example: 'try { await operation(); } catch (error) { this.handleError(error); }'
    });
    
    steps.push({
      step: steps.length + 1,
      description: 'Test the migrated plugin',
      action: 'Run tests and verify functionality',
      command: `orbiton plugin test ${this.name}`
    });
    
    return steps;
  }

  /**
   * Estimate migration effort
   * @returns {string} Effort estimate
   */
  estimateMigrationEffort() {
    const warningCount = this.migrationWarnings.length;
    const errorCount = this.usageStats.errorCount;
    
    if (errorCount > 5 || warningCount > 10) {
      return 'High - Complex legacy plugin with many compatibility issues';
    } else if (errorCount > 2 || warningCount > 5) {
      return 'Medium - Some compatibility issues need addressing';
    } else {
      return 'Low - Straightforward migration with minimal changes';
    }
  }
}