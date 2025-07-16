/**
 * @fileoverview Event Bus
 * 
 * Central event system for plugin-to-plugin communication, keyboard/mouse
 * event handling, and plugin lifecycle event management for blessed.js TUI.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';

/**
 * Central event bus for dashboard communication in TUI environment
 */
export class EventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new Logger('event-bus');
    
    // Event bus configuration
    this.config = {
      maxListeners: 100,
      enableGlobalEvents: true,
      enablePluginIsolation: true,
      enableEventLogging: false,
      eventTimeout: 30000,
      ...options
    };
    
    // Set max listeners
    this.setMaxListeners(this.config.maxListeners);
    
    // Event tracking
    this.eventStats = new Map(); // event name -> stats
    this.pluginListeners = new Map(); // plugin name -> Set of listeners
    this.globalListeners = new Set();
    
    // Event middleware
    this.middleware = [];
    
    // TUI-specific event handlers
    this.keyboardHandlers = new Map(); // key combo -> Set of handlers
    this.screenHandlers = new Map(); // screen event -> Set of handlers
    this.widgetHandlers = new Map(); // widget event -> Set of handlers
    
    // Plugin lifecycle events
    this.lifecycleEvents = new Set([
      'plugin:loaded',
      'plugin:unloaded',
      'plugin:error',
      'plugin:updated',
      'widget:created',
      'widget:destroyed',
      'widget:rendered',
      'widget:updated',
      'widget:focused',
      'widget:blurred'
    ]);
    
    // Screen reference for TUI events
    this.screen = null;
    
    // Initialize event system
    this.initialize();
  }

  /**
   * Initialize the event bus
   * @private
   */
  initialize() {
    this.logger.info('Initializing event bus');
    
    // Set up global event listeners
    if (this.config.enableGlobalEvents) {
      this.setupGlobalEventListeners();
    }
    
    // Set up error handling
    this.on('error', (error) => {
      this.logger.error('Event bus error:', error);
    });
    
    this.logger.info('Event bus initialized');
  }

  /**
   * Emit an event with optional plugin context
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   * @param {Object} context - Event context
   * @returns {boolean} Whether event had listeners
   */
  emitEvent(eventName, data = null, context = {}) {
    try {
      // Log event if enabled
      if (this.config.enableEventLogging) {
        this.logger.debug(`Event emitted: ${eventName}`, { data, context });
      }
      
      // Update event statistics
      this.updateEventStats(eventName);
      
      // Process middleware
      const processedData = this.processMiddleware(eventName, data, context);
      
      // Create event object
      const eventObj = {
        name: eventName,
        data: processedData,
        context: {
          timestamp: Date.now(),
          source: context.source || 'system',
          ...context
        }
      };
      
      // Emit the event
      const hasListeners = this.emit(eventName, eventObj);
      
      // Emit global event if enabled
      if (this.config.enableGlobalEvents && eventName !== 'global') {
        this.emit('global', eventObj);
      }
      
      return hasListeners;
      
    } catch (error) {
      this.logger.error(`Failed to emit event ${eventName}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Subscribe to an event with plugin context
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, handler, options = {}) {
    try {
      const {
        pluginName = null,
        once = false,
        priority = 'normal',
        timeout = this.config.eventTimeout
      } = options;
      
      // Wrap handler with context and error handling
      const wrappedHandler = this.wrapEventHandler(handler, {
        eventName,
        pluginName,
        timeout
      });
      
      // Add listener
      if (once) {
        this.once(eventName, wrappedHandler);
      } else {
        this.on(eventName, wrappedHandler);
      }
      
      // Track plugin listeners
      if (pluginName && this.config.enablePluginIsolation) {
        this.trackPluginListener(pluginName, eventName, wrappedHandler);
      }
      
      this.logger.debug(`Event subscription added: ${eventName}${pluginName ? ` (${pluginName})` : ''}`);
      
      // Return unsubscribe function
      return () => {
        this.unsubscribe(eventName, wrappedHandler, pluginName);
      };
      
    } catch (error) {
      this.logger.error(`Failed to subscribe to event ${eventName}:`, error);
      return () => {}; // No-op unsubscribe
    }
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   * @param {string} pluginName - Plugin name (optional)
   */
  unsubscribe(eventName, handler, pluginName = null) {
    try {
      this.removeListener(eventName, handler);
      
      // Remove from plugin tracking
      if (pluginName && this.config.enablePluginIsolation) {
        this.untrackPluginListener(pluginName, eventName, handler);
      }
      
      this.logger.debug(`Event subscription removed: ${eventName}${pluginName ? ` (${pluginName})` : ''}`);
      
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from event ${eventName}:`, error);
    }
  }

  /**
   * Subscribe to multiple events at once
   * @param {Array<string>} eventNames - Event names
   * @param {Function} handler - Event handler
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function for all events
   */
  subscribeToMultiple(eventNames, handler, options = {}) {
    const unsubscribeFunctions = eventNames.map(eventName => 
      this.subscribe(eventName, handler, options)
    );
    
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Remove all listeners for a plugin
   * @param {string} pluginName - Plugin name
   */
  removePluginListeners(pluginName) {
    if (!this.config.enablePluginIsolation || !this.pluginListeners.has(pluginName)) {
      return;
    }
    
    const listeners = this.pluginListeners.get(pluginName);
    
    for (const { eventName, handler } of listeners) {
      this.removeListener(eventName, handler);
    }
    
    this.pluginListeners.delete(pluginName);
    this.logger.debug(`All listeners removed for plugin: ${pluginName}`);
  }

  /**
   * Set the blessed screen reference for TUI event handling
   * @param {Object} screen - Blessed screen instance
   */
  setScreen(screen) {
    this.screen = screen;
    this.setupScreenEventListeners();
    this.logger.debug('Screen reference set for event bus');
  }

  /**
   * Register keyboard event handler for blessed.js
   * @param {string|Array} keys - Key combination(s) (e.g., 'C-s', 'escape', ['q', 'C-c'])
   * @param {Function} handler - Key handler
   * @param {Object} options - Handler options
   * @returns {Function} Unregister function
   */
  onKeyboard(keys, handler, options = {}) {
    const {
      pluginName = null,
      element = this.screen, // Default to screen if no element specified
      global = false
    } = options;
    
    if (!element) {
      this.logger.warn('No screen or element available for keyboard handler');
      return () => {};
    }
    
    // Normalize keys to array
    const keyArray = Array.isArray(keys) ? keys : [keys];
    
    const keyHandler = (ch, key) => {
      const eventData = {
        ch,
        key,
        name: key?.name,
        ctrl: key?.ctrl,
        meta: key?.meta,
        shift: key?.shift,
        pluginName
      };
      
      handler(eventData);
    };
    
    // Store handler for cleanup
    const handlerKey = keyArray.join(',');
    if (!this.keyboardHandlers.has(handlerKey)) {
      this.keyboardHandlers.set(handlerKey, new Set());
    }
    this.keyboardHandlers.get(handlerKey).add({ handler: keyHandler, element });
    
    // Add blessed key listener
    element.key(keyArray, keyHandler);
    
    this.logger.debug(`Keyboard handler registered: ${handlerKey}${pluginName ? ` (${pluginName})` : ''}`);
    
    // Return unregister function
    return () => {
      element.unkey(keyArray, keyHandler);
      if (this.keyboardHandlers.has(handlerKey)) {
        const handlers = this.keyboardHandlers.get(handlerKey);
        for (const h of handlers) {
          if (h.handler === keyHandler && h.element === element) {
            handlers.delete(h);
            break;
          }
        }
        if (handlers.size === 0) {
          this.keyboardHandlers.delete(handlerKey);
        }
      }
    };
  }

  /**
   * Register mouse event handler for blessed.js elements
   * @param {string} eventType - Mouse event type (click, wheelup, wheeldown, etc.)
   * @param {Object} element - Blessed element or screen
   * @param {Function} handler - Mouse handler
   * @param {Object} options - Handler options
   * @returns {Function} Unregister function
   */
  onMouse(eventType, element, handler, options = {}) {
    const {
      pluginName = null
    } = options;
    
    if (!element) {
      this.logger.warn('No element provided for mouse handler');
      return () => {};
    }
    
    const mouseHandler = (data) => {
      const eventData = {
        ...data,
        eventType,
        pluginName
      };
      
      handler(eventData);
    };
    
    // Store handler for cleanup
    const handlerKey = `${eventType}:${element.name || 'unnamed'}`;
    if (!this.screenHandlers.has(handlerKey)) {
      this.screenHandlers.set(handlerKey, new Set());
    }
    this.screenHandlers.get(handlerKey).add({ handler: mouseHandler, element });
    
    // Add blessed mouse listener
    element.on(eventType, mouseHandler);
    
    this.logger.debug(`Mouse handler registered: ${eventType} on ${element.name || 'element'}${pluginName ? ` (${pluginName})` : ''}`);
    
    // Return unregister function
    return () => {
      element.removeListener(eventType, mouseHandler);
      if (this.screenHandlers.has(handlerKey)) {
        const handlers = this.screenHandlers.get(handlerKey);
        for (const h of handlers) {
          if (h.handler === mouseHandler && h.element === element) {
            handlers.delete(h);
            break;
          }
        }
        if (handlers.size === 0) {
          this.screenHandlers.delete(handlerKey);
        }
      }
    };
  }

  /**
   * Register widget focus event handler
   * @param {Object} element - Blessed element
   * @param {Function} handler - Focus handler
   * @param {Object} options - Handler options
   * @returns {Function} Unregister function
   */
  onFocus(element, handler, options = {}) {
    const { pluginName = null } = options;
    
    if (!element) {
      this.logger.warn('No element provided for focus handler');
      return () => {};
    }
    
    const focusHandler = () => {
      const eventData = {
        element,
        pluginName,
        type: 'focus'
      };
      
      handler(eventData);
      
      // Emit widget focus event
      this.emitEvent('widget:focused', {
        element,
        pluginName
      });
    };
    
    const blurHandler = () => {
      const eventData = {
        element,
        pluginName,
        type: 'blur'
      };
      
      handler(eventData);
      
      // Emit widget blur event
      this.emitEvent('widget:blurred', {
        element,
        pluginName
      });
    };
    
    // Store handlers for cleanup
    const handlerKey = `focus:${element.name || 'unnamed'}`;
    if (!this.widgetHandlers.has(handlerKey)) {
      this.widgetHandlers.set(handlerKey, new Set());
    }
    this.widgetHandlers.get(handlerKey).add({ 
      focusHandler, 
      blurHandler, 
      element 
    });
    
    // Add blessed focus listeners
    element.on('focus', focusHandler);
    element.on('blur', blurHandler);
    
    this.logger.debug(`Focus handler registered for ${element.name || 'element'}${pluginName ? ` (${pluginName})` : ''}`);
    
    // Return unregister function
    return () => {
      element.removeListener('focus', focusHandler);
      element.removeListener('blur', blurHandler);
      if (this.widgetHandlers.has(handlerKey)) {
        const handlers = this.widgetHandlers.get(handlerKey);
        for (const h of handlers) {
          if (h.focusHandler === focusHandler && h.element === element) {
            handlers.delete(h);
            break;
          }
        }
        if (handlers.size === 0) {
          this.widgetHandlers.delete(handlerKey);
        }
      }
    };
  }

  /**
   * Register widget lifecycle event handler
   * @param {string} widgetId - Widget ID
   * @param {string} eventType - Lifecycle event (created, destroyed, rendered, updated)
   * @param {Function} handler - Event handler
   * @param {Object} options - Handler options
   * @returns {Function} Unregister function
   */
  onWidgetLifecycle(widgetId, eventType, handler, options = {}) {
    const { pluginName = null } = options;
    const eventName = `widget:${eventType}`;
    
    const lifecycleHandler = (eventObj) => {
      if (eventObj.data.widgetId === widgetId || eventObj.data.element?.name === widgetId) {
        handler(eventObj);
      }
    };
    
    return this.subscribe(eventName, lifecycleHandler, { pluginName });
  }

  /**
   * Add event middleware
   * @param {Function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    if (typeof middleware === 'function') {
      this.middleware.push(middleware);
      this.logger.debug('Event middleware added');
    }
  }

  /**
   * Remove event middleware
   * @param {Function} middleware - Middleware function
   */
  removeMiddleware(middleware) {
    const index = this.middleware.indexOf(middleware);
    if (index !== -1) {
      this.middleware.splice(index, 1);
      this.logger.debug('Event middleware removed');
    }
  }

  /**
   * Get event statistics
   * @returns {Object} Event statistics
   */
  getStatistics() {
    return {
      totalEvents: Array.from(this.eventStats.values()).reduce((sum, stats) => sum + stats.count, 0),
      eventTypes: this.eventStats.size,
      activeListeners: this.listenerCount('global'),
      pluginListeners: this.pluginListeners.size,
      keyboardHandlers: Array.from(this.keyboardHandlers.values()).reduce((sum, handlers) => sum + handlers.size, 0),
      screenHandlers: Array.from(this.screenHandlers.values()).reduce((sum, handlers) => sum + handlers.size, 0),
      widgetHandlers: Array.from(this.widgetHandlers.values()).reduce((sum, handlers) => sum + handlers.size, 0),
      middleware: this.middleware.length,
      eventStats: Object.fromEntries(this.eventStats)
    };
  }

  /**
   * Clear all event handlers and listeners
   */
  clearAll() {
    this.logger.info('Clearing all event handlers');
    
    // Remove all listeners
    this.removeAllListeners();
    
    // Clear plugin listeners
    this.pluginListeners.clear();
    
    // Clear keyboard handlers
    for (const handlers of this.keyboardHandlers.values()) {
      for (const { handler, element } of handlers) {
        if (element && typeof element.unkey === 'function') {
          element.removeAllListeners('keypress');
        }
      }
    }
    this.keyboardHandlers.clear();
    
    // Clear screen handlers (mouse events)
    for (const [handlerKey, handlers] of this.screenHandlers) {
      const [eventType] = handlerKey.split(':');
      for (const { handler, element } of handlers) {
        if (element && typeof element.removeListener === 'function') {
          element.removeListener(eventType, handler);
        }
      }
    }
    this.screenHandlers.clear();
    
    // Clear widget handlers (focus events)
    for (const handlers of this.widgetHandlers.values()) {
      for (const { focusHandler, blurHandler, element } of handlers) {
        if (element && typeof element.removeListener === 'function') {
          element.removeListener('focus', focusHandler);
          element.removeListener('blur', blurHandler);
        }
      }
    }
    this.widgetHandlers.clear();
    
    // Clear statistics
    this.eventStats.clear();
    
    this.logger.info('All event handlers cleared');
  }

  /**
   * Setup global event listeners for TUI environment
   * @private
   */
  setupGlobalEventListeners() {
    // Process events
    process.on('SIGWINCH', () => {
      this.emitEvent('terminal:resize', {
        width: process.stdout.columns,
        height: process.stdout.rows
      });
    });
    
    process.on('SIGINT', () => {
      this.emitEvent('terminal:interrupt');
    });
    
    process.on('SIGTERM', () => {
      this.emitEvent('terminal:terminate');
    });
    
    // Error handling
    process.on('uncaughtException', (error) => {
      this.emitEvent('process:error', {
        type: 'uncaughtException',
        message: error.message,
        stack: error.stack
      });
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.emitEvent('process:error', {
        type: 'unhandledRejection',
        reason: reason,
        promise: promise
      });
    });
  }

  /**
   * Setup screen-specific event listeners
   * @private
   */
  setupScreenEventListeners() {
    if (!this.screen) {
      return;
    }

    // Screen resize events
    this.screen.on('resize', () => {
      this.emitEvent('screen:resize', {
        width: this.screen.width,
        height: this.screen.height
      });
    });

    // Screen render events
    this.screen.on('render', () => {
      this.emitEvent('screen:render');
    });

    // Screen destroy events
    this.screen.on('destroy', () => {
      this.emitEvent('screen:destroy');
    });

    // Global key events
    this.screen.on('keypress', (ch, key) => {
      this.emitEvent('screen:keypress', {
        ch,
        key,
        name: key?.name,
        ctrl: key?.ctrl,
        meta: key?.meta,
        shift: key?.shift
      });
    });

    // Mouse events
    this.screen.on('mouse', (data) => {
      this.emitEvent('screen:mouse', data);
    });

    this.logger.debug('Screen event listeners set up');
  }

  /**
   * Wrap event handler with context and error handling
   * @private
   * @param {Function} handler - Original handler
   * @param {Object} context - Handler context
   * @returns {Function} Wrapped handler
   */
  wrapEventHandler(handler, context) {
    return async (eventObj) => {
      try {
        // Set timeout if specified
        if (context.timeout) {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Event handler timeout')), context.timeout);
          });
          
          await Promise.race([
            Promise.resolve(handler(eventObj)),
            timeoutPromise
          ]);
        } else {
          await Promise.resolve(handler(eventObj));
        }
        
      } catch (error) {
        this.logger.error(`Event handler error for ${context.eventName}:`, error);
        
        // Emit error event
        this.emitEvent('handler:error', {
          eventName: context.eventName,
          pluginName: context.pluginName,
          error: error.message
        });
      }
    };
  }

  /**
   * Track plugin listener
   * @private
   * @param {string} pluginName - Plugin name
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   */
  trackPluginListener(pluginName, eventName, handler) {
    if (!this.pluginListeners.has(pluginName)) {
      this.pluginListeners.set(pluginName, new Set());
    }
    
    this.pluginListeners.get(pluginName).add({
      eventName,
      handler
    });
  }

  /**
   * Untrack plugin listener
   * @private
   * @param {string} pluginName - Plugin name
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   */
  untrackPluginListener(pluginName, eventName, handler) {
    if (!this.pluginListeners.has(pluginName)) {
      return;
    }
    
    const listeners = this.pluginListeners.get(pluginName);
    for (const listener of listeners) {
      if (listener.eventName === eventName && listener.handler === handler) {
        listeners.delete(listener);
        break;
      }
    }
    
    if (listeners.size === 0) {
      this.pluginListeners.delete(pluginName);
    }
  }

  /**
   * Process middleware
   * @private
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   * @param {Object} context - Event context
   * @returns {any} Processed data
   */
  processMiddleware(eventName, data, context) {
    let processedData = data;
    
    for (const middleware of this.middleware) {
      try {
        processedData = middleware(eventName, processedData, context) || processedData;
      } catch (error) {
        this.logger.error('Middleware error:', error);
      }
    }
    
    return processedData;
  }

  /**
   * Update event statistics
   * @private
   * @param {string} eventName - Event name
   */
  updateEventStats(eventName) {
    if (!this.eventStats.has(eventName)) {
      this.eventStats.set(eventName, {
        count: 0,
        lastEmitted: null
      });
    }
    
    const stats = this.eventStats.get(eventName);
    stats.count++;
    stats.lastEmitted = Date.now();
  }


}