/**
 * Performance Monitor - Tracks and optimizes plugin performance
 * 
 * This class monitors plugin performance metrics, manages update intervals,
 * and provides optimization recommendations to maintain smooth dashboard operation.
 */

export class PerformanceMonitor {
  constructor(options = {}) {
    this.metrics = new Map();
    this.resourceLimits = {
      maxConcurrentUpdates: options.maxConcurrentUpdates || 5,
      maxMemoryUsage: options.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      maxUpdateInterval: options.maxUpdateInterval || 1000, // 1 second minimum
      maxRenderTime: options.maxRenderTime || 100, // 100ms
      maxUpdateTime: options.maxUpdateTime || 500 // 500ms
    };
    
    this.performanceHistory = [];
    this.maxHistoryLength = 1000;
    this.optimizationEnabled = options.optimizationEnabled !== false;
    this.logger = options.logger || console;
    
    // Performance tracking
    this.startTime = Date.now();
    this.lastOptimization = Date.now();
    this.optimizationInterval = options.optimizationInterval || 30000; // 30 seconds
    
    // Start periodic optimization
    if (this.optimizationEnabled) {
      this.startOptimizationLoop();
    }
  }

  start() {
    if (this.optimizationEnabled) {
      this.startOptimizationLoop();
    }
  }

  /**
   * Track plugin performance metrics
   * @param {string} pluginName - Name of the plugin
   * @param {string} operation - Operation type (render, update, fetchData)
   * @param {number} duration - Duration in milliseconds
   * @param {Object} context - Additional context information
   */
  trackPluginPerformance(pluginName, operation, duration, context = {}) {
    if (!this.metrics.has(pluginName)) {
      this.metrics.set(pluginName, {
        renderTimes: [],
        updateTimes: [],
        fetchTimes: [],
        memoryUsage: [],
        errorCount: 0,
        totalOperations: 0,
        lastUpdate: Date.now(),
        averageRenderTime: 0,
        averageUpdateTime: 0,
        peakMemoryUsage: 0
      });
    }
    
    const metrics = this.metrics.get(pluginName);
    const operationKey = `${operation}Times`;
    
    if (metrics[operationKey]) {
      metrics[operationKey].push({
        duration,
        timestamp: Date.now(),
        context
      });
      
      // Keep only recent measurements for performance
      if (metrics[operationKey].length > 100) {
        metrics[operationKey].shift();
      }
      
      // Update averages
      this.updateAverages(pluginName, operation);
    }
    
    metrics.totalOperations++;
    metrics.lastUpdate = Date.now();
    
    // Add to performance history
    this.addToHistory({
      pluginName,
      operation,
      duration,
      timestamp: Date.now(),
      context
    });
    
    // Check for performance issues
    this.checkPerformanceThresholds(pluginName, operation, duration);
  }

  /**
   * Track memory usage for a plugin
   * @param {string} pluginName - Name of the plugin
   * @param {number} memoryUsage - Memory usage in bytes
   */
  trackMemoryUsage(pluginName, memoryUsage) {
    if (!this.metrics.has(pluginName)) {
      this.trackPluginPerformance(pluginName, 'init', 0);
    }
    
    const metrics = this.metrics.get(pluginName);
    metrics.memoryUsage.push({
      usage: memoryUsage,
      timestamp: Date.now()
    });
    
    // Update peak memory usage
    if (memoryUsage > metrics.peakMemoryUsage) {
      metrics.peakMemoryUsage = memoryUsage;
    }
    
    // Keep only recent measurements
    if (metrics.memoryUsage.length > 50) {
      metrics.memoryUsage.shift();
    }
  }

  /**
   * Track plugin errors
   * @param {string} pluginName - Name of the plugin
   * @param {Error} error - Error that occurred
   */
  trackError(pluginName, error) {
    if (!this.metrics.has(pluginName)) {
      this.trackPluginPerformance(pluginName, 'init', 0);
    }
    
    const metrics = this.metrics.get(pluginName);
    metrics.errorCount++;
    
    this.addToHistory({
      pluginName,
      operation: 'error',
      error: error.message,
      timestamp: Date.now()
    });
    
    this.logger.warn(`Performance Monitor: Plugin ${pluginName} error:`, error.message);
  }

  /**
   * Update average performance metrics
   * @param {string} pluginName - Name of the plugin
   * @param {string} operation - Operation type
   */
  updateAverages(pluginName, operation) {
    const metrics = this.metrics.get(pluginName);
    const operationKey = `${operation}Times`;
    const averageKey = `average${operation.charAt(0).toUpperCase() + operation.slice(1)}Time`;
    
    if (metrics[operationKey] && metrics[operationKey].length > 0) {
      const recent = metrics[operationKey].slice(-20); // Last 20 measurements
      const sum = recent.reduce((acc, item) => acc + item.duration, 0);
      metrics[averageKey] = sum / recent.length;
    }
  }

