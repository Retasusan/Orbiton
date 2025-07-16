/**
 * @fileoverview Dashboard Engine
 * 
 * Core dashboard rendering system with improved performance, plugin isolation,
 * asynchronous loading, and flexible grid layout management.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { Logger } from '../utils/Logger.js';
import { PluginManager } from '../plugins/PluginManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { LayoutManager } from './LayoutManager.js';
import { RenderScheduler } from './RenderScheduler.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { EventBus } from './EventBus.js';
import { DashboardError } from '../utils/Errors.js';
import blessed from 'blessed';

/**
 * Core dashboard rendering engine
 */
export class DashboardEngine {
  constructor(config, pluginManager) {
    this.logger = new Logger('dashboard-engine');

    // Core managers
    this.pluginManager = pluginManager;
    this.configManager = new ConfigManager(config);
    this.layoutManager = new LayoutManager(config.layout);
    this.renderScheduler = new RenderScheduler(config.scheduler);
    this.performanceMonitor = new PerformanceMonitor(config.performance);
    this.eventBus = new EventBus(config.eventBus);

    // Engine state
    this.isInitialized = false;
    this.isRunning = false;
    this.isShuttingDown = false;

    // TUI components
    this.screen = null;
    this.grid = null;

    // Widget management
    this.widgets = new Map(); // widgetId -> widget instance
    this.widgetElements = new Map(); // widgetId -> blessed element
    this.widgetStates = new Map(); // widgetId -> state info

    // Configuration
    this.options = {
      autoStart: config.autoStart !== false,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,
      maxConcurrentRenders: config.maxConcurrentRenders || 5,
      renderTimeout: config.renderTimeout || 30000,
      title: config.title || 'Orbiton Dashboard',
      ...config
    };

    // Performance tracking
    this.stats = {
      totalRenders: 0,
      averageRenderTime: 0,
      lastRenderTime: null,
      activeWidgets: 0,
      errorCount: 0
    };

    // Bind methods
    this.handleTerminalResize = this.handleTerminalResize.bind(this);
    this.handleTerminalInterrupt = this.handleTerminalInterrupt.bind(this);
  }

  /**
   * Initialize the dashboard engine
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      this.logger.warn('Dashboard engine already initialized');
      return;
    }

    this.logger.info('Initializing dashboard engine');
    const startTime = Date.now();

    try {
      // Initialize core managers
      await this.initializeManagers();
      
      // Load configuration
      await this.loadConfiguration();
      
      // Initialize layout system
      await this.initializeLayout();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start performance monitoring
      if (this.options.enablePerformanceMonitoring) {
        this.performanceMonitor.start();
      }
      
      this.isInitialized = true;
      
      // Auto-start if enabled
      if (this.options.autoStart) {
        await this.start();
      }
      
      this.logger.timing('Dashboard engine initialization', startTime);
      this.logger.info('Dashboard engine initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize dashboard engine:', error);
      throw new DashboardError('Dashboard initialization failed', error);
    }
  }

  /**
   * Start the dashboard engine
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.isInitialized) {
      throw new DashboardError('Dashboard engine not initialized');
    }

    if (this.isRunning) {
      this.logger.warn('Dashboard engine already running');
      return;
    }

    this.logger.info('Starting dashboard engine');
    const startTime = Date.now();

    try {
      // Load and initialize widgets
      await this.loadWidgets();
      
      // Start render scheduler
      this.renderScheduler.start();
      
      // Perform initial render
      await this.render();
      
      this.isRunning = true;
      
      this.logger.timing('Dashboard engine startup', startTime);
      this.logger.info(`Dashboard engine started with ${this.widgets.size} widgets`);
      
    } catch (error) {
      this.logger.error('Failed to start dashboard engine:', error);
      throw new DashboardError('Dashboard startup failed', error);
    }
  }

  /**
   * Stop the dashboard engine
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Stopping dashboard engine');

    try {
      // Stop render scheduler
      this.renderScheduler.stop();
      
      // Destroy all widgets
      await this.destroyAllWidgets();
      
      // Stop performance monitoring
      this.performanceMonitor.stop();
      
      this.isRunning = false;
      this.logger.info('Dashboard engine stopped');
      
    } catch (error) {
      this.logger.error('Error stopping dashboard engine:', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Render the dashboard
   * @param {Object} options - Render options
   * @returns {Promise<void>}
   */
  async render(options = {}) {
    if (!this.isInitialized) {
      throw new DashboardError('Dashboard engine not initialized');
    }

    const renderStartTime = Date.now();
    const renderContext = {
      force: options.force || false,
      widgets: options.widgets || Array.from(this.widgets.keys()),
      reason: options.reason || 'manual'
    };

    try {
      this.logger.debug(`Starting render: ${renderContext.reason}`);
      
      // Update layout if needed
      if (this.layoutManager.needsUpdate() || renderContext.force) {
        await this.updateLayout();
      }
      
      // Render widgets
      await this.renderWidgets(renderContext);
      
      // Trigger screen render
      if (this.screen) {
        this.screen.render();
      }
      
      // Emit render complete event
      this.eventBus.emitEvent('dashboard:rendered', {
        reason: renderContext.reason,
        widgetCount: renderContext.widgets.length,
        renderTime: Date.now() - renderStartTime
      });
      
      // Update statistics
      this.updateRenderStats(renderStartTime);
      
      this.logger.debug(`Render completed in ${Date.now() - renderStartTime}ms`);
      
    } catch (error) {
      this.stats.errorCount++;
      this.logger.error('Render failed:', error);
      throw new DashboardError('Dashboard render failed', error);
    }
  }

