/**
 * Render Scheduler - Manages efficient plugin updates and rendering
 * 
 * This class coordinates plugin updates to prevent resource overload,
 * manages visibility-based updates, and optimizes rendering performance.
 */

import { EventEmitter } from 'events';

export class RenderScheduler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.plugins = new Map();
    this.updateQueue = [];
    this.renderQueue = [];
    
    // Configuration
    this.maxConcurrentUpdates = options.maxConcurrentUpdates || 5;
    this.maxConcurrentRenders = options.maxConcurrentRenders || 3;
    this.defaultUpdateInterval = options.defaultUpdateInterval || 5000;
    this.minUpdateInterval = options.minUpdateInterval || 1000;
    this.maxUpdateInterval = options.maxUpdateInterval || 300000;
    
    // State tracking
    this.activeUpdates = new Set();
    this.activeRenders = new Set();
    this.pausedPlugins = new Set();
    this.visibilityMap = new Map();
    
    // Performance tracking
    this.performanceMonitor = options.performanceMonitor;
    this.logger = options.logger || console;
    
    // Scheduling
    this.schedulerRunning = false;
    this.frameId = null;
    this.lastFrameTime = 0;
    this.targetFPS = options.targetFPS || 30;
    this.frameInterval = 1000 / this.targetFPS;
    
    this.renderFrame = this.processFrame.bind(this);
    
    // Visibility observer
    this.visibilityObserver = null;
    this.setupVisibilityTracking();
    
    // Start scheduler
    this.start();
  }

  setConfiguration(config) {
    this.maxConcurrentUpdates = config.maxConcurrentUpdates || this.maxConcurrentUpdates;
    this.maxConcurrentRenders = config.maxConcurrentRenders || this.maxConcurrentRenders;
    this.defaultUpdateInterval = config.defaultUpdateInterval || this.defaultUpdateInterval;
    this.minUpdateInterval = config.minUpdateInterval || this.minUpdateInterval;
    this.maxUpdateInterval = config.maxUpdateInterval || this.maxUpdateInterval;
    this.targetFPS = config.targetFPS || this.targetFPS;
    this.frameInterval = 1000 / this.targetFPS;
  }

  /**
   * Register a plugin with the scheduler
   * @param {Object} plugin - Plugin instance
   * @param {Object} options - Scheduling options
   */
  registerPlugin(plugin, options = {}) {
    const pluginId = plugin.name;
    
    const config = {
      plugin,
      updateInterval: options.updateInterval || plugin.updateInterval || this.defaultUpdateInterval,
      priority: options.priority || plugin.priority || 5,
      canPause: options.canPause !== false,
      lastUpdate: 0,
      lastRender: 0,
      updateTimer: null,
      isVisible: true,
      isPaused: false,
      errorCount: 0,
      consecutiveErrors: 0,
      backoffMultiplier: 1
    };
    
    this.plugins.set(pluginId, config);
    this.visibilityMap.set(pluginId, true);
    
    // Start plugin updates
    this.schedulePluginUpdates(pluginId);
    
    this.logger.debug(`RenderScheduler: Registered plugin ${pluginId}`);
  }

  /**
   * Unregister a plugin from the scheduler
   * @param {string} pluginId - Plugin identifier
   */
  unregisterPlugin(pluginId) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    // Clear timers
    if (config.updateTimer) {
      clearInterval(config.updateTimer);
    }
    
    // Remove from active sets
    this.activeUpdates.delete(pluginId);
    this.activeRenders.delete(pluginId);
    this.pausedPlugins.delete(pluginId);
    
    // Remove from maps
    this.plugins.delete(pluginId);
    this.visibilityMap.delete(pluginId);
    
    this.logger.debug(`RenderScheduler: Unregistered plugin ${pluginId}`);
  }

  /**
   * Schedule updates for a plugin
   * @param {string} pluginId - Plugin identifier
   */
  schedulePluginUpdates(pluginId) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    // Clear existing timer
    if (config.updateTimer) {
      clearInterval(config.updateTimer);
    }
    
    // Calculate effective update interval with backoff
    const effectiveInterval = Math.min(
      config.updateInterval * config.backoffMultiplier,
      this.maxUpdateInterval
    );
    
    // Set up new timer
    config.updateTimer = setInterval(() => {
      this.queuePluginUpdate(pluginId);
    }, effectiveInterval);
    
    this.logger.debug(`RenderScheduler: Scheduled updates for ${pluginId} every ${effectiveInterval}ms`);
  }

  /**
   * Queue a plugin for update
   * @param {string} pluginId - Plugin identifier
   * @param {boolean} immediate - Whether to update immediately
   */
  queuePluginUpdate(pluginId, immediate = false) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    // Skip if plugin is paused or not visible
    if (config.isPaused || (!config.isVisible && config.canPause)) {
      return;
    }
    
    // Skip if already in queue or updating
    if (this.activeUpdates.has(pluginId) || 
        this.updateQueue.some(item => item.pluginId === pluginId)) {
      return;
    }
    
    const updateItem = {
      pluginId,
      priority: config.priority,
      timestamp: Date.now(),
      immediate
    };
    
    if (immediate) {
      this.updateQueue.unshift(updateItem);
    } else {
      // Insert based on priority
      const insertIndex = this.updateQueue.findIndex(item => item.priority < config.priority);
      if (insertIndex === -1) {
        this.updateQueue.push(updateItem);
      } else {
        this.updateQueue.splice(insertIndex, 0, updateItem);
      }
    }
    
    this.processUpdateQueue();
  }

  /**
   * Queue a plugin for render
   * @param {string} pluginId - Plugin identifier
   * @param {boolean} immediate - Whether to render immediately
   */
  queuePluginRender(pluginId, immediate = false) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    // Skip if not visible
    if (!config.isVisible) {
      return;
    }
    
    // Skip if already in queue or rendering
    if (this.activeRenders.has(pluginId) || 
        this.renderQueue.some(item => item.pluginId === pluginId)) {
      return;
    }
    
    const renderItem = {
      pluginId,
      priority: config.priority,
      timestamp: Date.now(),
      immediate
    };
    
    if (immediate) {
      this.renderQueue.unshift(renderItem);
    } else {
      // Insert based on priority
      const insertIndex = this.renderQueue.findIndex(item => item.priority < config.priority);
      if (insertIndex === -1) {
        this.renderQueue.push(renderItem);
      } else {
        this.renderQueue.splice(insertIndex, 0, renderItem);
      }
    }
    
    this.processRenderQueue();
  }

  /**
   * Process the update queue
   */
  async processUpdateQueue() {
    while (this.updateQueue.length > 0 && this.activeUpdates.size < this.maxConcurrentUpdates) {
      const updateItem = this.updateQueue.shift();
      await this.executePluginUpdate(updateItem.pluginId);
    }
  }

  /**
   * Process the render queue
   */
  async processRenderQueue() {
    while (this.renderQueue.length > 0 && this.activeRenders.size < this.maxConcurrentRenders) {
      const renderItem = this.renderQueue.shift();
      await this.executePluginRender(renderItem.pluginId);
    }
  }

  /**
   * Execute plugin update
   * @param {string} pluginId - Plugin identifier
   */
  async executePluginUpdate(pluginId) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    this.activeUpdates.add(pluginId);
    const startTime = Date.now();
    
    try {
      // Call plugin update method
      if (typeof config.plugin.update === 'function') {
        await config.plugin.update();
      } else if (typeof config.plugin.fetchData === 'function') {
        const data = await config.plugin.fetchData();
        config.plugin.data = data;
      }
      
      config.lastUpdate = Date.now();
      config.consecutiveErrors = 0;
      config.backoffMultiplier = Math.max(1, config.backoffMultiplier * 0.9); // Reduce backoff on success
      
      // Queue render after successful update
      this.queuePluginRender(pluginId);
      
    } catch (error) {
      this.handlePluginError(pluginId, 'update', error);
    } finally {
      this.activeUpdates.delete(pluginId);
      
      // Track performance
      const duration = Date.now() - startTime;
      if (this.performanceMonitor) {
        this.performanceMonitor.trackPluginPerformance(pluginId, 'update', duration);
      }
      
      // Continue processing queue
      this.processUpdateQueue();
    }
  }

  /**
   * Execute plugin render
   * @param {string} pluginId - Plugin identifier
   */
  async executePluginRender(pluginId) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    this.activeRenders.add(pluginId);
    const startTime = Date.now();
    
    try {
      // Call plugin render method
      if (typeof config.plugin.render === 'function') {
        await config.plugin.render();
      }
      
      config.lastRender = Date.now();
      
    } catch (error) {
      this.handlePluginError(pluginId, 'render', error);
    } finally {
      this.activeRenders.delete(pluginId);
      
      // Track performance
      const duration = Date.now() - startTime;
      if (this.performanceMonitor) {
        this.performanceMonitor.trackPluginPerformance(pluginId, 'render', duration);
      }
      
      // Continue processing queue
      this.processRenderQueue();
    }
  }

  /**
   * Handle plugin errors
   * @param {string} pluginId - Plugin identifier
   * @param {string} operation - Operation that failed
   * @param {Error} error - Error that occurred
   */
  handlePluginError(pluginId, operation, error) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    config.errorCount++;
    config.consecutiveErrors++;
    
    // Apply exponential backoff for consecutive errors
    if (config.consecutiveErrors > 2) {
      config.backoffMultiplier = Math.min(8, config.backoffMultiplier * 2);
      this.schedulePluginUpdates(pluginId); // Reschedule with new interval
    }
    
    // Pause plugin if too many consecutive errors
    if (config.consecutiveErrors > 5) {
      this.pausePlugin(pluginId, 'Too many consecutive errors');
    }
    
    // Track error
    if (this.performanceMonitor) {
      this.performanceMonitor.trackError(pluginId, error);
    }
    
    this.logger.error(`RenderScheduler: Plugin ${pluginId} ${operation} error:`, error.message);
  }

  /**
   * Set plugin visibility
   * @param {string} pluginId - Plugin identifier
   * @param {boolean} isVisible - Whether plugin is visible
   */
  setPluginVisibility(pluginId, isVisible) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    const wasVisible = config.isVisible;
    config.isVisible = isVisible;
    this.visibilityMap.set(pluginId, isVisible);
    
    if (wasVisible !== isVisible) {
      if (isVisible) {
        // Resume updates when becoming visible
        if (config.canPause && this.pausedPlugins.has(pluginId)) {
          this.resumePlugin(pluginId);
        }
        // Trigger immediate update
        this.queuePluginUpdate(pluginId, true);
      } else {
        // Pause updates when becoming invisible
        if (config.canPause) {
          this.pausePlugin(pluginId, 'Not visible');
        }
      }
      
      this.logger.debug(`RenderScheduler: Plugin ${pluginId} visibility changed to ${isVisible}`);
    }
  }

  /**
   * Pause a plugin
   * @param {string} pluginId - Plugin identifier
   * @param {string} reason - Reason for pausing
   */
  pausePlugin(pluginId, reason = 'Manual pause') {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    config.isPaused = true;
    this.pausedPlugins.add(pluginId);
    
    // Clear update timer
    if (config.updateTimer) {
      clearInterval(config.updateTimer);
      config.updateTimer = null;
    }
    
    this.logger.info(`RenderScheduler: Paused plugin ${pluginId} (${reason})`);
  }

  /**
   * Resume a plugin
   * @param {string} pluginId - Plugin identifier
   */
  resumePlugin(pluginId) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    config.isPaused = false;
    this.pausedPlugins.delete(pluginId);
    
    // Restart updates
    this.schedulePluginUpdates(pluginId);
    
    this.logger.info(`RenderScheduler: Resumed plugin ${pluginId}`);
  }

  /**
   * Update plugin configuration
   * @param {string} pluginId - Plugin identifier
   * @param {Object} options - New configuration options
   */
  updatePluginConfig(pluginId, options) {
    const config = this.plugins.get(pluginId);
    if (!config) return;
    
    // Update configuration
    if (options.updateInterval !== undefined) {
      config.updateInterval = Math.max(this.minUpdateInterval, options.updateInterval);
      this.schedulePluginUpdates(pluginId); // Reschedule with new interval
    }
    
    if (options.priority !== undefined) {
      config.priority = options.priority;
    }
    
    if (options.canPause !== undefined) {
      config.canPause = options.canPause;
    }
    
    this.logger.debug(`RenderScheduler: Updated config for plugin ${pluginId}`);
  }

  /**
   * Setup visibility tracking
   */
  setupVisibilityTracking() {
    // This would integrate with the actual UI framework
    // For now, we'll simulate visibility changes
    this.visibilityCheckInterval = setInterval(() => {
      this.checkPluginVisibility();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Check plugin visibility (placeholder implementation)
   */
  checkPluginVisibility() {
    // In a real implementation, this would check actual DOM visibility
    // For now, we'll assume all registered plugins are visible
    for (const [pluginId] of this.plugins) {
      if (!this.visibilityMap.has(pluginId)) {
        this.setPluginVisibility(pluginId, true);
      }
    }
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.schedulerRunning) return;
    
    this.schedulerRunning = true;
    this.scheduleFrame();
    
    this.logger.info('RenderScheduler: Started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.schedulerRunning) return;
    
    this.schedulerRunning = false;
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
      this.visibilityCheckInterval = null;
    }
    
    // Clear all plugin timers
    for (const [, config] of this.plugins) {
      if (config.updateTimer) {
        clearInterval(config.updateTimer);
        config.updateTimer = null;
      }
    }
    
    this.logger.info('RenderScheduler: Stopped');
  }

  /**
   * Schedule next frame
   */
  scheduleFrame() {
    if (!this.schedulerRunning) return;
    
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      // Use requestAnimationFrame in browser environment
      this.frameId = requestAnimationFrame((timestamp) => {
        this.lastFrameTime = timestamp;
        this.renderFrame(timestamp);
      });
    } else {
      // Use setImmediate in Node.js environment
      this.frameId = setImmediate(() => {
        const timestamp = Date.now();
        this.lastFrameTime = timestamp;
        this.renderFrame(timestamp);
      });
    }
  }

  /**
   * Process frame
   * @param {number} timestamp - Frame timestamp
   */
  processFrame(timestamp) {
    const deltaTime = timestamp - this.lastFrameTime;
    
    if (deltaTime >= this.frameInterval) {
      // Process queues
      this.processUpdateQueue();
      this.processRenderQueue();
      
      this.lastFrameTime = timestamp;
    }
  }

  /**
   * Get scheduler statistics
   * @returns {Object} Scheduler statistics
   */
  getStatistics() {
    const totalPlugins = this.plugins.size;
    const activePlugins = totalPlugins - this.pausedPlugins.size;
    const visiblePlugins = Array.from(this.visibilityMap.values()).filter(Boolean).length;
    
    return {
      totalPlugins,
      activePlugins,
      visiblePlugins,
      pausedPlugins: this.pausedPlugins.size,
      activeUpdates: this.activeUpdates.size,
      activeRenders: this.activeRenders.size,
      updateQueueLength: this.updateQueue.length,
      renderQueueLength: this.renderQueue.length,
      maxConcurrentUpdates: this.maxConcurrentUpdates,
      maxConcurrentRenders: this.maxConcurrentRenders,
      targetFPS: this.targetFPS
    };
  }

  /**
   * Get plugin status
   * @param {string} pluginId - Plugin identifier
   * @returns {Object} Plugin status
   */
  getPluginStatus(pluginId) {
    const config = this.plugins.get(pluginId);
    if (!config) return null;
    
    return {
      pluginId,
      isVisible: config.isVisible,
      isPaused: config.isPaused,
      priority: config.priority,
      updateInterval: config.updateInterval,
      lastUpdate: config.lastUpdate,
      lastRender: config.lastRender,
      errorCount: config.errorCount,
      consecutiveErrors: config.consecutiveErrors,
      backoffMultiplier: config.backoffMultiplier,
      isUpdating: this.activeUpdates.has(pluginId),
      isRendering: this.activeRenders.has(pluginId)
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    
    // Clear all data
    this.plugins.clear();
    this.updateQueue = [];
    this.renderQueue = [];
    this.activeUpdates.clear();
    this.activeRenders.clear();
    this.pausedPlugins.clear();
    this.visibilityMap.clear();
  }
}