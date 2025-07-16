/**
 * @fileoverview Validator utility for JSON schema validation
 * 
 * Provides validation functionality for plugin options and configurations
 * using JSON Schema with helpful error messages and suggestions.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Validator class for JSON schema validation
 */
export class Validator {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false,
      removeAdditional: true,
      useDefaults: true,
      coerceTypes: true
    });
    
    // Add format validators
    addFormats(this.ajv);
    
    // Add custom formats
    this.addCustomFormats();
  }

  /**
   * Add custom format validators
   * @private
   */
  addCustomFormats() {
    // Color format (hex or named colors)
    this.ajv.addFormat('color', {
      type: 'string',
      validate: (value) => {
        return /^#[0-9a-fA-F]{6}$/.test(value) || 
               /^(black|red|green|yellow|blue|magenta|cyan|white|gray|grey)$/.test(value);
      }
    });

    // Duration format (e.g., "5s", "10m", "1h")
    this.ajv.addFormat('duration', {
      type: 'string',
      validate: (value) => {
        return /^\d+[smhd]$/.test(value);
      }
    });

    // Plugin name format
    this.ajv.addFormat('plugin-name', {
      type: 'string',
      validate: (value) => {
        return /^[a-z][a-z0-9-]*$/.test(value);
      }
    });
  }

  /**
   * Validate data against a JSON schema
   * @param {any} data - Data to validate
   * @param {Object} schema - JSON schema
   * @returns {Object} Validation result
   */
  validate(data, schema) {
    try {
      // Compile schema
      const validate = this.ajv.compile(schema);
      
      // Create a copy of data to avoid modifying original
      const dataCopy = JSON.parse(JSON.stringify(data || {}));
      
      // Validate
      const isValid = validate(dataCopy);
      
      if (isValid) {
        return {
          isValid: true,
          data: dataCopy,
          errors: [],
          warnings: []
        };
      } else {
        const errors = this.formatErrors(validate.errors);
        const warnings = this.generateWarnings(dataCopy, schema);
        
        return {
          isValid: false,
          data: dataCopy,
          errors,
          warnings
        };
      }
    } catch (error) {
      return {
        isValid: false,
        data: data,
        errors: [{
          field: 'schema',
          message: `Schema validation error: ${error.message}`,
          suggestion: 'Check schema syntax'
        }],
        warnings: []
      };
    }
  }

  /**
   * Format AJV errors into user-friendly messages
   * @param {Array} ajvErrors - AJV error objects
   * @returns {Array} Formatted error objects
   * @private
   */
  formatErrors(ajvErrors) {
    return ajvErrors.map(error => {
      const field = error.instancePath || error.schemaPath || 'root';
      let message = error.message;
      let suggestion = '';

      // Customize error messages based on keyword
      switch (error.keyword) {
        case 'required':
          message = `Missing required property: ${error.params.missingProperty}`;
          suggestion = `Add the required property '${error.params.missingProperty}'`;
          break;
          
        case 'type':
          message = `Expected ${error.params.type}, got ${typeof error.data}`;
          suggestion = `Convert value to ${error.params.type}`;
          break;
          
        case 'enum':
          message = `Value must be one of: ${error.params.allowedValues.join(', ')}`;
          suggestion = `Use one of the allowed values`;
          break;
          
        case 'minimum':
          message = `Value must be >= ${error.params.limit}`;
          suggestion = `Increase the value to at least ${error.params.limit}`;
          break;
          
        case 'maximum':
          message = `Value must be <= ${error.params.limit}`;
          suggestion = `Decrease the value to at most ${error.params.limit}`;
          break;
          
        case 'minLength':
          message = `String must be at least ${error.params.limit} characters`;
          suggestion = `Add more characters to meet minimum length`;
          break;
          
        case 'maxLength':
          message = `String must be at most ${error.params.limit} characters`;
          suggestion = `Remove characters to meet maximum length`;
          break;
          
        case 'pattern':
          message = `String does not match required pattern`;
          suggestion = `Check the format requirements`;
          break;
          
        case 'format':
          message = `Invalid ${error.params.format} format`;
          suggestion = this.getFormatSuggestion(error.params.format);
          break;
          
        case 'additionalProperties':
          message = `Unknown property: ${error.params.additionalProperty}`;
          suggestion = `Remove the unknown property or check spelling`;
          break;
      }

      return {
        field: field.replace(/^\//, '').replace(/\//g, '.') || 'root',
        message,
        suggestion,
        value: error.data,
        keyword: error.keyword
      };
    });
  }

  /**
   * Get format-specific suggestions
   * @param {string} format - Format name
   * @returns {string} Suggestion text
   * @private
   */
  getFormatSuggestion(format) {
    const suggestions = {
      'email': 'Use format: user@example.com',
      'uri': 'Use format: https://example.com/path',
      'date': 'Use format: YYYY-MM-DD',
      'time': 'Use format: HH:MM:SS',
      'date-time': 'Use format: YYYY-MM-DDTHH:MM:SSZ',
      'color': 'Use hex format (#FF0000) or color name (red)',
      'duration': 'Use format: 5s, 10m, 1h, or 2d',
      'plugin-name': 'Use lowercase letters, numbers, and hyphens only'
    };
    
    return suggestions[format] || `Check ${format} format requirements`;
  }

  /**
   * Generate warnings for potential issues
   * @param {any} data - Validated data
   * @param {Object} schema - JSON schema
   * @returns {Array} Warning objects
   * @private
   */
  generateWarnings(data, schema) {
    const warnings = [];
    
    // Check for deprecated properties
    if (schema.deprecated) {
      warnings.push({
        type: 'deprecated',
        message: 'This configuration option is deprecated',
        suggestion: schema.deprecationMessage || 'Consider updating to newer options'
      });
    }
    
    // Check for performance implications
    if (data.updateInterval && data.updateInterval < 1000) {
      warnings.push({
        type: 'performance',
        message: 'Very short update interval may impact performance',
        suggestion: 'Consider using an interval of at least 1000ms'
      });
    }
    
    // Check for large arrays
    Object.keys(data).forEach(key => {
      if (Array.isArray(data[key]) && data[key].length > 100) {
        warnings.push({
          type: 'performance',
          field: key,
          message: `Large array (${data[key].length} items) may impact performance`,
          suggestion: 'Consider pagination or limiting array size'
        });
      }
    });
    
    return warnings;
  }

  /**
   * Validate plugin configuration
   * @param {Object} config - Plugin configuration
   * @param {Object} pluginSchema - Plugin schema
   * @returns {Object} Validation result
   */
  validatePluginConfig(config, pluginSchema) {
    const schema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          format: 'plugin-name',
          minLength: 2,
          maxLength: 50
        },
        enabled: {
          type: 'boolean',
          default: true
        },
        position: {
          type: 'array',
          items: { type: 'integer', minimum: 0 },
          minItems: 4,
          maxItems: 4
        },
        options: pluginSchema || { type: 'object' },
        updateInterval: {
          type: 'integer',
          minimum: 100,
          default: 5000
        }
      },
      required: ['name'],
      additionalProperties: false
    };
    
    return this.validate(config, schema);
  }

  /**
   * Validate dashboard configuration
   * @param {Object} config - Dashboard configuration
   * @returns {Object} Validation result
   */
  validateDashboardConfig(config) {
    const schema = {
      type: 'object',
      properties: {
        autoDetect: {
          type: 'boolean',
          default: true
        },
        layout: {
          type: 'object',
          properties: {
            preset: {
              type: 'string',
              enum: ['developer', 'server', 'minimal', 'monitoring'],
              default: 'developer'
            },
            custom: {
              type: 'boolean',
              default: false
            },
            grid: {
              type: 'object',
              properties: {
                rows: { type: 'integer', minimum: 1, maximum: 24, default: 12 },
                cols: { type: 'integer', minimum: 1, maximum: 24, default: 12 }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
        },
        plugins: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', format: 'plugin-name' },
              enabled: { type: 'boolean', default: true },
              position: {
                type: 'array',
                items: { type: 'integer', minimum: 0 },
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
            {
              type: 'object',
              properties: {
                name: { type: 'string' },
                colors: {
                  type: 'object',
                  patternProperties: {
                    '^[a-zA-Z][a-zA-Z0-9_]*$': { type: 'string', format: 'color' }
                  }
                },
                styles: { type: 'object' }
              }
            }
          ]
        },
        performance: {
          type: 'object',
          properties: {
            updateInterval: { type: 'integer', minimum: 100, default: 5000 },
            maxConcurrentUpdates: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
            maxMemoryUsage: { type: 'integer', minimum: 1048576, default: 104857600 }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    };
    
    return this.validate(config, schema);
  }

  /**
   * Create a validation summary
   * @param {Object} result - Validation result
   * @returns {string} Human-readable summary
   */
  createSummary(result) {
    if (result.isValid) {
      let summary = '✅ Validation passed';
      if (result.warnings.length > 0) {
        summary += ` with ${result.warnings.length} warning(s)`;
      }
      return summary;
    } else {
      return `❌ Validation failed with ${result.errors.length} error(s)`;
    }
  }

  /**
   * Format validation result for display
   * @param {Object} result - Validation result
   * @returns {string} Formatted result
   */
  formatResult(result) {
    let output = this.createSummary(result) + '\n';
    
    if (result.errors.length > 0) {
      output += '\nErrors:\n';
      result.errors.forEach((error, index) => {
        output += `  ${index + 1}. ${error.field}: ${error.message}\n`;
        if (error.suggestion) {
          output += `     💡 ${error.suggestion}\n`;
        }
      });
    }
    
    if (result.warnings.length > 0) {
      output += '\nWarnings:\n';
      result.warnings.forEach((warning, index) => {
        output += `  ${index + 1}. ${warning.field || 'general'}: ${warning.message}\n`;
        if (warning.suggestion) {
          output += `     💡 ${warning.suggestion}\n`;
        }
      });
    }
    
    return output;
  }
}