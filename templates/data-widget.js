/**
 * {{name}} - A data-driven Orbiton widget
 * 
 * This template provides a foundation for creating widgets that fetch and display
 * dynamic data from APIs, system sources, or other external services. Includes
 * automatic update management, error handling, and caching.
 * 
 * @example
 * // Configuration in orbiton.json:
 * {
 *   "plugins": [
 *     {
 *       "name": "{{name}}",
 *       "position": [0, 0, 3, 2],
 *       "options": {
 *         "apiUrl": "https://api.example.com/data",
 *         "apiKey": "your-api-key",
 *         "updateInterval": 30000,
 *         "showDetails": true
 *       }
 *     }
 *   ]
 * }
 */

import { DataWidget } from '../src/plugins/DataWidget.js';

export default class {{className}} extends DataWidget {
  /**
   * Initialize the widget
   * Called once when the plugin is loaded
   */
  async initialize() {
    // Call parent initialization
    await super.initialize();
    
    // Set up configuration from options
    this.apiUrl = this.options.apiUrl;
    this.apiKey = this.options.apiKey;
    this.showDetails = this.options.showDetails !== false;
    
    // Validate required configuration
    if (!this.apiUrl) {
      throw new Error('apiUrl is required for {{name}} widget');
    }
    
    // Set up update interval (default 30 seconds for API calls)
    this.updateInterval = this.options.updateInterval || 30000;
    
    // Initialize cache and state
    this.cache = new Map();
    this.errorCount = 0;
    this.lastSuccessfulUpdate = null;
    
    // Start automatic updates
    this.startUpdates();
  }

