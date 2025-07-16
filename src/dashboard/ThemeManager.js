/**
 * @fileoverview Theme Manager
 * 
 * Manages dashboard themes with plugin-aware styling, theme inheritance,
 * customization, and validation.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';
import { ValidationError, FileSystemError } from '../utils/Errors.js';

/**
 * Theme manager for dashboard styling
 */
export class ThemeManager {
  constructor(options = {}) {
    this.logger = new Logger('theme-manager');
    
    // Theme configuration
    this.config = {
      themesDir: options.themesDir || './themes',
      defaultTheme: options.defaultTheme || 'default',
      enableCustomThemes: options.enableCustomThemes !== false,
      enablePluginThemes: options.enablePluginThemes !== false,
      cacheThemes: options.cacheThemes !== false,
      ...options
    };
    
    // Theme state
    this.currentTheme = null;
    this.themes = new Map(); // theme name -> theme data
    this.themeCache = new Map(); // theme name -> compiled CSS
    this.pluginThemes = new Map(); // plugin name -> theme overrides
    
    // Built-in themes
    this.builtInThemes = new Map();
    this.registerBuiltInThemes();
    
    // CSS variables and custom properties
    this.cssVariables = new Map();
    this.customProperties = new Map();
    
    // Theme validation schema
    this.themeSchema = this.createThemeSchema();
  }

  /**
   * Initialize the theme manager
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info('Initializing theme manager');
    
    try {
      // Load available themes
      await this.loadThemes();
      
      // Set default theme
      await this.setTheme(this.config.defaultTheme);
      
      this.logger.info(`Theme manager initialized with ${this.themes.size} themes`);
      
    } catch (error) {
      this.logger.error('Failed to initialize theme manager:', error);
      
      // Fall back to built-in default theme
      await this.setTheme('default');
    }
  }

  /**
   * Load all available themes
   * @returns {Promise<void>}
   */
  async loadThemes() {
    // Load built-in themes
    for (const [name, theme] of this.builtInThemes) {
      this.themes.set(name, theme);
    }
    
    // Load themes from directory
    if (this.config.enableCustomThemes) {
      await this.loadThemesFromDirectory();
    }
    
    this.logger.debug(`Loaded ${this.themes.size} themes`);
  }

  /**
   * Set the current theme
   * @param {string} themeName - Theme name
   * @param {Object} options - Theme options
   * @returns {Promise<void>}
   */
  async setTheme(themeName, options = {}) {
    try {
      this.logger.info(`Setting theme: ${themeName}`);
      
      // Get theme data
      const theme = await this.getTheme(themeName);
      if (!theme) {
        throw new Error(`Theme not found: ${themeName}`);
      }
      
      // Validate theme
      const validation = this.validateTheme(theme);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid theme: ${validation.errors.join(', ')}`);
      }
      
      // Apply theme
      await this.applyTheme(theme, options);
      
      this.currentTheme = theme;
      this.logger.info(`Theme applied successfully: ${themeName}`);
      
    } catch (error) {
      this.logger.error(`Failed to set theme ${themeName}:`, error);
      throw error;
    }
  }

  /**
   * Get theme by name
   * @param {string} themeName - Theme name
   * @returns {Promise<Object|null>} Theme data
   */
  async getTheme(themeName) {
    // Check cache first
    if (this.themes.has(themeName)) {
      return this.themes.get(themeName);
    }
    
    // Try to load theme dynamically
    if (this.config.enableCustomThemes) {
      const theme = await this.loadThemeFromFile(themeName);
      if (theme) {
        this.themes.set(themeName, theme);
        return theme;
      }
    }
    
    return null;
  }

  /**
   * Get current theme
   * @returns {Object|null} Current theme data
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * List available themes
   * @returns {Array<Object>} Available themes
   */
  listThemes() {
    return Array.from(this.themes.entries()).map(([name, theme]) => ({
      name,
      displayName: theme.displayName || name,
      description: theme.description || '',
      author: theme.author || 'Unknown',
      version: theme.version || '1.0.0',
      isBuiltIn: this.builtInThemes.has(name),
      isActive: this.currentTheme?.name === name
    }));
  }

  /**
   * Create a custom theme
   * @param {string} themeName - Theme name
   * @param {Object} themeData - Theme data
   * @returns {Promise<void>}
   */
  async createTheme(themeName, themeData) {
    try {
      this.logger.info(`Creating custom theme: ${themeName}`);
      
      // Validate theme data
      const validation = this.validateTheme(themeData);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid theme data: ${validation.errors.join(', ')}`);
      }
      