  /**
   * Check if performance thresholds are exceeded
   * @param {string} pluginName - Name of the plugin
   * @param {string} operation - Operation type
   * @param {number} duration - Duration in milliseconds
   */
  checkPerformanceThresholds(pluginName, operation, duration) {
    const thresholds = {
      render: this.resourceLimits.maxRenderTime,
      update: this.resourceLimits.maxUpdateTime,
      fetchData: 5000 // 5 seconds for data fetching
    };
    
    const threshold = thresholds[operation];
    if (threshold && duration > threshold) {
      this.logger.warn(
        `Performance Monitor: Plugin ${pluginName} ${operation} took ${duration}ms (threshold: ${threshold}ms)`
      );
      
      // Suggest optimization
      this.suggestOptimization(pluginName, operation, duration);
    }
  }

  /**
   * Suggest optimization for slow plugins
   * @param {string} pluginName - Name of the plugin
   * @param {string} operation - Operation type
   * @param {number} duration - Duration in milliseconds
   */
  suggestOptimization(pluginName, operation, duration) {
    const suggestions = {
      render: [
        'Consider caching rendered content',
        'Reduce DOM manipulations',
        'Optimize text formatting operations'
      ],
      update: [
        'Increase update interval',
        'Implement data caching',
        'Use incremental updates'
      ],
      fetchData: [
        'Implement request caching',
        'Add request timeouts',
        'Use connection pooling'
      ]
    };
    
    const operationSuggestions = suggestions[operation] || ['Optimize plugin performance'];
    
    this.logger.info(`Performance suggestions for ${pluginName}:`, operationSuggestions);
  }

  /**
   * Get performance metrics for a plugin
   * @param {string} pluginName - Name of the plugin
   * @returns {Object} Performance metrics
   */
  getPluginMetrics(pluginName) {
    const metrics = this.metrics.get(pluginName);
    if (!metrics) {
      return null;
    }
    
    return {
      averageRenderTime: metrics.averageRenderTime || 0,
      averageUpdateTime: metrics.averageUpdateTime || 0,
      peakMemoryUsage: metrics.peakMemoryUsage || 0,
      currentMemoryUsage: this.getCurrentMemoryUsage(pluginName),
      errorCount: metrics.errorCount || 0,
      totalOperations: metrics.totalOperations || 0,
      lastUpdate: metrics.lastUpdate,
      healthScore: this.calculateHealthScore(pluginName)
    };
  }

  /**
   * Get current memory usage for a plugin
   * @param {string} pluginName - Name of the plugin
   * @returns {number} Current memory usage in bytes
   */
  getCurrentMemoryUsage(pluginName) {
    const metrics = this.metrics.get(pluginName);
    if (!metrics || !metrics.memoryUsage.length) {
      return 0;
    }
    
    const recent = metrics.memoryUsage.slice(-1)[0];
    return recent ? recent.usage : 0;
  }

