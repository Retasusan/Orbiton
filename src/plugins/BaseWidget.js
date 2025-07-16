/**
 * @fileoverview BaseWidget - Foundation class for all Orbiton plugins
 * 
 * This class provides the core functionality that all widgets need:
 * - Lifecycle management (initialize, render, update, destroy)
 * - Option validation using JSON schema
 * - Error handling with graceful degradation
 * - Theme integration
 * - Event management
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { Logger } from '../utils/Logger.js';
import { Validator } from '../utils/Validator.js';
import { OrbitonError, PluginError } from '../utils/Errors.js';
import blessed from 'blessed';

/**
 * Base widget class that all plugins should extend
 * 
 * @example
 * ```javascript
 * import { BaseWidget } from 'orbiton';
 * 
 * export default class MyWidget extends BaseWidget {
 *   async initialize() {
 *     this.title = this.options.title || 'My Widget';
 *   }
 * 
 *   async render() {
 *     this.element = blessed.box({
 *       label: this.title,
 *       content: 'Hello World',
 *       border: { type: 'line' }
 *     });
 *   }
 * }
 * ```
 */
export class BaseWidget {
  /**
   * Create a new widget instance
   * @param {string} name - Widget name (must be unique)
   * @param {Object} options - Widget configuration options
   * @param {Object} context - Widget context (grid, theme, eventBus, etc.)
   */
  constructor(name, options = {}, context = {}) {
    // Core properties
    this.name = name;
    this.context = context;
    this.logger = new Logger(`widget:${name}`);
    this.validator = new Validator();
    
    // Event bus for plugin communication
    this.eventBus = context.eventBus || null;
    
    // Widget state
    this.isInitialized = false;
    this.isRendered = false;
    this.isVisible = true;
    this.isDestroyed = false;
    
    // UI elements
    this.element = null;
    this.position = null;
    this.theme = context.theme || this.getDefaultTheme();
    
    // Lifecycle management
    this.updateTimer = null;
    this.eventListeners = new Map();
    this.eventUnsubscribers = new Set(); // Track event bus subscriptions
    this.childWidgets = new Set();
    
    // Error handling
    this.errorCount = 0;
    this.lastError = null;
    this.maxErrors = 5;
    
    // Validate and set options
    try {
      this.options = this.validateOptions(options);
      this.logger.debug(`Widget ${name} created with options:`, this.options);
    } catch (error) {
      this.logger.error(`Failed to validate options for ${name}:`, error);
      this.options = this.getDefaultOptions();
      this.handleError(new PluginError(name, 'Invalid options, using defaults', error));
    }
  }

  /**
   * Initialize the widget
   * This method should be overridden by subclasses to set up widget-specific state
   * 
   * @returns {Promise<void>}
   * @throws {PluginError} If initialization fails
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn(`Widget ${this.name} is already initialized`);
      return;
    }

    try {
      this.logger.info(`Initializing widget: ${this.name}`);
      const startTime = Date.now();

      // Perform initialization
      await this.performInitialization();
      
      // Mark as initialized
      this.isInitialized = true;
      
      // Log timing
      const duration = Date.now() - startTime;
      this.logger.debug(`Widget ${this.name} initialization completed in ${duration}ms`);
      
      // Emit initialization event
      this.emit('initialized');
      
    } catch (error) {
      this.handleError(new PluginError(this.name, 'Initialization failed', error));
      throw error;
    }
  }

  /**
   * Perform widget-specific initialization
   * Override this method in subclasses instead of initialize()
   * 
   * @protected
   * @returns {Promise<void>}
   */
  async performInitialization() {
    // Default implementation - override in subclasses
    this.logger.debug(`Default initialization for ${this.name}`);
  }

