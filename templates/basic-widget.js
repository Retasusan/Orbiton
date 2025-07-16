/**
 * {{name}} - A basic Orbiton widget
 * 
 * This template provides a foundation for creating simple widgets that don't
 * require regular data updates. Perfect for static displays, calculators,
 * or widgets that only update on user interaction.
 * 
 * @example
 * // Configuration in orbiton.json:
 * {
 *   "plugins": [
 *     {
 *       "name": "{{name}}",
 *       "position": [0, 0, 2, 2],
 *       "options": {
 *         "title": "My Widget",
 *         "showBorder": true
 *       }
 *     }
 *   ]
 * }
 */

import { BaseWidget } from '../src/plugins/BaseWidget.js';

export default class {{className}} extends BaseWidget {
  /**
   * Initialize the widget
   * Called once when the plugin is loaded
   */
  async initialize() {
    // Set up initial state from options
    this.title = this.options.title || '{{name}}';
    this.showBorder = this.options.showBorder !== false;
    this.counter = 0;
    
    // Validate required options
    if (this.options.requiredField && !this.options.requiredField) {
      throw new Error('requiredField is required for {{name}} widget');
    }
    
    // Set up any event listeners or initial data
    this.setupEventListeners();
  }

  /**
   * Render the widget content
   * Called whenever the widget needs to update its display
   */
  async render() {
    if (!this.element) return;

    // Build the content string using blessed.js formatting
    const content = this.buildContent();
    
    // Apply content to the element
    this.element.setContent(content);
    
    // Apply styling based on theme
    this.applyCustomStyling();
  }

  /**
   * Build the widget content
   * @returns {string} Formatted content string
   */
  buildContent() {
    const theme = this.getTheme();
    const borderChar = this.showBorder ? '─' : '';
    
    return `{center}{bold}${this.title}{/bold}{/center}
${borderChar.repeat(this.element.width - 2)}
{center}Counter: {${theme.accent}-fg}${this.counter}{/${theme.accent}-fg}{/center}
{center}Status: {green-fg}Active{/green-fg}{/center}

{center}{dim}Press 'r' to refresh{/dim}{/center}`;
  }

  /**
   * Apply custom styling based on theme and options
   */
  applyCustomStyling() {
    const theme = this.getTheme();
    
    // Apply border styling if enabled
    if (this.showBorder) {
      this.element.style = {
        border: {
          type: 'line',
          fg: theme.border
        }
      };
    }
  }

  /**
   * Set up event listeners for user interaction
   */
  setupEventListeners() {
    // Listen for key presses (example: 'r' to refresh)
    this.on('keypress', (ch, key) => {
      if (key && key.name === 'r') {
        this.handleRefresh();
      }
    });
  }

  /**
   * Handle refresh action
   */
  async handleRefresh() {
    this.counter++;
    await this.render();
  }

  /**
   * Update the widget (called by framework or manually)
   */
  async update() {
    // Perform any update logic here
    await this.render();
  }

  /**
   * Clean up resources when widget is destroyed
   */
  async destroy() {
    // Clean up any timers, connections, or event listeners
    // The base class will handle basic cleanup
    await super.destroy();
  }

  /**
   * Define the configuration schema for this widget
   * @returns {object} JSON Schema for widget options
   */
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title to display',
          default: '{{name}}'
        },
        showBorder: {
          type: 'boolean',
          description: 'Whether to show a border around the widget',
          default: true
        },
        requiredField: {
          type: 'string',
          description: 'An example required configuration field'
        }
      },
      // Uncomment to make fields required
      // required: ['requiredField']
    };
  }

  /**
   * Get layout hints for the dashboard
   * @returns {object} Layout preferences
   */
  getLayoutHints() {
    return {
      minWidth: 15,
      minHeight: 6,
      preferredWidth: 20,
      preferredHeight: 8,
      canResize: true
    };
  }
}