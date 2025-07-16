/**
 * @fileoverview DataWidget - Base class for data-driven widgets
 * 
 * This class extends BaseWidget to provide automatic data fetching,
 * caching, and update management for widgets that display dynamic content.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { BaseWidget } from './BaseWidget.js';
import { PluginError, NetworkError } from '../utils/Errors.js';

/**
 * Data widget class for widgets that fetch and display dynamic data
 * 
 * @example
 * ```javascript
 * import { DataWidget } from 'orbiton';
 * 
 * export default class WeatherWidget extends DataWidget {
 *   async fetchData() {
 *     const response = await fetch('https://api.weather.com/current');
 *     return await response.json();
 *   }
 * 
 *   async render() {
 *     const weather = this.data;
 *     this.element = blessed.box({
 *       label: 'Weather',
 *       content: `Temperature: ${weather.temp}°C`
 *     });
 *   }
 * }
 * ```
 */
export class DataWidget extends BaseWidget {
  /**
   * Create a new data widget instance
   * @param {string} name - Widget name
   * @param {Object} options - Widget configuration options
   * @param {Object} context - Widget context
   */
  constructor(name, options = {}, context = {}) {
    super(name, options, context);
    
    // Data management
    this.data = null;
    this.lastUpdate = null;
    this.lastFetchTime = null;
    this.fetchErrors = 0;
    this.maxFetchErrors = 3;
    
    // Caching
    this.dataCache = new Map();
    this.cacheTimeout = options.cacheTimeout || 60000; // 1 minute default
    
    // Update management
    this.updateInterval = options.updateInterval || 5000; // 5 seconds default
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
    
    // State tracking
    this.isLoading = false;
    this.hasData = false;
    this.lastError = null;
  }

