/**
 * Error Recovery Manager - Handles plugin errors and recovery strategies
 * 
 * This class provides comprehensive error handling, plugin isolation,
 * and automatic recovery mechanisms to maintain dashboard stability.
 */

export class ErrorRecoveryManager {
  constructor(options = {}) {
    this.recoveryStrategies = new Map();
    this.errorHistory = new Map();
    this.isolatedPlugins = new Set();
    this.recoveryAttempts = new Map();
    
    // Configuration
    this.maxErrorsPerMinute = options.maxErrorsPerMinute || 5;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors || 3;
    this.isolationTimeout = options.isolationTimeout || 300000; // 5 minutes
    this.maxRecoveryAttempts = options.maxRecoveryAttempts || 3;
    this.recoveryDelay = options.recoveryDelay || 5000; // 5 seconds
    
    // Dependencies
    this.logger = options.logger || console;
    this.performanceMonitor = options.performanceMonitor;
    this.renderScheduler = options.renderScheduler;
    
    // Setup default recovery strategies
    this.setupDefaultStrategies();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldErrors();
    }, 60000); // Every minute
  }

  /**
   * Setup default recovery strategies
   */
  setupDefaultStrategies() {
    // Network error recovery
    this.addRecoveryStrategy('NetworkError', async (plugin, error, context) => {
      this.logger.info(`Attempting network error recovery for ${plugin.name}`);
      
      // Wait before retry
      await this.delay(this.recoveryDelay);
      
      // Reset network-related state
      if (plugin.resetNetworkState) {
        plugin.resetNetworkState();
      }
      
      // Try to re-establish connection
      if (plugin.reconnect) {
        await plugin.reconnect();
      }
      
      return true;
    });

    // Timeout error recovery
    this.addRecoveryStrategy('TimeoutError', async (plugin, error, context) => {
      this.logger.info(`Attempting timeout error recovery for ${plugin.name}`);
      
      // Increase timeout for next request
      if (plugin.increaseTimeout) {
        plugin.increaseTimeout();
      }
      
      // Clear any pending operations
      if (plugin.clearPendingOperations) {
        plugin.clearPendingOperations();
      }
      
      return true;
    });

    // Configuration error recovery
    this.addRecoveryStrategy('ConfigurationError', async (plugin, error, context) => {
      this.logger.info(`Attempting configuration error recovery for ${plugin.name}`);
      
      // Reset to default configuration
      if (plugin.resetToDefaults) {
        plugin.resetToDefaults();
      }
      
      // Validate configuration
      if (plugin.validateConfiguration) {
        const isValid = await plugin.validateConfiguration();
        return isValid;
      }
      
      return false; // Configuration errors usually need manual intervention
    });

    // Memory error recovery
    this.addRecoveryStrategy('MemoryError', async (plugin, error, context) => {
      this.logger.info(`Attempting memory error recovery for ${plugin.name}`);
      
      // Clear caches
      if (plugin.clearCache) {
        plugin.clearCache();
      }
      
      // Garbage collect if possible
      if (global.gc) {
        global.gc();
      }
      
      // Reduce memory footprint
      if (plugin.reduceMemoryFootprint) {
        plugin.reduceMemoryFootprint();
      }
      
      return true;
    });

    // Generic error recovery
    this.addRecoveryStrategy('Error', async (plugin, error, context) => {
      this.logger.info(`Attempting generic error recovery for ${plugin.name}`);
      
      // Reset plugin state
      if (plugin.reset) {
        plugin.reset();
      }
      
      // Re-initialize if needed
      if (plugin.reinitialize) {
        await plugin.reinitialize();
      }
      
      return true;
    });
  }

  /**
   * Add a recovery strategy
   * @param {string} errorType - Type of error to handle
   * @param {Function} strategy - Recovery strategy function
   */
  addRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Handle plugin error
   * @param {Object} plugin - Plugin instance
   * @param {Error} error - Error that occurred
   * @param {Object} context - Additional context
   */
  async handlePluginError(plugin, error, context = {}) {
    const pluginName = plugin.name;
    
    // Log error with context
    this.logger.error(`Plugin ${pluginName} error:`, {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });

    // Track error
    this.trackError(pluginName, error, context);

    // Check if plugin should be isolated
    if (this.shouldIsolatePlugin(pluginName)) {
      await this.isolatePlugin(pluginName, 'Too many errors');
      return;
    }

    // Show error state in plugin
    this.showErrorWidget(plugin, error);

    // Attempt recovery
    await this.attemptRecovery(plugin, error, context);
  }

  /**
   * Track error for a plugin
   * @param {string} pluginName - Name of the plugin
   * @param {Error} error - Error that occurred
   * @param {Object} context - Additional context
   */
  trackError(pluginName, error, context) {
    if (!this.errorHistory.has(pluginName)) {
      this.errorHistory.set(pluginName, []);
    }

    const history = this.errorHistory.get(pluginName);
    const errorEntry = {
      timestamp: Date.now(),
      error: error.message,
      type: error.constructor.name,
      stack: error.stack,
      context,
      recovered: false
    };

    history.push(errorEntry);

    // Keep only recent errors (last 100)
    if (history.length > 100) {
      history.shift();
    }

    // Track with performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.trackError(pluginName, error);
    }
  }

  /**
   * Check if plugin should be isolated
   * @param {string} pluginName - Name of the plugin
   * @returns {boolean} Whether plugin should be isolated
   */
  shouldIsolatePlugin(pluginName) {
    const history = this.errorHistory.get(pluginName);
    if (!history || history.length === 0) {
      return false;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Count recent errors
    const recentErrors = history.filter(entry => entry.timestamp > oneMinuteAgo);
    
    // Count consecutive errors
    const consecutiveErrors = this.getConsecutiveErrors(history);

    // Isolate if too many errors in short time or too many consecutive errors
    return recentErrors.length >= this.maxErrorsPerMinute || 
           consecutiveErrors >= this.maxConsecutiveErrors;
  }

  /**
   * Get consecutive error count
   * @param {Array} history - Error history
   * @returns {number} Number of consecutive errors
   */
  getConsecutiveErrors(history) {
    let consecutiveCount = 0;
    
    // Count from the end until we find a recovered error
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].recovered) {
        break;
      }
      consecutiveCount++;
    }
    
    return consecutiveCount;
  }

  /**
   * Isolate a plugin
   * @param {string} pluginName - Name of the plugin
   * @param {string} reason - Reason for isolation
   */
  async isolatePlugin(pluginName, reason) {
    this.logger.warn(`Isolating plugin ${pluginName}: ${reason}`);
    
    this.isolatedPlugins.add(pluginName);
    
    // Pause plugin in scheduler
    if (this.renderScheduler) {
      this.renderScheduler.pausePlugin(pluginName, `Isolated: ${reason}`);
    }
    
    // Schedule recovery attempt
    setTimeout(() => {
      this.attemptPluginRecovery(pluginName);
    }, this.isolationTimeout);
  }

  /**
   * Attempt plugin recovery from isolation
   * @param {string} pluginName - Name of the plugin
   */
  async attemptPluginRecovery(pluginName) {
    if (!this.isolatedPlugins.has(pluginName)) {
      return; // Already recovered
    }

    const attempts = this.recoveryAttempts.get(pluginName) || 0;
    
    if (attempts >= this.maxRecoveryAttempts) {
      this.logger.error(`Plugin ${pluginName} exceeded maximum recovery attempts`);
      return;
    }

    this.logger.info(`Attempting recovery for isolated plugin ${pluginName} (attempt ${attempts + 1})`);
    
    try {
      // Clear error history
      this.errorHistory.delete(pluginName);
      
      // Remove from isolation
      this.isolatedPlugins.delete(pluginName);
      
      // Resume plugin in scheduler
      if (this.renderScheduler) {
        this.renderScheduler.resumePlugin(pluginName);
      }
      
      // Reset recovery attempts
      this.recoveryAttempts.delete(pluginName);
      
      this.logger.info(`Successfully recovered plugin ${pluginName}`);
      
    } catch (error) {
      this.logger.error(`Failed to recover plugin ${pluginName}:`, error);
      
      // Increment recovery attempts
      this.recoveryAttempts.set(pluginName, attempts + 1);
      
      // Schedule next recovery attempt
      setTimeout(() => {
        this.attemptPluginRecovery(pluginName);
      }, this.isolationTimeout * Math.pow(2, attempts)); // Exponential backoff
    }
  }

  /**
   * Show error widget for plugin
   * @param {Object} plugin - Plugin instance
   * @param {Error} error - Error that occurred
   */
  showErrorWidget(plugin, error) {
    try {
      if (plugin.element && plugin.element.setContent) {
        const errorMessage = this.getErrorSuggestion(error);
        const canRetry = this.canRetry(plugin.name);
        
        const content = `{center}{red-fg}Error{/red-fg}{/center}
{center}{dim}${plugin.name}{/dim}{/center}

{red-fg}${error.message}{/red-fg}

{dim}${errorMessage}{/dim}

${canRetry ? '{center}{dim}Retrying automatically...{/dim}{/center}' : '{center}{dim}Manual intervention required{/dim}{/center}'}`;

        plugin.element.setContent(content);
      }
    } catch (renderError) {
      this.logger.error(`Failed to show error widget for ${plugin.name}:`, renderError);
    }
  }

  /**
   * Get error suggestion message
   * @param {Error} error - Error that occurred
   * @returns {string} Suggestion message
   */
  getErrorSuggestion(error) {
    const suggestions = {
      'ENOTFOUND': 'Check your internet connection',
      'ECONNREFUSED': 'Service may be unavailable',
      'ETIMEDOUT': 'Request timed out, retrying...',
      'EACCES': 'Check file permissions',
      'MODULE_NOT_FOUND': 'Install missing dependencies',
      'NetworkError': 'Network connectivity issue',
      'TimeoutError': 'Request took too long',
      'ConfigurationError': 'Check plugin configuration',
      'ValidationError': 'Invalid data received'
    };

    // Check error code first
    if (error.code && suggestions[error.code]) {
      return suggestions[error.code];
    }

    // Check error type
    const errorType = error.constructor.name;
    if (suggestions[errorType]) {
      return suggestions[errorType];
    }

    // Default suggestion
    return 'An error occurred, attempting recovery...';
  }

  /**
   * Check if plugin can be retried
   * @param {string} pluginName - Name of the plugin
   * @returns {boolean} Whether plugin can be retried
   */
  canRetry(pluginName) {
    const attempts = this.recoveryAttempts.get(pluginName) || 0;
    return attempts < this.maxRecoveryAttempts && !this.isolatedPlugins.has(pluginName);
  }

  /**
   * Attempt error recovery
   * @param {Object} plugin - Plugin instance
   * @param {Error} error - Error that occurred
   * @param {Object} context - Additional context
   */
  async attemptRecovery(plugin, error, context) {
    const errorType = error.constructor.name;
    const strategy = this.recoveryStrategies.get(errorType) || 
                    this.recoveryStrategies.get('Error');

    if (!strategy) {
      this.logger.warn(`No recovery strategy found for error type: ${errorType}`);
      return false;
    }

    try {
      this.logger.info(`Attempting recovery for ${plugin.name} (${errorType})`);
      
      const recovered = await strategy(plugin, error, context);
      
      if (recovered) {
        // Mark recent errors as recovered
        const history = this.errorHistory.get(plugin.name);
        if (history && history.length > 0) {
          history[history.length - 1].recovered = true;
        }
        
        this.logger.info(`Successfully recovered ${plugin.name}`);
        
        // Trigger plugin update to verify recovery
        if (this.renderScheduler) {
          this.renderScheduler.queuePluginUpdate(plugin.name, true);
        }
        
        return true;
      } else {
        this.logger.warn(`Recovery failed for ${plugin.name}`);
        return false;
      }
      
    } catch (recoveryError) {
      this.logger.error(`Recovery attempt failed for ${plugin.name}:`, recoveryError);
      return false;
    }
  }

  /**
   * Get error statistics for a plugin
   * @param {string} pluginName - Name of the plugin
   * @returns {Object} Error statistics
   */
  getPluginErrorStats(pluginName) {
    const history = this.errorHistory.get(pluginName) || [];
    const now = Date.now();
    
    const recentErrors = history.filter(entry => now - entry.timestamp < 3600000); // Last hour
    const consecutiveErrors = this.getConsecutiveErrors(history);
    const recoveredErrors = history.filter(entry => entry.recovered).length;
    
    return {
      totalErrors: history.length,
      recentErrors: recentErrors.length,
      consecutiveErrors,
      recoveredErrors,
      recoveryRate: history.length > 0 ? (recoveredErrors / history.length) * 100 : 0,
      isIsolated: this.isolatedPlugins.has(pluginName),
      recoveryAttempts: this.recoveryAttempts.get(pluginName) || 0,
      lastError: history.length > 0 ? history[history.length - 1] : null
    };
  }

  /**
   * Get system error statistics
   * @returns {Object} System error statistics
   */
  getSystemErrorStats() {
    const stats = {
      totalPluginsWithErrors: this.errorHistory.size,
      isolatedPlugins: this.isolatedPlugins.size,
      totalErrors: 0,
      totalRecoveredErrors: 0,
      errorsByType: new Map(),
      pluginStats: new Map()
    };

    for (const [pluginName, history] of this.errorHistory) {
      const pluginStats = this.getPluginErrorStats(pluginName);
      stats.pluginStats.set(pluginName, pluginStats);
      stats.totalErrors += pluginStats.totalErrors;
      stats.totalRecoveredErrors += pluginStats.recoveredErrors;
      
      // Count errors by type
      for (const entry of history) {
        const count = stats.errorsByType.get(entry.type) || 0;
        stats.errorsByType.set(entry.type, count + 1);
      }
    }

    stats.systemRecoveryRate = stats.totalErrors > 0 ? 
      (stats.totalRecoveredErrors / stats.totalErrors) * 100 : 100;

    return stats;
  }

  /**
   * Clean up old error entries
   */
  cleanupOldErrors() {
    const cutoffTime = Date.now() - 86400000; // 24 hours ago
    
    for (const [pluginName, history] of this.errorHistory) {
      const filteredHistory = history.filter(entry => entry.timestamp > cutoffTime);
      
      if (filteredHistory.length === 0) {
        this.errorHistory.delete(pluginName);
      } else {
        this.errorHistory.set(pluginName, filteredHistory);
      }
    }
  }

  /**
   * Force recovery of an isolated plugin
   * @param {string} pluginName - Name of the plugin
   */
  async forceRecovery(pluginName) {
    if (!this.isolatedPlugins.has(pluginName)) {
      this.logger.info(`Plugin ${pluginName} is not isolated`);
      return false;
    }

    this.logger.info(`Forcing recovery of plugin ${pluginName}`);
    
    // Reset recovery attempts
    this.recoveryAttempts.delete(pluginName);
    
    // Attempt recovery
    await this.attemptPluginRecovery(pluginName);
    
    return !this.isolatedPlugins.has(pluginName);
  }

  /**
   * Reset error history for a plugin
   * @param {string} pluginName - Name of the plugin
   */
  resetPluginErrors(pluginName) {
    this.errorHistory.delete(pluginName);
    this.recoveryAttempts.delete(pluginName);
    
    if (this.isolatedPlugins.has(pluginName)) {
      this.isolatedPlugins.delete(pluginName);
      
      // Resume plugin
      if (this.renderScheduler) {
        this.renderScheduler.resumePlugin(pluginName);
      }
    }
    
    this.logger.info(`Reset error history for plugin ${pluginName}`);
  }

  /**
   * Utility function to delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.recoveryStrategies.clear();
    this.errorHistory.clear();
    this.isolatedPlugins.clear();
    this.recoveryAttempts.clear();
  }
}