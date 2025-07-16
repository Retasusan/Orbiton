/**
 * Configuration Validator - Validates Orbiton configuration files
 * 
 * This class provides comprehensive validation for Orbiton configurations,
 * including schema validation, plugin validation, and helpful error messages.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs/promises';
import path from 'path';

export class ConfigValidator {
  constructor(options = {}) {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });
    
    // Add format validators
    addFormats(this.ajv);
    
    this.logger = options.logger || console;
    this.configSchema = null;
    this.pluginSchemas = new Map();
    
    // Load schemas
    this.schemasLoaded = this.loadSchemas();
  }

  /**
   * Load validation schemas
   */
  async loadSchemas() {
    try {
      // Load main configuration schema
      const configSchemaPath = path.join(process.cwd(), 'lib/schemas/config.json');
      const configSchemaContent = await fs.readFile(configSchemaPath, 'utf8');
      this.configSchema = JSON.parse(configSchemaContent);
      
      // Compile schema
      this.validateConfig = this.ajv.compile(this.configSchema);
      
    } catch (error) {
      this.logger.warn('Could not load configuration schema:', error.message);
      
      // Fallback to basic schema
      this.configSchema = this.getBasicSchema();
      this.validateConfig = this.ajv.compile(this.configSchema);
    }
  }

  /**
   * Get basic fallback schema
   * @returns {Object} Basic configuration schema
   */
  getBasicSchema() {
    return {
      type: 'object',
      properties: {
        autoDetect: { type: 'boolean' },
        layout: {
          type: 'object',
          properties: {
            preset: { type: 'string' },
            custom: { type: 'boolean' },
            grid: {
              type: 'object',
              properties: {
                rows: { type: 'number', minimum: 1 },
                cols: { type: 'number', minimum: 1 }
              }
            }
          }
        },
        plugins: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              enabled: { type: 'boolean' },
              position: {
                type: 'array',
                items: { type: 'number' },
                minItems: 4,
                maxItems: 4
              },
              options: { type: 'object' }
            },
            required: ['name']
          }
        },
        theme: {
          oneOf: [
            { type: 'string' },
            { type: 'object' }
          ]
        },
        performance: {
          type: 'object',
          properties: {
            updateInterval: { type: 'number', minimum: 1000 },
            maxConcurrentUpdates: { type: 'number', minimum: 1 }
          }
        }
      }
    };
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Promise<Object>} Validation result
   */
  async validate(config) {
    await this.schemasLoaded;
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic type check
      if (!config || typeof config !== 'object') {
        result.isValid = false;
        result.errors.push({
          message: 'Configuration must be an object',
          path: '',
          value: config,
          suggestion: 'Provide a valid configuration object'
        });
        return result;
      }

      // Schema validation
      const schemaValid = this.validateConfig(config);
      
      if (!schemaValid) {
        result.isValid = false;
        
        // Process AJV errors
        for (const error of this.validateConfig.errors || []) {
          result.errors.push({
            message: this.formatAjvError(error),
            path: error.instancePath || error.dataPath,
            value: error.data,
            suggestion: this.getErrorSuggestion(error)
          });
        }
      }

      // Plugin-specific validation
      if (config.plugins && Array.isArray(config.plugins)) {
        const pluginValidation = await this.validatePlugins(config.plugins);
        result.errors.push(...pluginValidation.errors);
        result.warnings.push(...pluginValidation.warnings);
        
        if (pluginValidation.errors.length > 0) {
          result.isValid = false;
        }
      }

      // Layout validation
      if (config.layout) {
        const layoutValidation = this.validateLayout(config.layout);
        result.errors.push(...layoutValidation.errors);
        result.warnings.push(...layoutValidation.warnings);
        
        if (layoutValidation.errors.length > 0) {
          result.isValid = false;
        }
      }

      // Theme validation
      if (config.theme) {
        const themeValidation = this.validateTheme(config.theme);
        result.warnings.push(...themeValidation.warnings);
      }

      // Performance validation
      if (config.performance) {
        const perfValidation = this.validatePerformance(config.performance);
        result.warnings.push(...perfValidation.warnings);
      }

      // Generate general warnings
      const generalWarnings = this.generateWarnings(config);
      result.warnings.push(...generalWarnings);

    } catch (error) {
      result.isValid = false;
      result.errors.push({
        message: `Validation error: ${error.message}`,
        path: '',
        value: null,
        suggestion: 'Check configuration format and try again'
      });
    }

    return result;
  }

  /**
   * Validate plugins configuration
   * @param {Array} plugins - Plugins array
   * @returns {Promise<Object>} Validation result
   */
  async validatePlugins(plugins) {
    const result = {
      errors: [],
      warnings: []
    };

    const pluginNames = new Set();
    const positions = new Set();

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      const pluginPath = `plugins[${i}]`;

      // Check required fields
      if (!plugin.name) {
        result.errors.push({
          message: 'Plugin name is required',
          path: `${pluginPath}.name`,
          value: plugin.name,
          suggestion: 'Provide a valid plugin name'
        });
        continue;
      }

      // Check for duplicate names
      if (pluginNames.has(plugin.name)) {
        result.warnings.push({
          message: `Duplicate plugin name: ${plugin.name}`,
          path: `${pluginPath}.name`,
          value: plugin.name,
          suggestion: 'Use unique names for each plugin instance'
        });
      }
      pluginNames.add(plugin.name);

      // Validate position
      if (plugin.position) {
        const positionValidation = this.validatePosition(plugin.position, pluginPath);
        result.errors.push(...positionValidation.errors);
        result.warnings.push(...positionValidation.warnings);

        // Check for overlapping positions
        const positionKey = plugin.position.join(',');
        if (positions.has(positionKey)) {
          result.warnings.push({
            message: `Overlapping plugin positions detected`,
            path: `${pluginPath}.position`,
            value: plugin.position,
            suggestion: 'Ensure plugins do not overlap in the grid'
          });
        }
        positions.add(positionKey);
      }

      // Validate plugin options
      if (plugin.options) {
        const optionsValidation = await this.validatePluginOptions(plugin.name, plugin.options, pluginPath);
        result.errors.push(...optionsValidation.errors);
        result.warnings.push(...optionsValidation.warnings);
      }

      // Validate update interval
      if (plugin.updateInterval !== undefined) {
        if (typeof plugin.updateInterval !== 'number' || plugin.updateInterval < 1000) {
          result.warnings.push({
            message: 'Update interval should be at least 1000ms',
            path: `${pluginPath}.updateInterval`,
            value: plugin.updateInterval,
            suggestion: 'Use intervals of 1000ms or higher for better performance'
          });
        }
      }
    }

    return result;
  }

  /**
   * Validate plugin position
   * @param {Array} position - Position array [row, col, rowSpan, colSpan]
   * @param {string} path - Field path for errors
   * @returns {Object} Validation result
   */
  validatePosition(position, path) {
    const result = {
      errors: [],
      warnings: []
    };

    if (!Array.isArray(position)) {
      result.errors.push({
        message: 'Position must be an array',
        path: `${path}.position`,
        value: position,
        suggestion: 'Use format [row, col, rowSpan, colSpan]'
      });
      return result;
    }

    if (position.length !== 4) {
      result.errors.push({
        message: 'Position must have exactly 4 elements',
        path: `${path}.position`,
        value: position,
        suggestion: 'Use format [row, col, rowSpan, colSpan]'
      });
      return result;
    }

    const [row, col, rowSpan, colSpan] = position;

    // Validate each component
    if (!Number.isInteger(row) || row < 0) {
      result.errors.push({
        message: 'Row must be a non-negative integer',
        path: `${path}.position[0]`,
        value: row,
        suggestion: 'Use 0 or positive integer for row'
      });
    }

    if (!Number.isInteger(col) || col < 0) {
      result.errors.push({
        message: 'Column must be a non-negative integer',
        path: `${path}.position[1]`,
        value: col,
        suggestion: 'Use 0 or positive integer for column'
      });
    }

    if (!Number.isInteger(rowSpan) || rowSpan < 1) {
      result.errors.push({
        message: 'Row span must be a positive integer',
        path: `${path}.position[2]`,
        value: rowSpan,
        suggestion: 'Use positive integer for row span'
      });
    }

    if (!Number.isInteger(colSpan) || colSpan < 1) {
      result.errors.push({
        message: 'Column span must be a positive integer',
        path: `${path}.position[3]`,
        value: colSpan,
        suggestion: 'Use positive integer for column span'
      });
    }

    // Check for reasonable bounds
    if (rowSpan > 10) {
      result.warnings.push({
        message: 'Large row span may cause layout issues',
        path: `${path}.position[2]`,
        value: rowSpan,
        suggestion: 'Consider using smaller row span'
      });
    }

    if (colSpan > 10) {
      result.warnings.push({
        message: 'Large column span may cause layout issues',
        path: `${path}.position[3]`,
        value: colSpan,
        suggestion: 'Consider using smaller column span'
      });
    }

    return result;
  }

  /**
   * Validate plugin options against plugin schema
   * @param {string} pluginName - Name of the plugin
   * @param {Object} options - Plugin options
   * @param {string} path - Field path for errors
   * @returns {Promise<Object>} Validation result
   */
  async validatePluginOptions(pluginName, options, path) {
    const result = {
      errors: [],
      warnings: []
    };

    try {
      // Try to load plugin schema
      const pluginSchema = await this.getPluginSchema(pluginName);
      
      if (pluginSchema && pluginSchema.optionsSchema) {
        const validator = this.ajv.compile(pluginSchema.optionsSchema);
        const valid = validator(options);
        
        if (!valid) {
          for (const error of validator.errors || []) {
            result.errors.push({
              message: `Plugin ${pluginName}: ${this.formatAjvError(error)}`,
              path: `${path}.options${error.instancePath || error.dataPath}`,
              value: error.data,
              suggestion: this.getPluginErrorSuggestion(pluginName, error)
            });
          }
        }
      }
    } catch (error) {
      // Plugin schema not found or invalid - just warn
      result.warnings.push({
        message: `Could not validate options for plugin ${pluginName}`,
        path: `${path}.options`,
        value: options,
        suggestion: 'Check plugin documentation for valid options'
      });
    }

    return result;
  }

  /**
   * Get plugin schema
   * @param {string} pluginName - Name of the plugin
   * @returns {Promise<Object>} Plugin schema
   */
  async getPluginSchema(pluginName) {
    if (this.pluginSchemas.has(pluginName)) {
      return this.pluginSchemas.get(pluginName);
    }

    try {
      // Try to load from built-in plugins
      const pluginJsonPath = path.join(process.cwd(), 'plugins', pluginName, 'plugin.json');
      const schemaContent = await fs.readFile(pluginJsonPath, 'utf8');
      const schema = JSON.parse(schemaContent);
      
      this.pluginSchemas.set(pluginName, schema);
      return schema;
    } catch {
      // Plugin schema not found
      return null;
    }
  }

  /**
   * Validate layout configuration
   * @param {Object} layout - Layout configuration
   * @returns {Object} Validation result
   */
  validateLayout(layout) {
    const result = {
      errors: [],
      warnings: []
    };

    if (layout.grid) {
      const { rows, cols } = layout.grid;
      
      if (rows && (typeof rows !== 'number' || rows < 1 || rows > 20)) {
        result.errors.push({
          message: 'Grid rows must be between 1 and 20',
          path: 'layout.grid.rows',
          value: rows,
          suggestion: 'Use a reasonable number of rows (1-20)'
        });
      }
      
      if (cols && (typeof cols !== 'number' || cols < 1 || cols > 20)) {
        result.errors.push({
          message: 'Grid columns must be between 1 and 20',
          path: 'layout.grid.cols',
          value: cols,
          suggestion: 'Use a reasonable number of columns (1-20)'
        });
      }
    }

    if (layout.preset && typeof layout.preset !== 'string') {
      result.errors.push({
        message: 'Layout preset must be a string',
        path: 'layout.preset',
        value: layout.preset,
        suggestion: 'Use a valid preset name like "developer" or "ops"'
      });
    }

    return result;
  }

  /**
   * Validate theme configuration
   * @param {*} theme - Theme configuration
   * @returns {Object} Validation result
   */
  validateTheme(theme) {
    const result = {
      warnings: []
    };

    if (typeof theme === 'object' && theme !== null) {
      if (theme.colors) {
        // Validate color values
        for (const [colorName, colorValue] of Object.entries(theme.colors)) {
          if (typeof colorValue !== 'string') {
            result.warnings.push({
              message: `Theme color ${colorName} should be a string`,
              path: `theme.colors.${colorName}`,
              value: colorValue,
              suggestion: 'Use color names or hex values'
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate performance configuration
   * @param {Object} performance - Performance configuration
   * @returns {Object} Validation result
   */
  validatePerformance(performance) {
    const result = {
      warnings: []
    };

    if (performance.updateInterval && performance.updateInterval < 1000) {
      result.warnings.push({
        message: 'Very short update intervals may impact performance',
        path: 'performance.updateInterval',
        value: performance.updateInterval,
        suggestion: 'Consider using intervals of 1000ms or higher'
      });
    }

    if (performance.maxConcurrentUpdates && performance.maxConcurrentUpdates > 10) {
      result.warnings.push({
        message: 'High concurrent update limit may impact performance',
        path: 'performance.maxConcurrentUpdates',
        value: performance.maxConcurrentUpdates,
        suggestion: 'Consider using lower values (3-5) for better performance'
      });
    }

    return result;
  }

  /**
   * Generate general warnings
   * @param {Object} config - Configuration object
   * @returns {Array} Array of warnings
   */
  generateWarnings(config) {
    const warnings = [];

    // Check for performance implications
    if (config.plugins && config.plugins.length > 15) {
      warnings.push({
        message: 'Large number of plugins may impact performance',
        path: 'plugins',
        value: config.plugins.length,
        suggestion: 'Consider disabling unused plugins'
      });
    }

    // Check for very short update intervals
    const shortIntervals = config.plugins?.filter(p => p.updateInterval && p.updateInterval < 2000) || [];
    if (shortIntervals.length > 3) {
      warnings.push({
        message: 'Multiple plugins with short update intervals detected',
        path: 'plugins',
        value: shortIntervals.length,
        suggestion: 'Consider increasing update intervals for better performance'
      });
    }

    return warnings;
  }

  /**
   * Format AJV error message
   * @param {Object} error - AJV error object
   * @returns {string} Formatted error message
   */
  formatAjvError(error) {
    switch (error.keyword) {
      case 'required':
        return `Missing required property: ${error.params.missingProperty}`;
      case 'type':
        return `Expected ${error.params.type}, got ${typeof error.data}`;
      case 'enum':
        return `Value must be one of: ${error.params.allowedValues.join(', ')}`;
      case 'minimum':
        return `Value must be >= ${error.params.limit}`;
      case 'maximum':
        return `Value must be <= ${error.params.limit}`;
      case 'minItems':
        return `Array must have at least ${error.params.limit} items`;
      case 'maxItems':
        return `Array must have at most ${error.params.limit} items`;
      default:
        return error.message || 'Validation error';
    }
  }

  /**
   * Get error suggestion
   * @param {Object} error - AJV error object
   * @returns {string} Error suggestion
   */
  getErrorSuggestion(error) {
    switch (error.keyword) {
      case 'required':
        return `Add the required property: ${error.params.missingProperty}`;
      case 'type':
        return `Change value to ${error.params.type}`;
      case 'enum':
        return `Use one of: ${error.params.allowedValues.join(', ')}`;
      case 'minimum':
        return `Use a value >= ${error.params.limit}`;
      case 'maximum':
        return `Use a value <= ${error.params.limit}`;
      default:
        return 'Check the configuration format';
    }
  }

  /**
   * Get plugin-specific error suggestion
   * @param {string} pluginName - Plugin name
   * @param {Object} error - AJV error object
   * @returns {string} Plugin error suggestion
   */
  getPluginErrorSuggestion(pluginName, error) {
    const baseMessage = this.getErrorSuggestion(error);
    return `${baseMessage}. Check ${pluginName} plugin documentation for details.`;
  }
}