  /**
   * Fetch data from external source
   * Called automatically at regular intervals
   * @returns {Promise<any>} The fetched data
   */
  async fetchData() {
    try {
      // Check cache first (optional optimization)
      const cachedData = this.getCachedData();
      if (cachedData && !this.isCacheExpired()) {
        return cachedData;
      }

      // Prepare request options
      const requestOptions = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Orbiton-Dashboard/2.0'
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      };

      // Add API key if provided
      if (this.apiKey) {
        requestOptions.headers['Authorization'] = `Bearer ${this.apiKey}`;
        // Or use query parameter: this.apiUrl += `?api_key=${this.apiKey}`;
      }

      // Make the API request
      const response = await fetch(this.apiUrl, requestOptions);

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse JSON response
      const data = await response.json();

      // Validate response structure (optional)
      if (!this.isValidResponse(data)) {
        throw new Error('Invalid response format from API');
      }

      // Cache the successful response
      this.cacheData(data);
      
      // Reset error count on successful fetch
      this.errorCount = 0;
      this.lastSuccessfulUpdate = new Date();

      return data;

    } catch (error) {
      // Handle different types of errors
      this.handleFetchError(error);
      
      // Return cached data if available, otherwise null
      return this.getCachedData() || null;
    }
  }

  /**
   * Render the widget content
   * Called after data is fetched or when manual updates are triggered
   */
  async render() {
    if (!this.element) return;

    // Handle different states
    if (this.hasError && !this.data) {
      this.renderError();
      return;
    }

    if (!this.data) {
      this.renderLoading();
      return;
    }

    // Render the actual data
    this.renderData();
  }

  /**
   * Render loading state
   */
  renderLoading() {
    const content = `{center}{bold}{{name}}{/bold}{/center}
{center}{yellow-fg}Loading data...{/yellow-fg}{/center}
{center}{dim}Please wait{/dim}{/center}`;
    
    this.element.setContent(content);
  }

  /**
   * Render error state
   */
  renderError() {
    const content = `{center}{bold}{{name}}{/bold}{/center}
{center}{red-fg}Error loading data{/red-fg}{/center}
{center}{dim}${this.errorMessage || 'Unknown error'}{/dim}{/center}
{center}{dim}Retrying... (${this.errorCount} failures){/dim}{/center}`;
    
    this.element.setContent(content);
  }

  /**
   * Render the actual data
   */
  renderData() {
    const theme = this.getTheme();
    const lastUpdate = this.lastSuccessfulUpdate 
      ? this.formatTime(this.lastSuccessfulUpdate)
      : 'Never';

    // Build content based on your data structure
    let content = `{center}{bold}{{name}}{/bold}{/center}\n`;
    
    // Example: Display key metrics from the data
    if (this.data.status) {
      const statusColor = this.data.status === 'ok' ? 'green' : 'red';
      content += `Status: {${statusColor}-fg}${this.data.status.toUpperCase()}{/${statusColor}-fg}\n`;
    }

    if (this.data.value !== undefined) {
      content += `Value: {${theme.accent}-fg}${this.data.value}{/${theme.accent}-fg}\n`;
    }

    if (this.showDetails && this.data.details) {
      content += `\n{dim}Details:{/dim}\n`;
      content += `{dim}${JSON.stringify(this.data.details, null, 2)}{/dim}\n`;
    }

    // Add timestamp
    content += `\n{center}{dim}Updated: ${lastUpdate}{/dim}{/center}`;

    this.element.setContent(content);
  }

  /**
   * Handle fetch errors with appropriate logging and recovery
   * @param {Error} error The error that occurred
   */
  handleFetchError(error) {
    this.errorCount++;
    this.hasError = true;
    
    // Log different types of errors appropriately
    if (error.name === 'AbortError') {
      this.errorMessage = 'Request timeout';
      console.warn(`{{name}}: Request timeout (attempt ${this.errorCount})`);
    } else if (error.message.includes('HTTP')) {
      this.errorMessage = `API Error: ${error.message}`;
      console.error(`{{name}}: API error - ${error.message}`);
    } else if (error.message.includes('fetch')) {
      this.errorMessage = 'Network error';
      console.error(`{{name}}: Network error - ${error.message}`);
    } else {
      this.errorMessage = error.message;
      console.error(`{{name}}: Unexpected error - ${error.message}`);
    }

    // Implement exponential backoff for retries
    if (this.errorCount > 3) {
      // Slow down updates after multiple failures
      this.updateInterval = Math.min(this.updateInterval * 1.5, 300000); // Max 5 minutes
    }
  }

  /**
   * Validate the API response structure
   * @param {any} data The response data to validate
   * @returns {boolean} Whether the response is valid
   */
  isValidResponse(data) {
    // Implement your validation logic here
    // Example: Check for required fields
    return data && typeof data === 'object';
  }

  /**
   * Cache data with timestamp
   * @param {any} data Data to cache
   */
  cacheData(data) {
    this.cache.set('data', {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached data if available
   * @returns {any|null} Cached data or null
   */
  getCachedData() {
    const cached = this.cache.get('data');
    return cached ? cached.data : null;
  }

  /**
   * Check if cached data is expired
   * @returns {boolean} Whether cache is expired
   */
  isCacheExpired() {
    const cached = this.cache.get('data');
    if (!cached) return true;
    
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = this.updateInterval * 0.8; // Cache for 80% of update interval
    
    return cacheAge > maxAge;
  }

  /**
   * Format timestamp for display
   * @param {Date} date Date to format
   * @returns {string} Formatted time string
   */
  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Clean up resources when widget is destroyed
   */
  async destroy() {
    // Clear cache
    this.cache.clear();
    
    // Call parent cleanup (stops updates)
    await super.destroy();
  }

  /**
   * Define the configuration schema for this widget
   * @returns {object} JSON Schema for widget options
   */
  getOptionsSchema() {
    return {
      type: 'object',
      required: ['apiUrl'],
      properties: {
        apiUrl: {
          type: 'string',
          description: 'API endpoint URL to fetch data from',
          format: 'uri'
        },
        apiKey: {
          type: 'string',
          description: 'API key for authentication (optional)',
          minLength: 1
        },
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          minimum: 5000,
          default: 30000
        },
        showDetails: {
          type: 'boolean',
          description: 'Whether to show detailed information',
          default: true
        }
      }
    };
  }

  /**
   * Get layout hints for the dashboard
   * @returns {object} Layout preferences
   */
  getLayoutHints() {
    return {
      minWidth: 25,
      minHeight: 8,
      preferredWidth: 30,
      preferredHeight: 12,
      canResize: true
    };
  }
}