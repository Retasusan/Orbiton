/**
 * @fileoverview Error classes for Orbiton Dashboard
 * 
 * Provides custom error types with context and recovery information
 * for better error handling and debugging.
 */

/**
 * Base error class for all Orbiton-specific errors
 */
export class OrbitonError extends Error {
  /**
   * Create an Orbiton error
   * @param {string} message - Error message
   * @param {string} code - Error code for categorization
   * @param {Object} context - Additional context information
   */
  constructor(message, code = 'ORBITON_ERROR', context = {}) {
    super(message);
    this.name = 'OrbitonError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OrbitonError);
    }
  }

  /**
   * Get error details as object
   * @returns {Object} Error details
   */
  toObject() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    return this.message;
  }

  /**
   * Get suggested recovery actions
   * @returns {Array<string>} Recovery suggestions
   */
  getRecoveryActions() {
    return ['Check the error details and try again'];
  }
}

/**
 * Plugin-specific error class
 */
export class PluginError extends OrbitonError {
  /**
   * Create a plugin error
   * @param {string} pluginName - Name of the plugin that caused the error
   * @param {string} message - Error message
   * @param {Error} originalError - Original error that caused this error
   */
  constructor(pluginName, message, originalError = null) {
    const fullMessage = `Plugin "${pluginName}": ${message}`;
    super(fullMessage, 'PLUGIN_ERROR', {
      pluginName,
      originalError: originalError ? {
        message: originalError.message,
        stack: originalError.stack,
        name: originalError.name
      } : null
    });
    
    this.name = 'PluginError';
    this.pluginName = pluginName;
    this.originalError = originalError;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    const baseMessage = `The "${this.pluginName}" plugin encountered an error`;
    
    if (this.originalError) {
      return `${baseMessage}: ${this.originalError.message}`;
    }
    
    return baseMessage;
  }

  /**
   * Get suggested recovery actions
   * @returns {Array<string>} Recovery suggestions
   */
  getRecoveryActions() {
    const actions = [
      `Check the "${this.pluginName}" plugin configuration`,
      'Try restarting the plugin',
      'Check plugin dependencies'
    ];
    
    // Add specific suggestions based on error type
    if (this.originalError) {
      const errorType = this.originalError.name || this.originalError.constructor.name;
      
      switch (errorType) {
        case 'TypeError':
          actions.push('Check plugin options and data types');
          break;
        case 'ReferenceError':
          actions.push('Check for missing dependencies or imports');
          break;
        case 'SyntaxError':
          actions.push('Check plugin code syntax');
          break;
        case 'NetworkError':
        case 'FetchError':
          actions.push('Check network connectivity and API endpoints');
          break;
        case 'ValidationError':
          actions.push('Check plugin configuration against schema');
          break;
      }
    }
    
    return actions;
  }
}

/**
 * Configuration-specific error class
 */
export class ConfigurationError extends OrbitonError {
  /**
   * Create a configuration error
   * @param {string} message - Error message
   * @param {Array} errors - Validation errors
   * @param {string} configPath - Path to configuration file
   */
  constructor(message, errors = [], configPath = null) {
    super(message, 'CONFIG_ERROR', {
      errors,
      configPath,
      errorCount: errors.length
    });
    
    this.name = 'ConfigurationError';
    this.errors = errors;
    this.configPath = configPath;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    if (this.errors.length === 0) {
      return this.message;
    }
    
    const errorSummary = this.errors.slice(0, 3).map(err => 
      `${err.field}: ${err.message}`
    ).join(', ');
    
    let message = `Configuration error: ${errorSummary}`;
    
    if (this.errors.length > 3) {
      message += ` (and ${this.errors.length - 3} more)`;
    }
    
    return message;
  }

