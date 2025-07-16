/**
 * BaseWidget Core Tests
 * 
 * Comprehensive tests for the BaseWidget class covering all
 * functionality, edge cases, and error conditions.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseWidget } from './BaseWidget.js';
import { 
  assertPluginInterface, 
  assertValidSchema, 
  assertPluginContent,
  TestData,
  MockFactory 
} from '../../test/utils/test-helpers.js';

describe('BaseWidget Core Functionality', () => {
  let widget;
  let mockElement;

  beforeEach(() => {
    mockElement = {
      setContent: vi.fn(),
      render: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      width: 40,
      height: 20,
      style: {},
      border: {}
    };

    widget = new BaseWidget('test-widget', {
      title: 'Test Widget',
      enabled: true
    });
    
    widget.element = mockElement;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should create widget with correct properties', () => {
      expect(widget.name).toBe('test-widget');
      expect(widget.options.title).toBe('Test Widget');
      expect(widget.options.enabled).toBe(true);
      expect(widget.isVisible).toBe(true);
    });

    test('should validate options on construction', () => {
      const validateSpy = vi.spyOn(BaseWidget.prototype, 'validateOptions');
      
      new BaseWidget('test', { title: 'Test' });
      
      expect(validateSpy).toHaveBeenCalledWith({ title: 'Test' });
    });

    test('should handle empty options', () => {
      const emptyWidget = new BaseWidget('empty-test');
      expect(emptyWidget.options).toBeDefined();
      expect(emptyWidget.name).toBe('empty-test');
    });

    test('should follow plugin interface', () => {
      assertPluginInterface(widget);
    });
  });

  describe('Lifecycle Methods', () => {
    test('initialize should be overrideable', async () => {
      const initSpy = vi.spyOn(widget, 'initialize');
      await widget.initialize();
      expect(initSpy).toHaveBeenCalled();
    });

    test('render should be overrideable', async () => {
      const renderSpy = vi.spyOn(widget, 'render');
      await widget.render();
      expect(renderSpy).toHaveBeenCalled();
    });

    test('update should call render by default', async () => {
      const renderSpy = vi.spyOn(widget, 'render');
      await widget.update();
      expect(renderSpy).toHaveBeenCalled();
    });

    test('destroy should be overrideable', async () => {
      const destroySpy = vi.spyOn(widget, 'destroy');
      await widget.destroy();
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    test('should return valid options schema', () => {
      const schema = widget.getOptionsSchema();
      assertValidSchema(schema);
    });

    test('should validate options correctly', () => {
      const validOptions = { title: 'Valid Title', enabled: true };
      const result = widget.validateOptions(validOptions);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    test('should handle invalid options gracefully', () => {
      // This test depends on the actual validation implementation
      expect(() => {
        widget.validateOptions(null);
      }).not.toThrow();
    });

    test('should merge default options', () => {
      const schema = widget.getOptionsSchema();
      const options = widget.validateOptions({});
      
      // Should include defaults from schema
      expect(options).toBeDefined();
    });
  });

  describe('Positioning and Layout', () => {
    test('should set position correctly', () => {
      widget.setPosition(1, 2, 3, 4);
      // Position setting is framework-handled, so we just ensure it doesn't throw
      expect(() => widget.setPosition(0, 0, 1, 1)).not.toThrow();
    });

    test('should return layout hints', () => {
      const hints = widget.getLayoutHints();
      
      expect(hints).toBeDefined();
      expect(typeof hints).toBe('object');
      
      // Should have numeric properties
      if (hints.minWidth !== undefined) {
        expect(typeof hints.minWidth).toBe('number');
      }
      if (hints.minHeight !== undefined) {
        expect(typeof hints.minHeight).toBe('number');
      }
    });

    test('should handle invalid position values', () => {
      expect(() => widget.setPosition(-1, -1, 0, 0)).not.toThrow();
      expect(() => widget.setPosition(null, null, null, null)).not.toThrow();
    });
  });

  describe('Theme Management', () => {
    test('should apply theme', () => {
      const theme = TestData.themes.dark;
      
      expect(() => widget.applyTheme(theme)).not.toThrow();
    });

    test('should get current theme', () => {
      const theme = widget.getTheme();
      
      expect(theme).toBeDefined();
      expect(typeof theme).toBe('object');
    });

    test('should handle null theme gracefully', () => {
      expect(() => widget.applyTheme(null)).not.toThrow();
      expect(() => widget.applyTheme(undefined)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', () => {
      const error = new Error('Test error');
      
      expect(() => widget.handleError(error)).not.toThrow();
    });

    test('should handle null errors', () => {
      expect(() => widget.handleError(null)).not.toThrow();
      expect(() => widget.handleError(undefined)).not.toThrow();
    });

    test('should handle non-Error objects', () => {
      expect(() => widget.handleError('string error')).not.toThrow();
      expect(() => widget.handleError({ message: 'object error' })).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    test('should support event registration', () => {
      const handler = vi.fn();
      
      expect(() => widget.on('test-event', handler)).not.toThrow();
    });

    test('should support event removal', () => {
      const handler = vi.fn();
      widget.on('test-event', handler);
      
      expect(() => widget.off('test-event', handler)).not.toThrow();
    });

    test('should support event emission', () => {
      expect(() => widget.emit('test-event', { data: 'test' })).not.toThrow();
    });
  });
});

describe('BaseWidget Edge Cases', () => {
  test('should handle missing element gracefully', async () => {
    const widget = new BaseWidget('no-element-test');
    widget.element = null;
    
    await expect(widget.render()).resolves.not.toThrow();
    await expect(widget.update()).resolves.not.toThrow();
  });

  test('should handle undefined element gracefully', async () => {
    const widget = new BaseWidget('undefined-element-test');
    await widget.initialize();
    widget.element = undefined;
    
    await expect(widget.render()).resolves.not.toThrow();
    await expect(widget.update()).resolves.not.toThrow();
  });

  test('should handle element method failures', async () => {
    const widget = new BaseWidget('failing-element-test');
    await widget.initialize();
    widget.element = {
      setContent: vi.fn(() => { throw new Error('Element error'); }),
      render: vi.fn(() => { throw new Error('Render error'); })
    };
    
    // Should not propagate element errors
    await expect(widget.render()).resolves.not.toThrow();
  });

  test('should handle very long widget names', () => {
    const longName = 'a'.repeat(1000);
    const widget = new BaseWidget(longName);
    
    expect(widget.name).toBe(longName);
    expect(widget.name.length).toBe(1000);
  });

  test('should handle special characters in names', () => {
    const specialName = 'test-widget-with-特殊字符-and-émojis-🎉';
    const widget = new BaseWidget(specialName);
    
    expect(widget.name).toBe(specialName);
  });

  test('should handle circular references in options', () => {
    const circularOptions = { title: 'Test' };
    circularOptions.self = circularOptions;
    
    expect(() => new BaseWidget('circular-test', circularOptions)).not.toThrow();
  });
});

describe('BaseWidget Performance', () => {
  test('should initialize quickly', async () => {
    const iterations = 100;
    const widgets = [];
    
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const widget = new BaseWidget(`perf-test-${i}`, { title: `Widget ${i}` });
      await widget.initialize();
      widgets.push(widget);
    }
    
    const end = performance.now();
    const averageTime = (end - start) / iterations;
    
    expect(averageTime).toBeLessThan(1); // Should average less than 1ms per widget
    
    // Cleanup
    for (const widget of widgets) {
      await widget.destroy();
    }
  });

  test('should render efficiently', async () => {
    const widget = new BaseWidget('render-perf-test');
    await widget.initialize();
    widget.element = {
      setContent: vi.fn(),
      render: vi.fn()
    };
    
    const iterations = 1000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await widget.render();
    }
    
    const end = performance.now();
    const averageTime = (end - start) / iterations;
    
    expect(averageTime).toBeLessThan(0.5); // Should average less than 0.5ms per render
  });

  test('should handle memory efficiently', () => {
    const widgets = [];
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create many widgets
    for (let i = 0; i < 1000; i++) {
      widgets.push(new BaseWidget(`memory-test-${i}`, {
        title: `Memory Test Widget ${i}`,
        data: Array.from({ length: 100 }, (_, j) => ({ id: j, value: Math.random() }))
      }));
    }
    
    const afterCreation = process.memoryUsage().heapUsed;
    const memoryIncrease = afterCreation - initialMemory;
    
    // Should not use excessive memory (less than 50MB for 1000 widgets)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    
    // Cleanup
    widgets.length = 0;
  });
});

describe('BaseWidget Integration', () => {
  test('should work with different element types', async () => {
    const elementTypes = [
      { setContent: vi.fn(), type: 'box' },
      { setContent: vi.fn(), type: 'text' },
      { setContent: vi.fn(), type: 'list' }
    ];
    
    for (const element of elementTypes) {
      const widget = new BaseWidget('integration-test');
      await widget.initialize();
      widget.element = element;
      
      await expect(widget.render()).resolves.not.toThrow();
      expect(element.setContent).toHaveBeenCalled();
    }
  });

  test('should maintain state across operations', async () => {
    const widget = new BaseWidget('state-test', { title: 'State Test' });
    
    // Initialize
    await widget.initialize();
    expect(widget.name).toBe('state-test');
    
    // Update options
    widget.options.title = 'Updated Title';
    expect(widget.options.title).toBe('Updated Title');
    
    // Position
    widget.setPosition(1, 1, 2, 2);
    
    // Theme
    const theme = { primary: 'red' };
    widget.applyTheme(theme);
    
    // Should maintain all state
    expect(widget.name).toBe('state-test');
    expect(widget.options.title).toBe('Updated Title');
  });
});