  /**
   * Render the widget
   * This method creates and displays the widget's UI elements
   * 
   * @returns {Promise<void>}
   * @throws {PluginError} If rendering fails
   */
  async render() {
    if (!this.isInitialized) {
      throw new PluginError(this.name, 'Cannot render uninitialized widget');
    }

    if (this.isDestroyed) {
      throw new PluginError(this.name, 'Cannot render destroyed widget');
    }

    try {
      this.logger.debug(`Rendering widget: ${this.name}`);
      const startTime = Date.now();

      // Create UI elements if they don't exist
      if (!this.element) {
        await this.createElement();
      }

      // Update content
      await this.updateContent();
      
      // Apply theme
      this.applyTheme(this.theme);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Mark as rendered
      this.isRendered = true;
      
      // Log timing
      const duration = Date.now() - startTime;
      this.logger.debug(`Widget ${this.name} render completed in ${duration}ms`);
      
      // Emit render event
      this.emit('rendered');
      
      // Trigger screen render if available
      if (this.element && this.element.screen) {
        this.element.screen.render();
      }
      
    } catch (error) {
      this.handleError(new PluginError(this.name, 'Render failed', error));
      throw error;
    }
  }

  /**
   * Create the main UI element
   * Override this method to customize element creation
   * 
   * @protected
   * @returns {Promise<void>}
   */
  async createElement() {
    const elementOptions = this.getElementOptions();
    this.element = blessed.box(elementOptions);
    
    // Set position if available
    if (this.position) {
      this.setPosition(...this.position);
    }
  }