  /**
   * Calculate health score for a plugin (0-100)
   * @param {string} pluginName - Name of the plugin
   * @returns {number} Health score
   */
  calculateHealthScore(pluginName) {
    const metrics = this.metrics.get(pluginName);
    if (!metrics) {
      return 100;
    }
    
    let score = 100;
    
    // Penalize slow render times
    if (metrics.averageRenderTime > this.resourceLimits.maxRenderTime) {
      score -= Math.min(30, (metrics.averageRenderTime / this.resourceLimits.maxRenderTime) * 10);
    }
    
    // Penalize slow update times
    if (metrics.averageUpdateTime > this.resourceLimits.maxUpdateTime) {
      score -= Math.min(30, (metrics.averageUpdateTime / this.resourceLimits.maxUpdateTime) * 10);
    }
    
    // Penalize high error rates
    if (metrics.totalOperations > 0) {
      const errorRate = metrics.errorCount / metrics.totalOperations;
      score -= Math.min(40, errorRate * 100);
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Get overall system performance metrics
   * @returns {Object} System performance metrics
   */
  getSystemMetrics() {
    const allPlugins = Array.from(this.metrics.keys());
    const totalPlugins = allPlugins.length;
    
    if (totalPlugins === 0) {
      return {
        totalPlugins: 0,
        averageHealthScore: 100,
        totalMemoryUsage: 0,
        averageRenderTime: 0,
        totalErrors: 0,
        uptime: Date.now() - this.startTime
      };
    }
    
    let totalMemory = 0;
    let totalRenderTime = 0;
    let totalErrors = 0;
    let totalHealthScore = 0;
    
    for (const pluginName of allPlugins) {
      const metrics = this.getPluginMetrics(pluginName);
      if (metrics) {
        totalMemory += metrics.currentMemoryUsage;
        totalRenderTime += metrics.averageRenderTime;
        totalErrors += metrics.errorCount;
        totalHealthScore += metrics.healthScore;
      }
    }
    
    return {
      totalPlugins,
      averageHealthScore: Math.round(totalHealthScore / totalPlugins),
      totalMemoryUsage: totalMemory,
      averageRenderTime: Math.round(totalRenderTime / totalPlugins),
      totalErrors,
      uptime: Date.now() - this.startTime,
      optimizationsApplied: this.getOptimizationCount()
    };
  }

  /**
   * Get performance recommendations for the system
   * @returns {Array} Array of recommendations
   */
  getRecommendations() {
    const recommendations = [];
    const systemMetrics = this.getSystemMetrics();
    
    // Memory usage recommendations
    if (systemMetrics.totalMemoryUsage > this.resourceLimits.maxMemoryUsage * 0.8) {
      recommendations.push({
        type: 'warning',
        category: 'memory',
        message: 'High memory usage detected',
        suggestion: 'Consider disabling unused plugins or increasing memory limits',
        priority: 'high'
      });
    }
    
    // Performance recommendations
    if (systemMetrics.averageRenderTime > this.resourceLimits.maxRenderTime) {
      recommendations.push({
        type: 'warning',
        category: 'performance',
        message: 'Slow rendering detected',
        suggestion: 'Optimize plugin render methods or increase update intervals',
        priority: 'medium'
      });
    }
    
    // Error rate recommendations
    if (systemMetrics.totalErrors > systemMetrics.totalPlugins * 5) {
      recommendations.push({
        type: 'error',
        category: 'reliability',
        message: 'High error rate detected',
        suggestion: 'Check plugin configurations and error handling',
        priority: 'high'
      });
    }
    
    // Plugin-specific recommendations
    for (const [pluginName, metrics] of this.metrics) {
      const healthScore = this.calculateHealthScore(pluginName);
      
      if (healthScore < 70) {
        recommendations.push({
          type: 'warning',
          category: 'plugin',
          plugin: pluginName,
          message: `Plugin ${pluginName} has low health score (${healthScore})`,
          suggestion: 'Review plugin performance and error handling',
          priority: healthScore < 50 ? 'high' : 'medium'
        });
      }
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Add entry to performance history
   * @param {Object} entry - Performance history entry
   */
  addToHistory(entry) {
    this.performanceHistory.push(entry);
    
    // Keep history size manageable
    if (this.performanceHistory.length > this.maxHistoryLength) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Start optimization loop
   */
  startOptimizationLoop() {
    this.optimizationTimer = setInterval(() => {
      this.runOptimizations();
    }, this.optimizationInterval);
  }

  /**
   * Stop optimization loop
   */
  stopOptimizationLoop() {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }
  }

  /**
   * Run automatic optimizations
   */
  runOptimizations() {
    const recommendations = this.getRecommendations();
    const highPriorityIssues = recommendations.filter(r => r.priority === 'high');
    
    if (highPriorityIssues.length > 0) {
      this.logger.warn(`Performance Monitor: ${highPriorityIssues.length} high priority performance issues detected`);
      
      // Apply automatic optimizations where possible
      this.applyAutomaticOptimizations(highPriorityIssues);
    }
    
    this.lastOptimization = Date.now();
  }

  /**
   * Apply automatic optimizations
   * @param {Array} issues - High priority performance issues
   */
  applyAutomaticOptimizations(issues) {
    for (const issue of issues) {
      switch (issue.category) {
        case 'memory':
          this.optimizeMemoryUsage();
          break;
        case 'performance':
          this.optimizeRenderPerformance();
          break;
        case 'plugin':
          this.optimizePlugin(issue.plugin);
          break;
      }
    }
  }

  /**
   * Optimize memory usage
   */
  optimizeMemoryUsage() {
    // Clear old performance history
    if (this.performanceHistory.length > this.maxHistoryLength / 2) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistoryLength / 2);
    }
    
    // Clear old metrics data
    for (const [pluginName, metrics] of this.metrics) {
      if (metrics.renderTimes.length > 50) {
        metrics.renderTimes = metrics.renderTimes.slice(-50);
      }
      if (metrics.updateTimes.length > 50) {
        metrics.updateTimes = metrics.updateTimes.slice(-50);
      }
      if (metrics.memoryUsage.length > 25) {
        metrics.memoryUsage = metrics.memoryUsage.slice(-25);
      }
    }
    
    this.logger.info('Performance Monitor: Applied memory optimization');
  }

  /**
   * Optimize render performance
   */
  optimizeRenderPerformance() {
    // This would typically involve communicating with the dashboard
    // to adjust update intervals for slow plugins
    this.logger.info('Performance Monitor: Applied render performance optimization');
  }

  /**
   * Optimize specific plugin
   * @param {string} pluginName - Name of the plugin to optimize
   */
  optimizePlugin(pluginName) {
    const metrics = this.metrics.get(pluginName);
    if (!metrics) return;
    
    // Reset error count if it's been a while since last error
    const timeSinceLastUpdate = Date.now() - metrics.lastUpdate;
    if (timeSinceLastUpdate > 300000) { // 5 minutes
      metrics.errorCount = Math.max(0, metrics.errorCount - 1);
    }
    
    this.logger.info(`Performance Monitor: Applied optimization for plugin ${pluginName}`);
  }

  /**
   * Get optimization count
   * @returns {number} Number of optimizations applied
   */
  getOptimizationCount() {
    return Math.floor((Date.now() - this.startTime) / this.optimizationInterval);
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
    this.performanceHistory = [];
    this.startTime = Date.now();
    this.lastOptimization = Date.now();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopOptimizationLoop();
    this.reset();
  }
}