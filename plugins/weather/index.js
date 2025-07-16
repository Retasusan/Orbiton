/**
 * @fileoverview Weather Widget Plugin
 * 
 * A comprehensive weather widget that displays current weather conditions
 * and forecast using the new DataWidget system.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { DataWidget } from '../../src/plugins/DataWidget.js';
import blessed from 'blessed';
import contrib from 'blessed-contrib';

/**
 * Weather widget that displays current weather and forecast
 */
export default class WeatherWidget extends DataWidget {
  constructor(name, options = {}, context = {}) {
    super(name, options, context);
    
    // Widget-specific properties
    this.currentWeatherBox = null;
    this.forecastLine = null;
    
    // Weather API configuration
    this.apiBase = 'https://api.openweathermap.org/data/2.5';
    
    // Weather data cache
    this.weatherData = {
      current: null,
      forecast: [],
      lastFetch: null
    };
  }

  /**
   * Get options schema for validation
   * @returns {Object} JSON schema for options
   */
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: 'Weather'
        },
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          minimum: 300000, // Minimum 5 minutes to respect API limits
          default: 600000 // 10 minutes
        },
        location: {
          type: 'string',
          description: 'Location for weather data (city,country format)',
          default: 'Tokyo,JP'
        },
        apiKey: {
          type: 'string',
          description: 'OpenWeatherMap API key (required)'
        },
        units: {
          type: 'string',
          enum: ['metric', 'imperial', 'kelvin'],
          description: 'Temperature units',
          default: 'metric'
        },
        language: {
          type: 'string',
          description: 'Language for weather descriptions',
          default: 'en'
        },
        showForecast: {
          type: 'boolean',
          description: 'Whether to show forecast chart',
          default: true
        },
        forecastHours: {
          type: 'number',
          description: 'Number of forecast hours to display',
          minimum: 1,
          maximum: 24,
          default: 8
        }
      },
      required: ['apiKey']
    };
  }

  /**
   * Get default options
   * @returns {Object} Default options
   */
  getDefaultOptions() {
    return {
      title: 'Weather',
      updateInterval: 600000,
      location: 'Tokyo,JP',
      units: 'metric',
      language: 'en',
      showForecast: true,
      forecastHours: 8
    };
  }

  /**
   * Perform widget-specific initialization
   * @returns {Promise<void>}
   */
  async performInitialization() {
    this.logger.debug('Initializing weather widget');
    
    if (!this.options.apiKey) {
      throw new Error('OpenWeatherMap API key is required');
    }
    
    this.logger.debug(`Weather location: ${this.options.location}`);
  }

  /**
   * Create the main UI element
   * @returns {Promise<void>}
   */
  async createElement() {
    // Create main container
    this.element = blessed.box({
      label: `${this.options.title} (${this.options.location})`,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: this.theme.border || 'cyan' },
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      scrollable: false,
      mouse: true,
      keys: true
    });

    // Create current weather display area
    this.currentWeatherBox = blessed.box({
      parent: this.element,
      top: '0%',
      left: '2.5%',
      width: '95%',
      height: '25%',
      tags: true,
      style: {
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      }
    });

    // Create forecast chart if enabled
    if (this.options.showForecast) {
      this.forecastLine = contrib.line({
        parent: this.element,
        label: 'Weather Forecast (Temp, Precip, Wind)',
        showLegend: true,
        legend: { width: 18 },
        top: '25%',
        left: '0%',
        width: '100%',
        height: '75%',
        style: {
          line: 'yellow',
          text: 'white',
          baseline: 'black'
        }
      });
    }
  }

  /**
   * Fetch weather data
   * @returns {Promise<Object>} Weather data
   */
  async fetchData() {
    try {
      const [current, forecast] = await Promise.all([
        this.fetchCurrentWeather(),
        this.options.showForecast ? this.fetchWeatherForecast() : null
      ]);

      const data = {
        current,
        forecast: forecast || [],
        lastFetch: new Date()
      };

      this.weatherData = data;
      return data;

    } catch (error) {
      this.logger.error('Failed to fetch weather data:', error);
      throw error;
    }
  }

  /**
   * Fetch current weather data
   * @returns {Promise<Object>} Current weather data
   */
  async fetchCurrentWeather() {
    const url = `${this.apiBase}/weather?q=${encodeURIComponent(this.options.location)}&appid=${this.options.apiKey}&units=${this.options.units}&lang=${this.options.language}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch current weather (status: ${response.status})`);
    }

    return await response.json();
  }

  /**
   * Fetch weather forecast data
   * @returns {Promise<Object>} Weather forecast data
   */
  async fetchWeatherForecast() {
    const url = `${this.apiBase}/forecast?q=${encodeURIComponent(this.options.location)}&appid=${this.options.apiKey}&units=${this.options.units}&lang=${this.options.language}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch weather forecast (status: ${response.status})`);
    }

    const data = await response.json();
    return data.list.slice(0, this.options.forecastHours);
  }

  /**
   * Update widget content with fetched data
   * @returns {Promise<void>}
   */
  async updateContent() {
    if (!this.data) return;

    try {
      // Update current weather display
      this.updateCurrentWeather();
      
      // Update forecast chart if enabled
      if (this.options.showForecast && this.forecastLine) {
        this.updateForecastChart();
      }
      
    } catch (error) {
      this.logger.error('Failed to update content:', error);
      this.showErrorState(error);
    }
  }

  /**
   * Update current weather display
   */
  updateCurrentWeather() {
    if (!this.currentWeatherBox || !this.data.current) return;

    const { current } = this.data;
    const { main, wind, weather, dt, name } = current;

    const weatherDesc = weather[0]?.description || 'Unknown';
    const currentTime = new Date(dt * 1000).toLocaleString();
    const tempUnit = this.getTemperatureUnit();
    const windUnit = this.getWindUnit();

    let content = `{bold}${name} - ${currentTime}{/bold}\n`;
    content += `Weather: {cyan-fg}${weatherDesc}{/cyan-fg}\n`;
    content += `Temperature: {green-fg}${main.temp.toFixed(1)}${tempUnit}{/green-fg}`;
    
    if (main.feels_like !== undefined) {
      content += ` (feels like {yellow-fg}${main.feels_like.toFixed(1)}${tempUnit}{/yellow-fg})`;
    }
    
    content += `\n`;
    content += `Humidity: {blue-fg}${main.humidity}%{/blue-fg}\n`;
    
    if (wind && wind.speed !== undefined) {
      content += `Wind Speed: {magenta-fg}${wind.speed.toFixed(1)} ${windUnit}{/magenta-fg}`;
      
      if (wind.deg !== undefined) {
        content += ` (${this.getWindDirection(wind.deg)})`;
      }
    }

    this.currentWeatherBox.setContent(content);
  }

  /**
   * Update forecast chart
   */
  updateForecastChart() {
    if (!this.forecastLine || !this.data.forecast) return;

    const { forecast } = this.data;
    
    const hours = [];
    const temps = [];
    const precipitation = [];
    const winds = [];

    for (const item of forecast) {
      const date = new Date(item.dt * 1000);
      hours.push(`${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}h`);
      temps.push(Math.round(item.main.temp));
      precipitation.push(Math.round((item.pop || 0) * 100));
      winds.push(Math.round(item.wind?.speed * 10) || 0); // Scale wind for visibility
    }

    const chartData = [
      {
        title: `Temp (${this.getTemperatureUnit()})`,
        x: hours,
        y: temps,
        style: { line: 'green' }
      },
      {
        title: 'Precip (%)',
        x: hours,
        y: precipitation,
        style: { line: 'blue' }
      },
      {
        title: 'Wind (x10)',
        x: hours,
        y: winds,
        style: { line: 'cyan' }
      }
    ];

    this.forecastLine.setData(chartData);
  }

  /**
   * Get temperature unit symbol
   * @returns {string} Temperature unit
   */
  getTemperatureUnit() {
    switch (this.options.units) {
      case 'imperial': return '°F';
      case 'kelvin': return 'K';
      default: return '°C';
    }
  }

  /**
   * Get wind speed unit
   * @returns {string} Wind speed unit
   */
  getWindUnit() {
    switch (this.options.units) {
      case 'imperial': return 'mph';
      default: return 'm/s';
    }
  }

  /**
   * Get wind direction from degrees
   * @param {number} degrees - Wind direction in degrees
   * @returns {string} Wind direction
   */
  getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  /**
   * Show error state in the widget
   * @param {Error} error - The error to display
   */
  showErrorState(error) {
    let errorContent = `{red-fg}Failed to fetch weather data: ${error.message}{/red-fg}\n\n`;
    
    if (error.message.includes('status: 401')) {
      errorContent += `{yellow-fg}Invalid API key. Please check your OpenWeatherMap API key.{/yellow-fg}\n`;
    } else if (error.message.includes('status: 404')) {
      errorContent += `{yellow-fg}Location '${this.options.location}' not found.{/yellow-fg}\n`;
    } else if (error.message.includes('status: 429')) {
      errorContent += `{yellow-fg}API rate limit exceeded. Please wait before retrying.{/yellow-fg}\n`;
    }
    
    errorContent += `{gray-fg}Press 'r' to retry{/gray-fg}`;
    
    if (this.currentWeatherBox) {
      this.currentWeatherBox.setContent(errorContent);
    }

    if (this.forecastLine) {
      this.forecastLine.setData([]);
    }
  }

  /**
   * Perform widget-specific cleanup
   * @returns {Promise<void>}
   */
  async performDestroy() {
    // Clear references
    this.currentWeatherBox = null;
    this.forecastLine = null;
    
    // Clear data cache
    this.weatherData = null;
    
    this.logger.debug('Weather widget cleanup completed');
  }

  /**
   * Set up event handlers for the widget
   * @protected
   */
  setupEventHandlers() {
    super.setupEventHandlers();
    
    if (!this.element) return;
    
    // Add weather-specific key handlers
    this.element.key(['u'], () => {
      // Toggle temperature units
      const units = ['metric', 'imperial', 'kelvin'];
      const currentIndex = units.indexOf(this.options.units);
      this.options.units = units[(currentIndex + 1) % units.length];
      
      this.updateContent();
      if (this.element.screen) this.element.screen.render();
    });
    
    this.element.key(['f'], () => {
      // Toggle forecast display
      this.options.showForecast = !this.options.showForecast;
      
      if (this.forecastLine) {
        this.forecastLine.toggle();
        if (this.element.screen) this.element.screen.render();
      }
    });
  }
}