  /**
   * Get suggested recovery actions
   * @returns {Array<string>} Recovery suggestions
   */
  getRecoveryActions() {
    const actions = [
      'Check configuration file syntax',
      'Validate configuration against schema'
    ];
    
    if (this.configPath) {
      actions.push(`Edit configuration file: ${this.configPath}`);
    }
    
    // Add specific suggestions based on error types
    const errorTypes = new Set(this.errors.map(err => err.keyword));
    
    if (errorTypes.has('required')) {
      actions.push('Add missing required properties');
    }
    
    if (errorTypes.has('type')) {
      actions.push('Check data types of configuration values');
    }
    
    if (errorTypes.has('enum')) {
      actions.push('Use only allowed values for enum properties');
    }
    
    if (errorTypes.has('format')) {
      actions.push('Check format requirements for string values');
    }
    
    actions.push('Run "orbiton config validate" to check configuration');
    actions.push('Run "orbiton config init" to create a new configuration');
    
    return actions;
  }

  /**
   * Get detailed error information
   * @returns {string} Detailed error information
   */
  getDetailedInfo() {
    if (this.errors.length === 0) {
      return this.message;
    }
    
    let info = `Configuration validation failed with ${this.errors.length} error(s):\n\n`;
    
    this.errors.forEach((error, index) => {
      info += `${index + 1}. Field: ${error.field}\n`;
      info += `   Error: ${error.message}\n`;
      if (error.suggestion) {
        info += `   Suggestion: ${error.suggestion}\n`;
      }
      if (error.value !== undefined) {
        info += `   Current value: ${JSON.stringify(error.value)}\n`;
      }
      info += '\n';
    });
    
    return info;
  }
}

/**
 * Network-related error class
 */
export class NetworkError extends OrbitonError {
  /**
   * Create a network error
   * @param {string} message - Error message
   * @param {string} url - URL that caused the error
   * @param {number} statusCode - HTTP status code (if applicable)
   */
  constructor(message, url = null, statusCode = null) {
    super(message, 'NETWORK_ERROR', {
      url,
      statusCode
    });
    
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    if (this.statusCode) {
      return `Network error (${this.statusCode}): ${this.message}`;
    }
    
    return `Network error: ${this.message}`;
  }

  /**
   * Get suggested recovery actions
   * @returns {Array<string>} Recovery suggestions
   */
  getRecoveryActions() {
    const actions = [
      'Check internet connectivity',
      'Verify the URL is correct'
    ];
    
    if (this.statusCode) {
      switch (Math.floor(this.statusCode / 100)) {
        case 4: // 4xx errors
          actions.push('Check API credentials and permissions');
          actions.push('Verify request parameters');
          break;
        case 5: // 5xx errors
          actions.push('The server is experiencing issues, try again later');
          actions.push('Contact the service provider if the issue persists');
          break;
      }
    }
    
    if (this.url) {
      actions.push(`Check if ${this.url} is accessible`);
    }
    
    actions.push('Try again in a few moments');
    
    return actions;
  }
}

/**
 * File system related error class
 */
export class FileSystemError extends OrbitonError {
  /**
   * Create a file system error
   * @param {string} message - Error message
   * @param {string} path - File path that caused the error
   * @param {string} operation - Operation that failed
   */
  constructor(message, path = null, operation = null) {
    super(message, 'FILESYSTEM_ERROR', {
      path,
      operation
    });
    
    this.name = 'FileSystemError';
    this.path = path;
    this.operation = operation;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    if (this.operation && this.path) {
      return `Failed to ${this.operation} file "${this.path}": ${this.message}`;
    }
    
    return `File system error: ${this.message}`;
  }

  /**
   * Get suggested recovery actions
   * @returns {Array<string>} Recovery suggestions
   */
  getRecoveryActions() {
    const actions = [];
    
    if (this.path) {
      actions.push(`Check if "${this.path}" exists and is accessible`);
      actions.push('Verify file permissions');
    }
    
    actions.push('Check available disk space');
    actions.push('Ensure the directory exists');
    
    if (this.operation === 'write') {
      actions.push('Check write permissions for the directory');
    }
    
    if (this.operation === 'read') {
      actions.push('Check read permissions for the file');
    }
    
    return actions;
  }
}

/**
 * Validation error class
 */
export class ValidationError extends OrbitonError {
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   * @param {any} value - Value that failed validation
   * @param {string} rule - Validation rule that failed
   */
  constructor(message, field = null, value = null, rule = null) {
    super(message, 'VALIDATION_ERROR', {
      field,
      value,
      rule
    });
    
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.rule = rule;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    if (this.field) {
      return `Validation error for "${this.field}": ${this.message}`;
    }
    
    return `Validation error: ${this.message}`;
  }

