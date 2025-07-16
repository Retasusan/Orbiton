/**
 * Simple Counter Plugin - Basic Widget Example
 * 
 * This example demonstrates a basic interactive widget that maintains
 * internal state and responds to user input. Perfect for learning
 * the fundamentals of Orbiton plugin development.
 */

import { BaseWidget } from '../../src/plugins/BaseWidget.js';

export default class SimpleCounterPlugin extends BaseWidget {
  async initialize() {
    // Initialize counter state
    this.count = this.options.startValue || 0;
    this.step = this.options.step || 1;
    this.maxValue = this.options.maxValue || 999;
    this.minValue = this.options.minValue || -999;
    
    // Set up keyboard handlers
    this.setupKeyboardHandlers();
  }

  async render() {
    if (!this.element) return;

    const theme = this.getTheme();
    
    // Determine color based on value
    let valueColor = theme.primary;
    if (this.count > 0) valueColor = 'green';
    else if (this.count < 0) valueColor = 'red';
    else valueColor = 'blue';

    const content = `{center}{bold}Simple Counter{/bold}{/center}

{center}{${valueColor}-fg}{bold}${this.count}{/bold}{/${valueColor}-fg}{/center}

{center}{dim}Press + to increment{/dim}{/center}
{center}{dim}Press - to decrement{/dim}{/center}
{center}{dim}Press r to reset{/dim}{/center}`;

    this.element.setContent(content);
  }

  setupKeyboardHandlers() {
    this.on('keypress', async (ch, key) => {
      if (!key) return;

      switch (key.name) {
        case 'plus':
        case 'equal': // For + key without shift
          await this.increment();
          break;
        case 'minus':
          await this.decrement();
          break;
        case 'r':
          await this.reset();
          break;
      }
    });
  }

  async increment() {
    if (this.count < this.maxValue) {
      this.count += this.step;
      await this.render();
    }
  }

  async decrement() {
    if (this.count > this.minValue) {
      this.count -= this.step;
      await this.render();
    }
  }

  async reset() {
    this.count = this.options.startValue || 0;
    await this.render();
  }

  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        startValue: {
          type: 'number',
          description: 'Initial counter value',
          default: 0
        },
        step: {
          type: 'number',
          description: 'Increment/decrement step size',
          default: 1,
          minimum: 1
        },
        maxValue: {
          type: 'number',
          description: 'Maximum allowed value',
          default: 999
        },
        minValue: {
          type: 'number',
          description: 'Minimum allowed value',
          default: -999
        }
      }
    };
  }

  getLayoutHints() {
    return {
      minWidth: 20,
      minHeight: 8,
      preferredWidth: 25,
      preferredHeight: 10,
      canResize: true
    };
  }
}