  /**
   * Add a widget to the dashboard
   * @param {string} pluginName - Plugin name
   * @param {Object} config - Widget configuration
   * @returns {Promise<string>} Widget ID
   */
  async addWidget(pluginName, config = {}) {
    try {
      this.logger.info(`Adding widget: ${pluginName}`);
      
      // Generate unique widget ID
      const widgetId = this.generateWidgetId(pluginName);
      
      // Create widget instance
      const widget = await this.pluginManager.createWidget(pluginName, {
        id: widgetId,
        ...config.options
      });
      
      // Store widget
      this.widgets.set(widgetId, widget);
      this.widgetStates.set(widgetId, {
        pluginName,
        config,
        created: new Date(),
        lastRender: null,
        renderCount: 0,
        errors: []
      });
      
      // Create DOM element
      const element = await this.createWidgetElement(widgetId, widget, config);
      this.widgetElements.set(widgetId, element);
      
      // Add to layout
      this.layoutManager.addWidget(widgetId, config.position, config.size);
      
      // Initialize widget
      if (typeof widget.initialize === 'function') {
        await widget.initialize();
      }
      
      // Render widget
      await this.renderWidget(widgetId);
      
      this.stats.activeWidgets = this.widgets.size;
      this.logger.info(`Widget added successfully: ${widgetId}`);
      
      return widgetId;
      
    } catch (error) {
      this.logger.error(`Failed to add widget ${pluginName}:`, error);
      throw new DashboardError(`Failed to add widget: ${error.message}`, error);
    }
  }