  /**
   * Get suggested recovery actions
   * @returns {Array<string>} Recovery suggestions
   */
  getRecoveryActions() {
    const actions = [];
    
    if (this.field) {
      actions.push(`Check the value for "${this.field}"`);
    }
    
    if (this.rule) {
      actions.push(`Ensure the value meets the "${this.rule}" requirement`);
    }
    
    actions.push('Check the documentation for valid values');
    actions.push('Use the configuration validator to check your settings');
    
    return actions;
  }
}

/**
 * Create an appropriate error based on the original error
 * @param {Error} originalError - Original error
 * @param {string} context - Context where the error occurred
 * @returns {OrbitonError} Appropriate Orbiton error
 */
export function createError(originalError, context = 'unknown') {
  if (originalError instanceof OrbitonError) {
    return originalError;
  }
  
  // Network errors
  if (originalError.code === 'ENOTFOUND' || 
      originalError.code === 'ECONNREFUSED' ||
      originalError.code === 'ETIMEDOUT') {
    return new NetworkError(originalError.message, originalError.hostname);
  }
  
  // File system errors
  if (originalError.code === 'ENOENT' ||
      originalError.code === 'EACCES' ||
      originalError.code === 'EMFILE') {
    return new FileSystemError(originalError.message, originalError.path, context);
  }
  
  // Validation errors
  if (originalError.name === 'ValidationError') {
    return new ValidationError(originalError.message);
  }
  
  // Default to generic Orbiton error
  return new OrbitonError(originalError.message, 'UNKNOWN_ERROR', {
    originalError: {
      name: originalError.name,
      message: originalError.message,
      stack: originalError.stack
    },
    context
  });
}

/**
 * Format error for display
 * @param {Error} error - Error to format
 * @param {boolean} includeStack - Whether to include stack trace
 * @returns {string} Formatted error message
 */
export function formatError(error, includeStack = false) {
  let output = '';
  
  if (error instanceof OrbitonError) {
    output += `❌ ${error.getUserMessage()}\n`;
    
    const actions = error.getRecoveryActions();
    if (actions.length > 0) {
      output += '\n💡 Suggested actions:\n';
      actions.forEach((action, index) => {
        output += `  ${index + 1}. ${action}\n`;
      });
    }
    
    if (error instanceof ConfigurationError && error.errors.length > 0) {
      output += '\n📋 Detailed errors:\n';
      output += error.getDetailedInfo();
    }
  } else {
    output += `❌ ${error.message}\n`;
  }
  
  if (includeStack && error.stack) {
    output += '\n🔍 Stack trace:\n';
    output += error.stack;
  }
  
  return output;
}
/*
*
 * Dashboard-specific error class
 */
export class DashboardError extends OrbitonError {
  /**
   * Create a dashboard error
   * @param {string} message - Error message
   * @param {Error} originalError - Original error that caused this error
   */
  constructor(message, originalError = null) {
    super(message, 'DASHBOARD_ERROR', {
      originalError: originalError ? {
        message: originalError.message,
        stack: originalError.stack,
        name: originalError.name
      } : null
    });
    
    this.name = 'DashboardError';
    this.originalError = originalError;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    return `Dashboard error: ${this.message}`;
  }

  /**
   * Get suggested recovery actions
   * @returns {Array<string>} Recovery suggestions
   */
  getRecoveryActions() {
    const actions = [
      'Check dashboard configuration',
      'Verify all plugins are properly loaded',
      'Check browser console for additional errors',
      'Try refreshing the dashboard'
    ];
    
    if (this.originalError) {
      const errorType = this.originalError.name || this.originalError.constructor.name;
      
      switch (errorType) {
        case 'PluginError':
          actions.push('Check plugin configurations and dependencies');
          break;
        case 'ConfigurationError':
          actions.push('Validate dashboard configuration file');
          break;
        case 'NetworkError':
          actions.push('Check network connectivity');
          break;
        case 'ValidationError':
          actions.push('Check widget options and layout configuration');
          break;
      }
    }
    
    return actions;
  }
}