/**
 * @fileoverview Logging utility for Orbiton Dashboard
 * 
 * Provides consistent logging across the application with different
 * log levels and formatting for better debugging and monitoring.
 */

import chalk from 'chalk';

/**
 * Logger class for consistent application logging
 */
export class Logger {
  constructor(context = 'orbiton') {
    this.context = context;
    this.level = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Set the logging level
   * @param {string} level - The log level (error, warn, info, debug)
   */
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    }
  }

  /**
   * Check if a log level should be output
   * @param {string} level - The log level to check
   * @returns {boolean} Whether the level should be logged
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /**
   * Format log message with timestamp and context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   * @returns {string} Formatted log message
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = this.context ? `[${this.context}]` : '';
    
    return `${chalk.gray(timestamp)} ${this.colorizeLevel(levelStr)} ${chalk.cyan(contextStr)} ${message}`;
  }

  /**
   * Colorize log level for better visibility
   * @param {string} level - Log level string
   * @returns {string} Colorized level string
   */
  colorizeLevel(level) {
    const colors = {
      'ERROR': chalk.red,
      'WARN ': chalk.yellow,
      'INFO ': chalk.blue,
      'DEBUG': chalk.gray
    };
    
    return colors[level] ? colors[level](level) : level;
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments
   */
  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {...any} args - Additional arguments
   */
  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments
   */
  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * Create a child logger with additional context
   * @param {string} childContext - Additional context for child logger
   * @returns {Logger} New logger instance with combined context
   */
  child(childContext) {
    const combinedContext = this.context ? `${this.context}:${childContext}` : childContext;
    const childLogger = new Logger(combinedContext);
    childLogger.setLevel(this.level);
    return childLogger;
  }

  /**
   * Log performance timing
   * @param {string} operation - Operation name
   * @param {number} startTime - Start time in milliseconds
   */
  timing(operation, startTime) {
    const duration = Date.now() - startTime;
    const color = duration > 1000 ? chalk.red : duration > 500 ? chalk.yellow : chalk.green;
    this.debug(`${operation} completed in ${color(`${duration}ms`)}`);
  }

  /**
   * Log plugin-specific messages
   * @param {string} pluginName - Plugin name
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  plugin(pluginName, level, message, ...args) {
    const pluginLogger = this.child(`plugin:${pluginName}`);
    pluginLogger[level](message, ...args);
  }
}