  /**
   * Initialize the data widget
   * Performs initial data fetch and sets up automatic updates
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await super.initialize();
      
      this.logger.info(`Initializing data widget: ${this.name}`);
      
      // Perform widget-specific initialization
      await this.performInitialization();
      
      // Perform initial data fetch
      await this.initialDataFetch();
      
      // Start automatic updates if enabled
      if (this.options.autoUpdate !== false) {
        this.startUpdates(this.updateInterval);
      }
      
    } catch (error) {
      this.handleError(new PluginError(this.name, 'Data widget initialization failed', error));
      // Don't throw - allow widget to render in error state
    }
  }

  /**
   * Perform initial data fetch with error handling
   * @private
   */
  async initialDataFetch() {
    try {
      this.isLoading = true;
      await this.fetchData();
      this.hasData = true;
      this.lastError = null;
    } catch (error) {
      this.logger.warn(`Initial data fetch failed for ${this.name}, will retry:`, error);
      this.lastError = error;
      // Don't throw - widget should still render with error state
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Fetch data from external source
   * This method should be overridden by subclasses
   * 
   * @returns {Promise<any>} Fetched data
   * @throws {Error} If data fetching fails
   */
  async fetchData() {
    try {
      this.logger.debug(`Fetching data for ${this.name}`);
      const startTime = Date.now();
      
      // Check cache first
      if (this.isCacheValid()) {
        this.logger.debug('Using cached data');
        return this.data;
      }

      // Set loading state
      this.isLoading = true;
      
      // Perform data fetch with retry logic
      const newData = await this.fetchWithRetry();
      
      // Validate and process data
      const processedData = await this.processData(newData);
      
      // Update widget state
      this.data = processedData;
      this.lastUpdate = new Date();
      this.lastFetchTime = Date.now();
      this.fetchErrors = 0;
      this.hasData = true;
      this.lastError = null;
      
      // Cache the data
      this.cacheData(processedData);
      
      // Log timing
      this.logger.timing(`Data fetch for ${this.name}`, startTime);
      
      // Emit data updated event
      this.emit('dataUpdated', this.data);
      
      return this.data;
      
    } catch (error) {
      this.fetchErrors++;
      this.lastError = error;
      
      this.logger.error(`Failed to fetch data for ${this.name} (attempt ${this.fetchErrors}):`, error);
      
      // Use cached data if available and not too old
      if (this.data && this.shouldUseCachedDataOnError()) {
        this.logger.warn('Using stale cached data due to fetch error');
        this.emit('dataError', error, this.data);
        return this.data;
      }
      
      // Set error state
      this.data = { 
        error: error.message, 
        timestamp: Date.now(),
        isError: true 
      };
      
      this.emit('dataError', error, null);
      throw error;
      
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Fetch data with retry logic
   * @private
   * @returns {Promise<any>} Raw data
   */
  async fetchWithRetry() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.performDataFetch();
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts) {
          this.logger.debug(`Fetch attempt ${attempt} failed, retrying in ${this.retryDelay}ms`);
          await this.sleep(this.retryDelay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Perform the actual data fetching
   * Override this method in subclasses to implement data source
   * 
   * @returns {Promise<any>} Raw data from source
   * @throws {Error} If data fetching fails
   */
  async performDataFetch() {
    throw new Error('performDataFetch() must be implemented by subclass');
  }

  /**
   * Process and validate fetched data
   * Override this method to customize data processing
   * 
   * @param {any} rawData - Raw data from source
   * @returns {Promise<any>} Processed data
   */
  async processData(rawData) {
    // Default implementation - just return the data
    // Subclasses can override for custom processing
    return rawData;
  }

  /**
   * Check if cached data is still valid
   * @returns {boolean} Whether cache is valid
   */
  isCacheValid() {
    if (!this.lastFetchTime || !this.data || this.data.isError) {
      return false;
    }
    
    const age = Date.now() - this.lastFetchTime;
    return age < this.cacheTimeout;
  }

  /**
   * Check if we should use cached data when fetch fails
   * @returns {boolean} Whether to use cached data
   */
  shouldUseCachedDataOnError() {
    if (!this.data || this.data.isError) {
      return false;
    }
    
    // Use cached data if it's not too old (2x cache timeout)
    const age = Date.now() - this.lastFetchTime;
    return age < (this.cacheTimeout * 2);
  }

  /**
   * Cache data for future use
   * @param {any} data - Data to cache
   */
  cacheData(data) {
    const cacheKey = `${this.name}_data`;
    this.dataCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Clean up old cache entries
   * @private
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = this.cacheTimeout * 3; // Keep cache 3x longer than timeout
    
    for (const [key, entry] of this.dataCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.dataCache.delete(key);
      }
    }
  }

  /**
   * Update the widget with fresh data
   * @returns {Promise<void>}
   */
  async update() {
    if (!this.isRendered || this.isDestroyed) {
      return;
    }

    try {
      this.logger.debug(`Updating data widget: ${this.name}`);
      const startTime = Date.now();

      // Fetch fresh data
      await this.fetchData();
      
      // Update content
      await this.performUpdate();
      
      // Log timing
      this.logger.timing(`Data widget ${this.name} update`, startTime);
      
      // Emit update event
      this.emit('updated');
      
    } catch (error) {
      this.handleError(new PluginError(this.name, 'Data update failed', error));
    }
  }

  /**
   * Get current data status
   * @returns {Object} Data status information
   */
  getDataStatus() {
    return {
      hasData: this.hasData,
      isLoading: this.isLoading,
      lastUpdate: this.lastUpdate,
      lastFetchTime: this.lastFetchTime,
      fetchErrors: this.fetchErrors,
      lastError: this.lastError?.message,
      cacheValid: this.isCacheValid(),
      dataAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : null
    };
  }

  /**
   * Force refresh data (bypass cache)
   * @returns {Promise<void>}
   */
  async refresh() {
    this.logger.info(`Force refreshing data for ${this.name}`);
    
    // Clear cache
    this.dataCache.clear();
    this.lastFetchTime = null;
    
    // Fetch fresh data
    await this.fetchData();
    
    // Re-render if widget is rendered
    if (this.isRendered) {
      await this.render();
    }
  }

  /**
   * Pause data updates
   */
  pauseUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    super.pauseUpdates();
    this.logger.debug(`Paused data updates for ${this.name}`);
  }

  /**
   * Resume data updates
   */
  resumeUpdates() {
    super.resumeUpdates();
    
    // Restart updates if they were running before
    if (!this.updateTimer && this.isInitialized && !this.isDestroyed) {
      this.startUpdates();
    }
    
    this.logger.debug(`Resumed data updates for ${this.name}`);
  }

  /**
   * Stop data updates and clear cache
   */
  stopUpdates() {
    super.stopUpdates();
    this.dataCache.clear();
    this.logger.debug(`Stopped data updates for ${this.name}`);
  }

  /**
   * Clean up resources when widget is destroyed
   * @returns {Promise<void>}
   */
  async destroy() {
    try {
      this.logger.info(`Destroying data widget: ${this.name}`);
      
      // Stop updates
      this.stopUpdates();
      
      // Clear cache
      this.dataCache.clear();
      
      // Reset data state
      this.data = null;
      this.hasData = false;
      this.isLoading = false;
      
      // Call parent destroy
      await super.destroy();
      
    } catch (error) {
      this.logger.error(`Error destroying data widget ${this.name}:`, error);
    }
  }

  /**
   * Get default options for data widgets
   * @protected
   * @returns {Object} Default options
   */
  getDefaultOptions() {
    return {
      ...super.getDefaultOptions(),
      updateInterval: 10000,
      cacheTimeout: 60000,
      retryAttempts: 3,
      retryDelay: 5000,
      autoUpdate: true
    };
  }

  /**
   * Get options schema for data widgets
   * @returns {Object} JSON schema
   */
  getOptionsSchema() {
    const baseSchema = super.getOptionsSchema();
    
    return {
      ...baseSchema,
      properties: {
        ...baseSchema.properties,
        updateInterval: {
          type: 'number',
          description: 'Data update interval in milliseconds',
          minimum: 1000,
          default: 10000
        },
        cacheTimeout: {
          type: 'number',
          description: 'Cache timeout in milliseconds',
          minimum: 1000,
          default: 60000
        },
        retryAttempts: {
          type: 'number',
          description: 'Number of retry attempts on failure',
          minimum: 0,
          maximum: 10,
          default: 3
        },
        retryDelay: {
          type: 'number',
          description: 'Delay between retry attempts in milliseconds',
          minimum: 1000,
          default: 5000
        },
        autoUpdate: {
          type: 'boolean',
          description: 'Enable automatic data updates',
          default: true
        }
      }
    };
  }

  /**
   * Get widget status including data status
   * @returns {Object} Complete widget status
   */
  getStatus() {
    return {
      ...super.getStatus(),
      data: this.getDataStatus()
    };
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}