  /**
   * Get options for creating the blessed element
   * Override this method to customize element options
   * 
   * @protected
   * @returns {Object} Blessed element options
   */
  getElementOptions() {
    return {
      label: this.options.title || this.name,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: this.theme.border || 'white' },
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true
    };
  }

  /**
   * Update widget content
   * Override this method to customize content updates
   * 
   * @protected
   * @returns {Promise<void>}
   */
  async updateContent() {
    if (!this.element) {
      return;
    }

    const content = await this.generateContent();
    this.element.setContent(content);
  }

  /**
   * Generate content for the widget
   * Override this method to provide custom content
   * 
   * @protected
   * @returns {Promise<string>} Widget content
   */
  async generateContent() {
    return `{center}{bold}${this.name}{/bold}{/center}\n\nWidget is ready`;
  }

  /**
   * Update the widget (called periodically)
   * Override this method for widgets that need periodic updates
   * 
   * @returns {Promise<void>}
   */
  async update() {
    if (!this.isRendered || this.isDestroyed) {
      return;
    }

    try {
      this.logger.debug(`Updating widget: ${this.name}`);
      const startTime = Date.now();

      // Perform update
      await this.performUpdate();
      
      // Log timing
      this.logger.timing(`Widget ${this.name} update`, startTime);
      
      // Emit update event
      this.emit('updated');
      
    } catch (error) {
      this.handleError(new PluginError(this.name, 'Update failed', error));
    }
  }

  /**
   * Perform widget-specific update
   * Override this method in subclasses
   * 
   * @protected
   * @returns {Promise<void>}
   */
  async performUpdate() {
    await this.updateContent();
    
    if (this.element && this.element.screen) {
      this.element.screen.render();
    }
  }

  /**
   * Destroy the widget and clean up resources
   * 
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.isDestroyed) {
      this.logger.warn(`Widget ${this.name} is already destroyed`);
      return;
    }

    try {
      this.logger.info(`Destroying widget: ${this.name}`);
      
      // Stop any running timers
      this.stopUpdates();
      
      // Destroy child widgets
      for (const child of this.childWidgets) {
        await child.destroy();
      }
      this.childWidgets.clear();
      
      // Remove event listeners
      this.removeAllEventListeners();
      
      // Perform widget-specific cleanup
      await this.performDestroy();
      
      // Remove UI element
      if (this.element) {
        this.element.destroy();
        this.element = null;
      }
      
      // Mark as destroyed
      this.isDestroyed = true;
      
      // Emit destroy event
      this.emit('destroyed');
      
      this.logger.info(`Widget ${this.name} destroyed successfully`);
      
    } catch (error) {
      this.logger.error(`Error destroying widget ${this.name}:`, error);
    }
  }

  /**
   * Perform widget-specific cleanup
   * Override this method in subclasses
   * 
   * @protected
   * @returns {Promise<void>}
   */
  async performDestroy() {
    // Default implementation - override in subclasses
  }

  /**
   * Set widget position on the grid
   * 
   * @param {number} row - Grid row
   * @param {number} col - Grid column
   * @param {number} rowSpan - Number of rows to span
   * @param {number} colSpan - Number of columns to span
   */
  setPosition(row, col, rowSpan, colSpan) {
    this.position = [row, col, rowSpan, colSpan];
    
    if (this.element && this.context.grid) {
      // Update element position on grid
      this.context.grid.set(row, col, rowSpan, colSpan, this.element);
    }
    
    this.logger.debug(`Widget ${this.name} positioned at [${row}, ${col}, ${rowSpan}, ${colSpan}]`);
  }

  /**
   * Apply theme to the widget
   * 
   * @param {Object} theme - Theme configuration
   */
  applyTheme(theme) {
    this.theme = { ...this.theme, ...theme };
    
    if (this.element) {
      // Apply theme to element
      if (this.element.style) {
        this.element.style.border = { fg: this.theme.border || 'white' };
        this.element.style.fg = this.theme.fg || 'white';
        this.element.style.bg = this.theme.bg || 'black';
      }
      
      // Apply focus styles
      if (this.theme.focusBorder) {
        this.element.on('focus', () => {
          this.element.style.border.fg = this.theme.focusBorder;
          if (this.element.screen) this.element.screen.render();
        });
        
        this.element.on('blur', () => {
          this.element.style.border.fg = this.theme.border || 'white';
          if (this.element.screen) this.element.screen.render();
        });
      }
    }
    
    this.logger.debug(`Theme applied to widget ${this.name}`);
  }

  /**
   * Get default theme
   * 
   * @protected
   * @returns {Object} Default theme
   */
  getDefaultTheme() {
    return {
      border: 'white',
      fg: 'white',
      bg: 'black',
      focusBorder: 'yellow'
    };
  }

  /**
   * Handle widget errors with graceful degradation
   * 
   * @param {Error} error - The error to handle
   */
  handleError(error) {
    this.errorCount++;
    this.lastError = error;
    
    this.logger.error(`Widget ${this.name} error (${this.errorCount}/${this.maxErrors}):`, error);
    
    // Show error in widget if possible
    if (this.element && this.errorCount <= this.maxErrors) {
      this.showErrorState(error);
    }
    
    // Disable widget if too many errors
    if (this.errorCount >= this.maxErrors) {
      this.logger.error(`Widget ${this.name} disabled due to too many errors`);
      this.isVisible = false;
      this.emit('disabled', error);
    }
    
    // Emit error event
    this.emit('error', error);
  }

  /**
   * Show error state in the widget
   * 
   * @protected
   * @param {Error} error - The error to display
   */
  showErrorState(error) {
    if (!this.element) return;
    
    const errorContent = `{center}{red-fg}{bold}Error{/bold}{/red-fg}{/center}\n\n` +
                        `{red-fg}${error.message}{/red-fg}\n\n` +
                        `{gray-fg}Press 'r' to retry{/gray-fg}`;
    
    this.element.setContent(errorContent);
    
    // Add retry handler if element supports it
    if (typeof this.element.key === 'function') {
      this.element.key('r', async () => {
        try {
          this.errorCount = 0;
          await this.render();
        } catch (retryError) {
          this.handleError(retryError);
        }
      });
    }
    
    if (this.element.screen) {
      this.element.screen.render();
    }
  }

  /**
   * Validate widget options against schema
   * 
   * @param {Object} options - Options to validate
   * @returns {Object} Validated options
   * @throws {Error} If validation fails
   */
  validateOptions(options) {
    const schema = this.getOptionsSchema();
    
    if (!schema || Object.keys(schema).length === 0) {
      return { ...this.getDefaultOptions(), ...options };
    }
    
    const result = this.validator.validate(options, schema);
    
    if (!result.isValid) {
      const errorMsg = result.errors.map(err => `${err.field}: ${err.message}`).join(', ');
      throw new Error(`Invalid options: ${errorMsg}`);
    }
    
    return { ...this.getDefaultOptions(), ...result.data };
  }

  /**
   * Get options schema for validation
   * Override this method to provide custom validation
   * 
   * @returns {Object} JSON schema for options
   */
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: this.name
        },
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          minimum: 1000,
          default: 5000
        },
        enabled: {
          type: 'boolean',
          description: 'Whether the widget is enabled',
          default: true
        }
      },
      required: []
    };
  }

  /**
   * Get default options
   * 
   * @protected
   * @returns {Object} Default options
   */
  getDefaultOptions() {
    return {
      title: this.name,
      updateInterval: 5000,
      enabled: true
    };
  }

  /**
   * Set up event handlers for the widget
   * Override this method to add custom event handlers
   * 
   * @protected
   */
  setupEventHandlers() {
    if (!this.element) return;
    
    // Basic navigation
    this.element.key(['up', 'down', 'pageup', 'pagedown'], (ch, key) => {
      switch (key.name) {
        case 'up':
          this.element.scroll(-1);
          break;
        case 'down':
          this.element.scroll(1);
          break;
        case 'pageup':
          this.element.scroll(-(this.element.height - 2));
          break;
        case 'pagedown':
          this.element.scroll(this.element.height - 2);
          break;
      }
      if (this.element.screen) this.element.screen.render();
    });
    
    // Mouse wheel support
    this.element.on('wheelup', () => {
      this.element.scroll(-3);
      if (this.element.screen) this.element.screen.render();
    });
    
    this.element.on('wheeldown', () => {
      this.element.scroll(3);
      if (this.element.screen) this.element.screen.render();
    });
    
    // Refresh on F5 or 'r'
    this.element.key(['f5', 'r'], async () => {
      await this.update();
    });
  }

  /**
   * Start automatic updates
   * 
   * @param {number} [interval] - Update interval in milliseconds
   */
  startUpdates(interval = null) {
    const updateInterval = interval || this.options.updateInterval || 5000;
    
    if (this.updateTimer) {
      this.stopUpdates();
    }
    
    this.updateTimer = setInterval(async () => {
      if (this.isVisible && !this.isDestroyed) {
        await this.update();
      }
    }, updateInterval);
    
    this.logger.debug(`Started updates for ${this.name} (interval: ${updateInterval}ms)`);
  }

  /**
   * Stop automatic updates
   */
  stopUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      this.logger.debug(`Stopped updates for ${this.name}`);
    }
  }

  /**
   * Pause updates (keep timer but skip execution)
   */
  pauseUpdates() {
    this.isVisible = false;
    this.logger.debug(`Paused updates for ${this.name}`);
  }

  /**
   * Resume updates
   */
  resumeUpdates() {
    this.isVisible = true;
    this.logger.debug(`Resumed updates for ${this.name}`);
  }

  /**
   * Add event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(listener);
  }

  /**
   * Remove event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(listener);
    }
  }

  /**
   * Emit event
   * 
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   */
  emit(event, ...args) {
    if (this.eventListeners.has(event)) {
      for (const listener of this.eventListeners.get(event)) {
        try {
          listener(...args);
        } catch (error) {
          this.logger.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Remove all event listeners
   * 
   * @protected
   */
  removeAllEventListeners() {
    this.eventListeners.clear();
    
    // Clean up event bus subscriptions
    for (const unsubscriber of this.eventUnsubscribers) {
      try {
        unsubscriber();
      } catch (error) {
        this.logger.error('Error unsubscribing from event:', error);
      }
    }
    this.eventUnsubscribers.clear();
    
    if (this.element) {
      this.element.removeAllListeners();
    }
  }

  /**
   * Subscribe to an event through the event bus
   * 
   * @param {string} eventName - Event name to subscribe to
   * @param {Function} handler - Event handler function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, handler, options = {}) {
    if (!this.eventBus) {
      this.logger.warn(`Cannot subscribe to ${eventName}: no event bus available`);
      return () => {};
    }

    const unsubscriber = this.eventBus.subscribe(eventName, handler, {
      pluginName: this.name,
      ...options
    });

    this.eventUnsubscribers.add(unsubscriber);
    this.logger.debug(`Subscribed to event: ${eventName}`);

    return () => {
      unsubscriber();
      this.eventUnsubscribers.delete(unsubscriber);
    };
  }

  /**
   * Emit an event through the event bus
   * 
   * @param {string} eventName - Event name to emit
   * @param {any} data - Event data
   * @param {Object} context - Additional event context
   */
  emitEvent(eventName, data = null, context = {}) {
    if (!this.eventBus) {
      this.logger.warn(`Cannot emit ${eventName}: no event bus available`);
      return;
    }

    this.eventBus.emitEvent(eventName, data, {
      source: this.name,
      ...context
    });

    this.logger.debug(`Emitted event: ${eventName}`);
  }

  /**
   * Register a keyboard shortcut for this widget
   * 
   * @param {string|Array} keys - Key combination(s)
   * @param {Function} handler - Key handler function
   * @param {Object} options - Handler options
   * @returns {Function} Unregister function
   */
  onKey(keys, handler, options = {}) {
    if (!this.eventBus) {
      this.logger.warn('Cannot register keyboard handler: no event bus available');
      return () => {};
    }

    const unsubscriber = this.eventBus.onKeyboard(keys, handler, {
      pluginName: this.name,
      element: this.element,
      ...options
    });

    this.eventUnsubscribers.add(unsubscriber);
    this.logger.debug(`Registered keyboard handler: ${Array.isArray(keys) ? keys.join(',') : keys}`);

    return () => {
      unsubscriber();
      this.eventUnsubscribers.delete(unsubscriber);
    };
  }

  /**
   * Register a mouse event handler for this widget
   * 
   * @param {string} eventType - Mouse event type
   * @param {Function} handler - Mouse handler function
   * @param {Object} options - Handler options
   * @returns {Function} Unregister function
   */
  onMouse(eventType, handler, options = {}) {
    if (!this.eventBus || !this.element) {
      this.logger.warn('Cannot register mouse handler: no event bus or element available');
      return () => {};
    }

    const unsubscriber = this.eventBus.onMouse(eventType, this.element, handler, {
      pluginName: this.name,
      ...options
    });

    this.eventUnsubscribers.add(unsubscriber);
    this.logger.debug(`Registered mouse handler: ${eventType}`);

    return () => {
      unsubscriber();
      this.eventUnsubscribers.delete(unsubscriber);
    };
  }

  /**
   * Register focus event handlers for this widget
   * 
   * @param {Function} handler - Focus handler function
   * @param {Object} options - Handler options
   * @returns {Function} Unregister function
   */
  onFocus(handler, options = {}) {
    if (!this.eventBus || !this.element) {
      this.logger.warn('Cannot register focus handler: no event bus or element available');
      return () => {};
    }

    const unsubscriber = this.eventBus.onFocus(this.element, handler, {
      pluginName: this.name,
      ...options
    });

    this.eventUnsubscribers.add(unsubscriber);
    this.logger.debug('Registered focus handler');

    return () => {
      unsubscriber();
      this.eventUnsubscribers.delete(unsubscriber);
    };
  }

  /**
   * Add child widget
   * 
   * @param {BaseWidget} widget - Child widget to add
   */
  addChild(widget) {
    this.childWidgets.add(widget);
    widget.parent = this;
  }

  /**
   * Remove child widget
   * 
   * @param {BaseWidget} widget - Child widget to remove
   */
  removeChild(widget) {
    this.childWidgets.delete(widget);
    widget.parent = null;
  }

  /**
   * Get widget status information
   * 
   * @returns {Object} Widget status
   */
  getStatus() {
    return {
      name: this.name,
      isInitialized: this.isInitialized,
      isRendered: this.isRendered,
      isVisible: this.isVisible,
      isDestroyed: this.isDestroyed,
      errorCount: this.errorCount,
      lastError: this.lastError?.message,
      hasUpdateTimer: !!this.updateTimer,
      childCount: this.childWidgets.size
    };
  }

  /**
   * Get current theme
   * 
   * @returns {Object} Current theme object
   */
  getTheme() {
    return this.theme || this.getDefaultTheme();
  }

  /**
   * Get layout hints for positioning
   * 
   * @returns {Object} Layout hints
   */
  getLayoutHints() {
    return {
      minWidth: this.options.minWidth || 20,
      minHeight: this.options.minHeight || 5,
      preferredWidth: this.options.preferredWidth || 40,
      preferredHeight: this.options.preferredHeight || 10,
      maxWidth: this.options.maxWidth || null,
      maxHeight: this.options.maxHeight || null,
      resizable: this.options.resizable !== false,
      movable: this.options.movable !== false
    };
  }
}