      // Add metadata
      const theme = {
        ...themeData,
        name: themeName,
        isCustom: true,
        created: new Date().toISOString()
      };
      
      // Save theme
      if (this.config.enableCustomThemes) {
        await this.saveThemeToFile(themeName, theme);
      }
      
      // Register theme
      this.themes.set(themeName, theme);
      
      this.logger.info(`Custom theme created: ${themeName}`);
      
    } catch (error) {
      this.logger.error(`Failed to create theme ${themeName}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing theme
   * @param {string} themeName - Theme name
   * @param {Object} updates - Theme updates
   * @returns {Promise<void>}
   */
  async updateTheme(themeName, updates) {
    const theme = await this.getTheme(themeName);
    if (!theme) {
      throw new Error(`Theme not found: ${themeName}`);
    }
    
    if (this.builtInThemes.has(themeName)) {
      throw new Error(`Cannot modify built-in theme: ${themeName}`);
    }
    
    // Merge updates
    const updatedTheme = {
      ...theme,
      ...updates,
      modified: new Date().toISOString()
    };
    
    // Validate updated theme
    const validation = this.validateTheme(updatedTheme);
    if (!validation.isValid) {
      throw new ValidationError(`Invalid theme updates: ${validation.errors.join(', ')}`);
    }
    
    // Save and register
    if (this.config.enableCustomThemes) {
      await this.saveThemeToFile(themeName, updatedTheme);
    }
    
    this.themes.set(themeName, updatedTheme);
    
    // Reapply if current theme
    if (this.currentTheme?.name === themeName) {
      await this.applyTheme(updatedTheme);
    }
    
    this.logger.info(`Theme updated: ${themeName}`);
  }

  /**
   * Delete a custom theme
   * @param {string} themeName - Theme name
   * @returns {Promise<boolean>} Whether theme was deleted
   */
  async deleteTheme(themeName) {
    if (this.builtInThemes.has(themeName)) {
      throw new Error(`Cannot delete built-in theme: ${themeName}`);
    }
    
    if (!this.themes.has(themeName)) {
      return false;
    }
    
    // Remove theme file
    if (this.config.enableCustomThemes) {
      try {
        const themePath = path.join(this.config.themesDir, `${themeName}.json`);
        await fs.unlink(themePath);
      } catch (error) {
        this.logger.warn(`Failed to delete theme file for ${themeName}:`, error);
      }
    }
    
    // Remove from registry
    this.themes.delete(themeName);
    this.themeCache.delete(themeName);
    
    // Switch to default theme if current theme was deleted
    if (this.currentTheme?.name === themeName) {
      await this.setTheme(this.config.defaultTheme);
    }
    
    this.logger.info(`Theme deleted: ${themeName}`);
    return true;
  }

  /**
   * Register plugin theme overrides
   * @param {string} pluginName - Plugin name
   * @param {Object} themeOverrides - Theme overrides
   */
  registerPluginTheme(pluginName, themeOverrides) {
    if (!this.config.enablePluginThemes) {
      return;
    }
    
    this.pluginThemes.set(pluginName, themeOverrides);
    
    // Reapply current theme to include plugin overrides
    if (this.currentTheme) {
      this.applyTheme(this.currentTheme);
    }
    
    this.logger.debug(`Plugin theme registered: ${pluginName}`);
  }

  /**
   * Unregister plugin theme overrides
   * @param {string} pluginName - Plugin name
   */
  unregisterPluginTheme(pluginName) {
    if (this.pluginThemes.delete(pluginName)) {
      // Reapply current theme without plugin overrides
      if (this.currentTheme) {
        this.applyTheme(this.currentTheme);
      }
      
      this.logger.debug(`Plugin theme unregistered: ${pluginName}`);
    }
  }

  /**
   * Get theme CSS variables
   * @param {string} themeName - Theme name (optional, uses current theme)
   * @returns {Promise<Object>} CSS variables
   */
  async getThemeVariables(themeName = null) {
    const theme = themeName ? await this.getTheme(themeName) : this.currentTheme;
    if (!theme) {
      return {};
    }
    
    return this.extractCSSVariables(theme);
  }

  /**
   * Apply theme to DOM
   * @private
   * @param {Object} theme - Theme data
   * @param {Object} options - Apply options
   * @returns {Promise<void>}
   */
  async applyTheme(theme, options = {}) {
    try {
      // Generate CSS
      const css = await this.generateThemeCSS(theme);
      
      // Apply CSS to document
      this.applyCSSToDocument(css, theme.name);
      
      // Apply CSS variables
      this.applyCSSVariables(theme);
      
      // Apply plugin theme overrides
      if (this.config.enablePluginThemes) {
        this.applyPluginThemeOverrides(theme);
      }
      
      // Cache compiled CSS
      if (this.config.cacheThemes) {
        this.themeCache.set(theme.name, css);
      }
      
      // Emit theme change event
      this.emitThemeChange(theme);
      
    } catch (error) {
      this.logger.error(`Failed to apply theme ${theme.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate CSS from theme data
   * @private
   * @param {Object} theme - Theme data
   * @returns {Promise<string>} Generated CSS
   */
  async generateThemeCSS(theme) {
    // Check cache first
    if (this.config.cacheThemes && this.themeCache.has(theme.name)) {
      return this.themeCache.get(theme.name);
    }
    
    let css = '';
    
    // Root variables
    if (theme.variables) {
      css += ':root {\n';
      for (const [key, value] of Object.entries(theme.variables)) {
        css += `  --${key}: ${value};\n`;
      }
      css += '}\n\n';
    }
    
    // Base styles
    if (theme.styles) {
      css += this.generateCSSFromStyles(theme.styles);
    }
    
    // Component styles
    if (theme.components) {
      for (const [component, styles] of Object.entries(theme.components)) {
        css += `.${component} {\n`;
        css += this.generateCSSFromStyles(styles, '  ');
        css += '}\n\n';
      }
    }
    
    // Widget styles
    if (theme.widgets) {
      for (const [widget, styles] of Object.entries(theme.widgets)) {
        css += `.widget-${widget} {\n`;
        css += this.generateCSSFromStyles(styles, '  ');
        css += '}\n\n';
      }
    }
    
    return css;
  }

  /**
   * Generate CSS from styles object
   * @private
   * @param {Object} styles - Styles object
   * @param {string} indent - Indentation
   * @returns {string} CSS string
   */
  generateCSSFromStyles(styles, indent = '') {
    let css = '';
    
    for (const [property, value] of Object.entries(styles)) {
      if (typeof value === 'object' && value !== null) {
        // Nested selector
        css += `${indent}${property} {\n`;
        css += this.generateCSSFromStyles(value, indent + '  ');
        css += `${indent}}\n`;
      } else {
        // CSS property
        const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `${indent}${cssProperty}: ${value};\n`;
      }
    }
    
    return css;
  }

  /**
   * Apply CSS to document
   * @private
   * @param {string} css - CSS string
   * @param {string} themeName - Theme name
   */
  applyCSSToDocument(css, themeName) {
    // Remove existing theme styles
    const existingStyle = document.getElementById('orbiton-theme-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Create new style element
    const styleElement = document.createElement('style');
    styleElement.id = 'orbiton-theme-styles';
    styleElement.setAttribute('data-theme', themeName);
    styleElement.textContent = css;
    
    // Add to document head
    document.head.appendChild(styleElement);
  }

  /**
   * Apply CSS variables
   * @private
   * @param {Object} theme - Theme data
   */
  applyCSSVariables(theme) {
    if (!theme.variables) {
      return;
    }
    
    const root = document.documentElement;
    
    // Clear existing variables
    for (const [key] of this.cssVariables) {
      root.style.removeProperty(`--${key}`);
    }
    this.cssVariables.clear();
    
    // Apply new variables
    for (const [key, value] of Object.entries(theme.variables)) {
      root.style.setProperty(`--${key}`, value);
      this.cssVariables.set(key, value);
    }
  }

  /**
   * Apply plugin theme overrides
   * @private
   * @param {Object} theme - Base theme
   */
  applyPluginThemeOverrides(theme) {
    for (const [pluginName, overrides] of this.pluginThemes) {
      try {
        // Apply plugin-specific CSS variables
        if (overrides.variables) {
          const root = document.documentElement;
          for (const [key, value] of Object.entries(overrides.variables)) {
            root.style.setProperty(`--plugin-${pluginName}-${key}`, value);
          }
        }
        
        // Apply plugin-specific styles
        if (overrides.styles) {
          const css = this.generateCSSFromStyles(overrides.styles);
          this.applyPluginCSS(pluginName, css);
        }
        
      } catch (error) {
        this.logger.warn(`Failed to apply plugin theme overrides for ${pluginName}:`, error);
      }
    }
  }

  /**
   * Apply plugin-specific CSS
   * @private
   * @param {string} pluginName - Plugin name
   * @param {string} css - CSS string
   */
  applyPluginCSS(pluginName, css) {
    const styleId = `orbiton-plugin-theme-${pluginName}`;
    
    // Remove existing plugin styles
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Create new style element
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.setAttribute('data-plugin', pluginName);
    styleElement.textContent = css;
    
    // Add to document head
    document.head.appendChild(styleElement);
  }

  /**
   * Extract CSS variables from theme
   * @private
   * @param {Object} theme - Theme data
   * @returns {Object} CSS variables
   */
  extractCSSVariables(theme) {
    const variables = {};
    
    if (theme.variables) {
      Object.assign(variables, theme.variables);
    }
    
    // Extract variables from plugin overrides
    for (const [pluginName, overrides] of this.pluginThemes) {
      if (overrides.variables) {
        for (const [key, value] of Object.entries(overrides.variables)) {
          variables[`plugin-${pluginName}-${key}`] = value;
        }
      }
    }
    
    return variables;
  }

  /**
   * Load themes from directory
   * @private
   * @returns {Promise<void>}
   */
  async loadThemesFromDirectory() {
    try {
      // Ensure themes directory exists
      await fs.mkdir(this.config.themesDir, { recursive: true });
      
      // Read theme files
      const files = await fs.readdir(this.config.themesDir);
      const themeFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of themeFiles) {
        const themeName = path.basename(file, '.json');
        try {
          const theme = await this.loadThemeFromFile(themeName);
          if (theme) {
            this.themes.set(themeName, theme);
          }
        } catch (error) {
          this.logger.warn(`Failed to load theme ${themeName}:`, error);
        }
      }
      
    } catch (error) {
      this.logger.warn('Failed to load themes from directory:', error);
    }
  }

  /**
   * Load theme from file
   * @private
   * @param {string} themeName - Theme name
   * @returns {Promise<Object|null>} Theme data
   */
  async loadThemeFromFile(themeName) {
    try {
      const themePath = path.join(this.config.themesDir, `${themeName}.json`);
      const themeContent = await fs.readFile(themePath, 'utf-8');
      const theme = JSON.parse(themeContent);
      
      // Add metadata
      theme.name = themeName;
      theme.isCustom = true;
      
      return theme;
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn(`Failed to load theme file ${themeName}:`, error);
      }
      return null;
    }
  }

  /**
   * Save theme to file
   * @private
   * @param {string} themeName - Theme name
   * @param {Object} theme - Theme data
   * @returns {Promise<void>}
   */
  async saveThemeToFile(themeName, theme) {
    try {
      // Ensure themes directory exists
      await fs.mkdir(this.config.themesDir, { recursive: true });
      
      // Remove metadata that shouldn't be saved
      const themeToSave = { ...theme };
      delete themeToSave.name;
      delete themeToSave.isCustom;
      
      // Save theme file
      const themePath = path.join(this.config.themesDir, `${themeName}.json`);
      const themeContent = JSON.stringify(themeToSave, null, 2);
      await fs.writeFile(themePath, themeContent, 'utf-8');
      
    } catch (error) {
      throw new FileSystemError(
        `Failed to save theme file: ${error.message}`,
        themePath,
        'write'
      );
    }
  }

  /**
   * Register built-in themes
   * @private
   */
  registerBuiltInThemes() {
    // Default theme
    this.builtInThemes.set('default', {
      name: 'default',
      displayName: 'Default',
      description: 'Default Orbiton theme',
      author: 'Orbiton Team',
      version: '2.0.0',
      variables: {
        'primary-color': '#007acc',
        'secondary-color': '#6c757d',
        'background-color': '#ffffff',
        'surface-color': '#f8f9fa',
        'text-color': '#212529',
        'text-secondary': '#6c757d',
        'border-color': '#dee2e6',
        'border-radius': '4px',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'font-size': '14px',
        'line-height': '1.5',
        'spacing-xs': '4px',
        'spacing-sm': '8px',
        'spacing-md': '16px',
        'spacing-lg': '24px',
        'spacing-xl': '32px'
      },
      styles: {
        body: {
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size)',
          lineHeight: 'var(--line-height)',
          color: 'var(--text-color)',
          backgroundColor: 'var(--background-color)',
          margin: 0,
          padding: 0
        }
      },
      components: {
        'orbiton-dashboard': {
          backgroundColor: 'var(--background-color)',
          minHeight: '100vh'
        },
        widget: {
          backgroundColor: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
          padding: 'var(--spacing-md)',
          margin: 'var(--spacing-sm)'
        }
      }
    });

    // Dark theme
    this.builtInThemes.set('dark', {
      name: 'dark',
      displayName: 'Dark',
      description: 'Dark theme for Orbiton',
      author: 'Orbiton Team',
      version: '2.0.0',
      variables: {
        'primary-color': '#0d6efd',
        'secondary-color': '#6c757d',
        'background-color': '#121212',
        'surface-color': '#1e1e1e',
        'text-color': '#ffffff',
        'text-secondary': '#adb5bd',
        'border-color': '#343a40',
        'border-radius': '4px',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'font-size': '14px',
        'line-height': '1.5',
        'spacing-xs': '4px',
        'spacing-sm': '8px',
        'spacing-md': '16px',
        'spacing-lg': '24px',
        'spacing-xl': '32px'
      },
      styles: {
        body: {
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size)',
          lineHeight: 'var(--line-height)',
          color: 'var(--text-color)',
          backgroundColor: 'var(--background-color)',
          margin: 0,
          padding: 0
        }
      },
      components: {
        'orbiton-dashboard': {
          backgroundColor: 'var(--background-color)',
          minHeight: '100vh'
        },
        widget: {
          backgroundColor: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
          padding: 'var(--spacing-md)',
          margin: 'var(--spacing-sm)'
        }
      }
    });
  }

  /**
   * Create theme validation schema
   * @private
   * @returns {Object} Validation schema
   */
  createThemeSchema() {
    return {
      type: 'object',
      required: ['displayName'],
      properties: {
        displayName: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        author: { type: 'string' },
        version: { type: 'string' },
        variables: { type: 'object' },
        styles: { type: 'object' },
        components: { type: 'object' },
        widgets: { type: 'object' }
      }
    };
  }

  /**
   * Validate theme data
   * @private
   * @param {Object} theme - Theme data to validate
   * @returns {Object} Validation result
   */
  validateTheme(theme) {
    const errors = [];
    
    // Basic structure validation
    if (!theme || typeof theme !== 'object') {
      errors.push('Theme must be an object');
      return { isValid: false, errors };
    }
    
    // Required fields
    if (!theme.displayName || typeof theme.displayName !== 'string') {
      errors.push('Theme must have a displayName');
    }
    
    // Optional field validation
    if (theme.variables && typeof theme.variables !== 'object') {
      errors.push('Theme variables must be an object');
    }
    
    if (theme.styles && typeof theme.styles !== 'object') {
      errors.push('Theme styles must be an object');
    }
    
    if (theme.components && typeof theme.components !== 'object') {
      errors.push('Theme components must be an object');
    }
    
    if (theme.widgets && typeof theme.widgets !== 'object') {
      errors.push('Theme widgets must be an object');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Emit theme change event
   * @private
   * @param {Object} theme - New theme
   */
  emitThemeChange(theme) {
    // Dispatch custom event
    const event = new CustomEvent('orbiton:theme-changed', {
      detail: {
        theme: theme.name,
        displayName: theme.displayName,
        variables: this.extractCSSVariables(theme)
      }
    });
    
    document.dispatchEvent(event);
  }
}