  /**
   * Remove a widget from the dashboard
   * @param {string} widgetId - Widget ID
   * @returns {Promise<boolean>} Whether widget was removed
   */
  async removeWidget(widgetId) {
    if (!this.widgets.has(widgetId)) {
      return false;
    }

    try {
      this.logger.info(`Removing widget: ${widgetId}`);
      
      const widget = this.widgets.get(widgetId);
      const element = this.widgetElements.get(widgetId);
      
      // Destroy widget
      if (typeof widget.destroy === 'function') {
        await widget.destroy();
      }
      
      // Remove from screen
      if (element && element.parent) {
        element.parent.remove(element);
      }
      
      // Remove from layout
      this.layoutManager.removeWidget(widgetId);
      
      // Clean up
      this.widgets.delete(widgetId);
      this.widgetElements.delete(widgetId);
      this.widgetStates.delete(widgetId);
      
      this.stats.activeWidgets = this.widgets.size;
      this.logger.info(`Widget removed successfully: ${widgetId}`);
      
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to remove widget ${widgetId}:`, error);
      throw new DashboardError(`Failed to remove widget: ${error.message}`, error);
    }
  }

  /**
   * Update a widget's configuration
   * @param {string} widgetId - Widget ID
   * @param {Object} config - New configuration
   * @returns {Promise<void>}
   */
  async updateWidget(widgetId, config) {
    if (!this.widgets.has(widgetId)) {
      throw new DashboardError(`Widget not found: ${widgetId}`);
    }

    try {
      this.logger.debug(`Updating widget: ${widgetId}`);
      
      const widget = this.widgets.get(widgetId);
      const state = this.widgetStates.get(widgetId);
      
      // Update widget options
      if (config.options) {
        Object.assign(widget.options, config.options);
      }
      
      // Update layout if position/size changed
      if (config.position || config.size) {
        this.layoutManager.updateWidget(widgetId, config.position, config.size);
      }
      
      // Update state
      state.config = { ...state.config, ...config };
      
      // Re-render widget
      await this.renderWidget(widgetId);
      
      this.logger.debug(`Widget updated successfully: ${widgetId}`);
      
    } catch (error) {
      this.logger.error(`Failed to update widget ${widgetId}:`, error);
      throw new DashboardError(`Failed to update widget: ${error.message}`, error);
    }
  }

  /**
   * Get widget information
   * @param {string} widgetId - Widget ID
   * @returns {Object|null} Widget information
   */
  getWidget(widgetId) {
    if (!this.widgets.has(widgetId)) {
      return null;
    }

    const widget = this.widgets.get(widgetId);
    const state = this.widgetStates.get(widgetId);
    const element = this.widgetElements.get(widgetId);

    return {
      id: widgetId,
      pluginName: state.pluginName,
      config: state.config,
      widget,
      element,
      state: {
        created: state.created,
        lastRender: state.lastRender,
        renderCount: state.renderCount,
        errors: state.errors.length
      }
    };
  }

  /**
   * Get all widgets
   * @returns {Array<Object>} Widget information array
   */
  getAllWidgets() {
    return Array.from(this.widgets.keys()).map(id => this.getWidget(id));
  }

  /**
   * Get dashboard statistics
   * @returns {Object} Dashboard statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      widgets: {
        total: this.widgets.size,
        active: Array.from(this.widgets.values()).filter(w => w.isActive).length,
        byPlugin: this.getWidgetsByPlugin()
      },
      layout: this.layoutManager.getStatistics(),
      performance: this.performanceMonitor.getStatistics(),
      scheduler: this.renderScheduler.getStatistics()
    };
  }

  /**
   * Initialize core managers
   * @private
   * @returns {Promise<void>}
   */
  async initializeManagers() {
    // PluginManager is initialized externally and passed in
    await this.configManager.loadConfig();
    await this.layoutManager.initialize();
  }

  /**
   * Load configuration
   * @private
   * @returns {Promise<void>}
   */
  async loadConfiguration() {
    const config = this.configManager.mergedConfig;
    
    // Apply configuration to managers
    if (config.layout) {
      this.layoutManager.setConfiguration(config.layout);
    }
    
    if (config.performance) {
      this.renderScheduler.setConfiguration(config.performance);
    }
  }

  /**
   * Initialize layout system
   * @private
   * @returns {Promise<void>}
   */
  async initializeLayout() {
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: this.options.title,
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: null
      },
      debug: this.options.debug || false,
      fullUnicode: true,
      dockBorders: true,
      autoPadding: true,
    });

    // Set up global key handlers for graceful exit
    this.screen.key(['escape', 'q', 'C-c'], (ch, key) => {
      this.logger.info('Exiting Orbiton Dashboard.');
      return process.exit(0);
    });
    
    // Set screen reference in event bus
    this.eventBus.setScreen(this.screen);
    
    // Initialize layout manager with screen
    await this.layoutManager.setContainer(this.screen);
    
    // Set up global key handlers
    this.setupGlobalKeyHandlers();
  }

  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // Terminal resize handling
    this.eventBus.subscribe('terminal:resize', this.handleTerminalResize);
    
    // Terminal interrupt handling
    this.eventBus.subscribe('terminal:interrupt', this.handleTerminalInterrupt);
    
    // Render scheduler events
    this.renderScheduler.on('render', () => this.render({ reason: 'scheduled' }));
    this.renderScheduler.on('error', (error) => {
      this.logger.error('Render scheduler error:', error);
    });
    
    // Screen events
    if (this.screen) {
      this.screen.on('resize', () => {
        this.eventBus.emitEvent('screen:resize', {
          width: this.screen.width,
          height: this.screen.height
        });
      });
    }
  }

  /**
   * Set up global key handlers
   * @private
   */
  setupGlobalKeyHandlers() {
    if (!this.screen) return;
    
    // Quit on Ctrl+C or 'q'
    this.screen.key(['C-c', 'q'], () => {
      this.eventBus.emitEvent('dashboard:quit');
      this.stop().then(() => {
        process.exit(0);
      });
    });
    
    // Refresh on F5 or Ctrl+R
    this.screen.key(['f5', 'C-r'], () => {
      this.render({ reason: 'manual-refresh', force: true });
    });
    
    // Focus navigation with Tab
    this.screen.key(['tab'], () => {
      this.screen.focusNext();
    });
    
    // Reverse focus navigation with Shift+Tab
    this.screen.key(['S-tab'], () => {
      this.screen.focusPrevious();
    });
  }

  /**
   * Load widgets from configuration
   * @private
   * @returns {Promise<void>}
   */
  async loadWidgets() {
    const config = this.configManager.mergedConfig;
    const plugins = config.plugins || [];
    
    this.logger.info(`Loading ${plugins.length} widgets from configuration`);
    
    // Load widgets in parallel with concurrency limit
    const concurrency = this.options.maxConcurrentRenders;
    const chunks = this.chunkArray(plugins, concurrency);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (pluginConfig) => {
          if (pluginConfig.enabled !== false) {
            try {
              await this.addWidget(pluginConfig.name, pluginConfig);
            } catch (error) {
              this.logger.error(`Failed to load widget ${pluginConfig.name}:`, error);
            }
          }
        })
      );
    }
  }

  /**
   * Render all widgets
   * @private
   * @param {Object} renderContext - Render context
   * @returns {Promise<void>}
   */
  async renderWidgets(renderContext) {
    const widgetIds = renderContext.widgets.filter(id => this.widgets.has(id));
    
    if (widgetIds.length === 0) {
      return;
    }
    
    // Render widgets in chunks to avoid overwhelming the system
    const chunks = this.chunkArray(widgetIds, this.options.maxConcurrentRenders);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(widgetId => this.renderWidget(widgetId, renderContext))
      );
    }
  }

  /**
   * Render a single widget
   * @private
   * @param {string} widgetId - Widget ID
   * @param {Object} renderContext - Render context
   * @returns {Promise<void>}
   */
  async renderWidget(widgetId, renderContext = {}) {
    const widget = this.widgets.get(widgetId);
    const element = this.widgetElements.get(widgetId);
    const state = this.widgetStates.get(widgetId);
    
    if (!widget || !element || !state) {
      return;
    }

    const renderStartTime = Date.now();

    try {
      // Update widget if it has an update method
      if (typeof widget.update === 'function') {
        await widget.update();
      }
      
      // Render widget content
      if (typeof widget.render === 'function') {
        await widget.render();
      }
      
      // Update state
      state.lastRender = new Date();
      state.renderCount++;
      
      this.logger.debug(`Widget ${widgetId} rendered in ${Date.now() - renderStartTime}ms`);
      
    } catch (error) {
      state.errors.push({
        error: error.message,
        timestamp: new Date()
      });
      
      // Keep only last 10 errors
      if (state.errors.length > 10) {
        state.errors.shift();
      }
      
      this.logger.error(`Failed to render widget ${widgetId}:`, error);
      
      
      
      // Emit widget error event
      this.eventBus.emitEvent('widget:error', {
        widgetId,
        pluginName: state.pluginName,
        error: error.message
      });
    }
  }

  /**
   * Create widget blessed element
   * @private
   * @param {string} widgetId - Widget ID
   * @param {Object} widget - Widget instance
   * @param {Object} config - Widget configuration
   * @returns {Promise<Object>} Widget blessed element
   */
  async createWidgetElement(widgetId, widget, config) {
    // Create widget context with event bus
    const widgetContext = {
      eventBus: this.eventBus,
      theme: this.context?.theme,
      grid: this.grid,
      screen: this.screen
    };
    
    // Pass context to widget
    widget.context = { ...widget.context, ...widgetContext };
    
    // Create the widget's blessed element
    await widget.createElement();
    
    // Set widget name for identification
    if (widget.element) {
      widget.element.name = widgetId;
      widget.element.widgetId = widgetId;
      widget.element.pluginName = config.pluginName || 'unknown';
      
      // Add to screen
      this.screen.append(widget.element);
      
      // Emit widget created event
      this.eventBus.emitEvent('widget:created', {
        widgetId,
        pluginName: config.pluginName,
        element: widget.element
      });
    }
    
    return widget.element;
  }

  /**
   * Update layout
   * @private
   * @returns {Promise<void>}
   */
  async updateLayout() {
    await this.layoutManager.update();
    
    // Apply layout to widget elements
    for (const [widgetId, element] of this.widgetElements) {
      const layout = this.layoutManager.getWidgetLayout(widgetId);
      if (layout) {
        this.applyLayoutToElement(element, layout);
      }
    }
  }

  /**
   * Apply layout to blessed element
   * @private
   * @param {Object} element - Blessed element to position
   * @param {Object} layout - Layout information
   */
  applyLayoutToElement(element, layout) {
    if (!element) return;
    
    // Apply blessed.js positioning
    element.left = layout.x;
    element.top = layout.y;
    element.width = layout.width;
    element.height = layout.height;
    
    // Emit widget updated event
    this.eventBus.emitEvent('widget:updated', {
      widgetId: element.widgetId,
      pluginName: element.pluginName,
      layout
    });
  }

  /**
   * Destroy all widgets
   * @private
   * @returns {Promise<void>}
   */
  async destroyAllWidgets() {
    const widgetIds = Array.from(this.widgets.keys());
    
    for (const widgetId of widgetIds) {
      try {
        await this.removeWidget(widgetId);
      } catch (error) {
        this.logger.error(`Error destroying widget ${widgetId}:`, error);
      }
    }
  }

  /**
   * Handle terminal resize
   * @private
   */
  handleTerminalResize(eventObj) {
    this.logger.debug('Terminal resized:', eventObj.data);
    this.layoutManager.handleResize();
    this.render({ reason: 'terminal-resize', force: true });
  }

  /**
   * Handle terminal interrupt (Ctrl+C)
   * @private
   */
  handleTerminalInterrupt() {
    this.logger.info('Terminal interrupt received');
    this.eventBus.emitEvent('dashboard:quit');
    this.stop().then(() => {
      process.exit(0);
    });
  }

  /**
   * Generate unique widget ID
   * @private
   * @param {string} pluginName - Plugin name
   * @returns {string} Widget ID
   */
  generateWidgetId(pluginName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${pluginName}-${timestamp}-${random}`;
  }

  /**
   * Update render statistics
   * @private
   * @param {number} startTime - Render start time
   */
  updateRenderStats(startTime) {
    const renderTime = Date.now() - startTime;
    this.stats.totalRenders++;
    this.stats.averageRenderTime = 
      (this.stats.averageRenderTime * (this.stats.totalRenders - 1) + renderTime) / this.stats.totalRenders;
    this.stats.lastRenderTime = new Date();
  }

  /**
   * Get widgets grouped by plugin
   * @private
   * @returns {Object} Widgets by plugin
   */
  getWidgetsByPlugin() {
    const byPlugin = {};
    
    for (const [widgetId, state] of this.widgetStates) {
      const pluginName = state.pluginName;
      if (!byPlugin[pluginName]) {
        byPlugin[pluginName] = [];
      }
      byPlugin[pluginName].push(widgetId);
    }
    
    return byPlugin;
  }

  /**
   * Chunk array into smaller arrays
   * @private
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array<Array>} Chunked arrays
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get event bus instance
   * @returns {EventBus} Event bus instance
   */
  getEventBus() {
    return this.eventBus;
  }

  /**
   * Destroy dashboard and cleanup resources
   * @returns {Promise<void>}
   */
  async destroy() {
    await this.shutdown();
  }
}