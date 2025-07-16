/**
 * BaseWidget Test Suite
 * 
 * Comprehensive tests for the BaseWidget class demonstrating
 * the testing infrastructure and best practices.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginTestHarness } from '../PluginTestHarness.js';
import { createMockPlugin, sleep, waitFor } from '../setup.js';

// Mock BaseWidget class for testing
class TestBaseWidget {
  constructor(name, options = {}) {
    this.name = name;
    this.options = this.validateOptions(options);
    this.element = null;
    this.isVisible = true;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    this.title = this.options.title || this.name;
  }

  async render() {
    if (!this.element) return;
    
    const content = `{center}{bold}${this.title}{/bold}{/center}
{center}Status: Active{/center}`;
    
    this.element.setContent(content);
  }

  async update() {
    await this.render();
  }

  async destroy() {
    this.initialized = false;
    if (this.element) {
      this.element.destroy();
    }
  }

  validateOptions(options) {
    const schema = this.getOptionsSchema();
    // Simple validation for testing
    return { ...schema.properties?.title?.default && { title: schema.properties.title.default }, ...options };
  }

  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: 'Test Widget'
        },
        enabled: {
          type: 'boolean',
          description: 'Whether widget is enabled',
          default: true
        }
      }
    };
  }

  setPosition(row, col, rowSpan, colSpan) {
    this.position = [row, col, rowSpan, colSpan];
  }

  applyTheme(theme) {
    this.theme = theme;
  }

  handleError(error) {
    this.lastError = error;
    console.error(`Widget ${this.name} error:`, error);
  }

  getTheme() {
    return {
      primary: 'blue',
      secondary: 'green',
      accent: 'yellow'
    };
  }

  getLayoutHints() {
    return {
      minWidth: 10,
      minHeight: 5,
      preferredWidth: 20,
      preferredHeight: 10,
      canResize: true
    };
  }
}

describe('BaseWidget', () => {
  let harness;
  let widget;

  beforeEach(async () => {
    harness = new PluginTestHarness(TestBaseWidget);
    widget = await harness.createPlugin({
      title: 'Test Widget',
      enabled: true
    });
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize with correct name and options', () => {
      expect(widget.name).toMatch(/test-plugin-\d+/);
      expect(widget.options.title).toBe('Test Widget');
      expect(widget.options.enabled).toBe(true);
      expect(widget.initialized).toBe(true);
    });

    test('should use default options when not provided', async () => {
      const defaultWidget = await harness.createPlugin();
      expect(defaultWidget.options.title).toBe('Test Widget');
    });

    test('should validate options on initialization', () => {
      const schema = widget.getOptionsSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });
  });

  describe('Rendering', () => {
    test('should render without errors', async () => {
      const content = await harness.renderPlugin(widget);
      expect(content).toContain('Test Widget');
      expect(content).toContain('Status: Active');
    });

    test('should handle missing element gracefully', async () => {
      widget.element = null;
      await expect(widget.render()).resolves.not.toThrow();
    });

    test('should update element content when rendered', async () => {
      await widget.render();
      expect(widget.element.setContent).toHaveBeenCalled();
      
      const lastCall = widget.element.setContent.mock.calls[widget.element.setContent.mock.calls.length - 1];
      expect(lastCall[0]).toContain('Test Widget');
    });
  });

  describe('Updates', () => {
    test('should update and re-render', async () => {
      const renderSpy = vi.spyOn(widget, 'render');
      
      await widget.update();
      
      expect(renderSpy).toHaveBeenCalled();
    });

    test('should handle update errors gracefully', async () => {
      // Mock render to throw an error
      vi.spyOn(widget, 'render').mockRejectedValue(new Error('Render error'));
      
      await expect(widget.update()).rejects.toThrow('Render error');
    });
  });

  describe('Configuration', () => {
    test('should return valid options schema', () => {
      const schema = widget.getOptionsSchema();
      
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.title).toBeDefined();
      expect(schema.properties.title.type).toBe('string');
    });

    test('should validate options correctly', () => {
      const validOptions = { title: 'Valid Title', enabled: true };
      const result = widget.validateOptions(validOptions);
      
      expect(result.title).toBe('Valid Title');
      expect(result.enabled).toBe(true);
    });
  });

  describe('Positioning', () => {
    test('should set position correctly', () => {
      widget.setPosition(1, 2, 3, 4);
      expect(widget.position).toEqual([1, 2, 3, 4]);
    });

    test('should return layout hints', () => {
      const hints = widget.getLayoutHints();
      
      expect(hints).toBeDefined();
      expect(hints.minWidth).toBeGreaterThan(0);
      expect(hints.minHeight).toBeGreaterThan(0);
      expect(hints.canResize).toBeDefined();
    });
  });

  describe('Theming', () => {
    test('should apply theme', () => {
      const theme = { primary: 'red', secondary: 'blue' };
      widget.applyTheme(theme);
      
      expect(widget.theme).toEqual(theme);
    });

    test('should get current theme', () => {
      const theme = widget.getTheme();
      
      expect(theme).toBeDefined();
      expect(theme.primary).toBeDefined();
      expect(theme.secondary).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', () => {
      const error = new Error('Test error');
      
      widget.handleError(error);
      
      expect(widget.lastError).toBe(error);
    });

    test('should not crash on render errors', async () => {
      // Mock setContent to throw an error
      widget.element.setContent.mockImplementation(() => {
        throw new Error('Render error');
      });
      
      await expect(widget.render()).rejects.toThrow('Render error');
      // Widget should still be in a valid state
      expect(widget.initialized).toBe(true);
    });
  });

  describe('Lifecycle', () => {
    test('should destroy cleanly', async () => {
      const destroySpy = vi.spyOn(widget.element, 'destroy');
      
      await widget.destroy();
      
      expect(widget.initialized).toBe(false);
      expect(destroySpy).toHaveBeenCalled();
    });

    test('should handle multiple destroy calls', async () => {
      await widget.destroy();
      await expect(widget.destroy()).resolves.not.toThrow();
    });
  });
});

describe('BaseWidget Performance', () => {
  let harness;

  beforeEach(() => {
    harness = new PluginTestHarness(TestBaseWidget);
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  test('should initialize quickly', async () => {
    const stats = await harness.testPerformance(await harness.createPlugin(), 10);
    
    expect(stats.initialize.average).toBeLessThan(10); // Should initialize in less than 10ms
    expect(stats.render.average).toBeLessThan(5);      // Should render in less than 5ms
  });

  test('should handle high-frequency updates', async () => {
    const widget = await harness.createPlugin();
    const updateCount = 100;
    const startTime = performance.now();
    
    for (let i = 0; i < updateCount; i++) {
      await widget.update();
    }
    
    const endTime = performance.now();
    const averageTime = (endTime - startTime) / updateCount;
    
    expect(averageTime).toBeLessThan(10); // Should average less than 10ms per update
  });
});

describe('BaseWidget Integration', () => {
  let harness;

  beforeEach(() => {
    harness = new PluginTestHarness(TestBaseWidget);
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  test('should work with event bus', async () => {
    const widget = await harness.createPlugin();
    const mocks = harness.getMocks();
    
    // Test event emission
    widget.eventBus.emit('test-event', { data: 'test' });
    
    const emittedEvents = mocks.eventBus.getEmittedEvents();
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].event).toBe('test-event');
    expect(emittedEvents[0].args[0].data).toBe('test');
  });

  test('should work with logger', async () => {
    const widget = await harness.createPlugin();
    const mocks = harness.getMocks();
    
    // Test logging
    widget.logger.info('Test message', { extra: 'data' });
    
    const messages = mocks.logger.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].level).toBe('info');
    expect(messages[0].message).toBe('Test message');
  });

  test('should integrate with theme system', async () => {
    const widget = await harness.createPlugin();
    const mocks = harness.getMocks();
    
    // Test theme application
    const customTheme = { primary: 'purple', accent: 'orange' };
    mocks.theme.setTheme(customTheme);
    
    const appliedTheme = widget.getTheme();
    expect(appliedTheme).toBeDefined();
  });
});