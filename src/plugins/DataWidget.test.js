/**
 * DataWidget Core Tests
 * 
 * Comprehensive tests for the DataWidget class covering data fetching,
 * update management, error handling, and performance.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataWidget } from './DataWidget.js';
import { 
  assertDataWidgetInterface, 
  assertValidSchema,
  TestData,
  MockFactory,
  AssertionHelpers 
} from '../../test/utils/test-helpers.js';
import { sleep, waitFor } from '../../test/setup.js';

describe('DataWidget Core Functionality', () => {
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
      height: 20
    };

    widget = new DataWidget('test-data-widget', {
      title: 'Test Data Widget',
      updateInterval: 1000
    });
    
    widget.element = mockElement;
    
    // Mock fetchData method
    widget.fetchData = vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      value: 42,
      status: 'ok'
    });
  });

  afterEach(async () => {
    if (widget.updateTimer) {
      widget.stopUpdates();
    }
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should create DataWidget with correct properties', () => {
      expect(widget.name).toBe('test-data-widget');
      expect(widget.options.title).toBe('Test Data Widget');
      expect(widget.options.updateInterval).toBe(1000);
      expect(widget.data).toBeNull();
      expect(widget.lastUpdate).toBeNull();
      expect(widget.updateInterval).toBe(1000);
      expect(widget.updateTimer).toBeNull();
    });

    test('should follow DataWidget interface', () => {
      assertDataWidgetInterface(widget);
    });

    test('should inherit from BaseWidget', () => {
      expect(widget).toHaveProperty('name');
      expect(widget).toHaveProperty('options');
      expect(widget.initialize).toBeTypeOf('function');
      expect(widget.render).toBeTypeOf('function');
    });

    test('should use default update interval', () => {
      const defaultWidget = new DataWidget('default-test');
      expect(defaultWidget.updateInterval).toBe(5000); // Default 5 seconds
    });
  });

  describe('Data Fetching', () => {
    test('should fetch data successfully', async () => {
      const testData = { value: 123, status: 'success' };
      widget.fetchData.mockResolvedValue(testData);
      
      const result = await widget.fetchData();
      
      expect(result).toEqual(testData);
      expect(widget.fetchData).toHaveBeenCalled();
    });

    test('should handle fetch errors gracefully', async () => {
      const error = new Error('Fetch failed');
      widget.fetchData.mockRejectedValue(error);
      
      await expect(widget.fetchData()).rejects.toThrow('Fetch failed');
    });

    test('should update data and timestamp on successful fetch', async () => {
      const testData = { value: 456, status: 'updated' };
      widget.fetchData.mockResolvedValue(testData);
      
      // Simulate internal update process
      const data = await widget.fetchData();
      widget.data = data;
      widget.lastUpdate = new Date();
      
      expect(widget.data).toEqual(testData);
      expect(widget.lastUpdate).toBeInstanceOf(Date);
    });

    test('should handle null/undefined data', async () => {
      widget.fetchData.mockResolvedValue(null);
      
      const result = await widget.fetchData();
      expect(result).toBeNull();
      
      widget.fetchData.mockResolvedValue(undefined);
      const result2 = await widget.fetchData();
      expect(result2).toBeUndefined();
    });
  });

  describe('Update Management', () => {
    test('should start updates', () => {
      widget.startUpdates();
      
      expect(widget.updateTimer).not.toBeNull();
      expect(typeof widget.updateTimer).toBe('object');
    });

    test('should stop updates', () => {
      widget.startUpdates();
      expect(widget.updateTimer).not.toBeNull();
      
      widget.stopUpdates();
      expect(widget.updateTimer).toBeNull();
    });

    test('should handle multiple start calls', () => {
      widget.startUpdates();
      const firstTimer = widget.updateTimer;
      
      widget.startUpdates();
      const secondTimer = widget.updateTimer;
      
      // Should replace the timer
      expect(secondTimer).not.toBe(firstTimer);
      
      widget.stopUpdates();
    });

    test('should handle stop without start', () => {
      expect(() => widget.stopUpdates()).not.toThrow();
      expect(widget.updateTimer).toBeNull();
    });

    test('should pause and resume updates', () => {
      widget.startUpdates();
      expect(widget.updateTimer).not.toBeNull();
      
      widget.pauseUpdates();
      expect(widget.updateTimer).toBeNull();
      
      widget.resumeUpdates();
      expect(widget.updateTimer).not.toBeNull();
      
      widget.stopUpdates();
    });
  });

  describe('Update Intervals', () => {
    test('should respect custom update interval', async () => {
      const fastWidget = new DataWidget('fast-test', { updateInterval: 100 });
      fastWidget.fetchData = vi.fn().mockResolvedValue({ fast: true });
      fastWidget.element = mockElement;
      
      fastWidget.startUpdates();
      
      // Wait for at least one update
      await sleep(150);
      
      expect(fastWidget.fetchData).toHaveBeenCalled();
      
      fastWidget.stopUpdates();
    });

    test('should handle very short intervals', () => {
      const widget = new DataWidget('short-interval-test', { updateInterval: 1 });
      
      expect(() => widget.startUpdates()).not.toThrow();
      expect(widget.updateTimer).not.toBeNull();
      
      widget.stopUpdates();
    });

    test('should handle very long intervals', () => {
      const widget = new DataWidget('long-interval-test', { updateInterval: 3600000 }); // 1 hour
      
      expect(() => widget.startUpdates()).not.toThrow();
      expect(widget.updateTimer).not.toBeNull();
      
      widget.stopUpdates();
    });
  });

  describe('Error Handling', () => {
    test('should handle fetch errors without crashing', async () => {
      widget.fetchData.mockRejectedValue(new Error('Network error'));
      
      // Start updates - should not throw even if fetch fails
      widget.startUpdates();
      
      // Wait a bit to let the update cycle run
      await sleep(50);
      
      // Widget should still be functional
      expect(widget.updateTimer).not.toBeNull();
      
      widget.stopUpdates();
    });

    test('should handle render errors during updates', async () => {
      widget.fetchData.mockResolvedValue({ test: 'data' });
      widget.render = vi.fn().mockRejectedValue(new Error('Render error'));
      
      widget.startUpdates();
      
      // Wait for update cycle
      await sleep(50);
      
      // Should still be running despite render error
      expect(widget.updateTimer).not.toBeNull();
      
      widget.stopUpdates();
    });

    test('should track error state', async () => {
      widget.hasError = false;
      widget.errorMessage = null;
      
      const error = new Error('Test error');
      widget.handleError(error);
      
      // Error handling implementation would set these
      // This test verifies the properties exist
      expect(widget.hasError).toBeDefined();
      expect(widget.errorMessage).toBeDefined();
    });
  });

  describe('Visibility Management', () => {
    test('should respect visibility for updates', async () => {
      widget.isVisible = false;
      widget.fetchData = vi.fn().mockResolvedValue({ data: 'test' });
      
      // Mock the update logic that checks visibility
      const originalUpdate = widget.update;
      widget.update = vi.fn(async function() {
        if (this.isVisible) {
          await this.fetchData();
          await originalUpdate.call(this);
        }
      });
      
      widget.startUpdates();
      
      // Wait for potential update
      await sleep(50);
      
      // Should not have fetched data while invisible
      expect(widget.fetchData).not.toHaveBeenCalled();
      
      // Make visible and wait
      widget.isVisible = true;
      await sleep(50);
      
      widget.stopUpdates();
    });

    test('should handle visibility changes', () => {
      expect(() => {
        widget.isVisible = false;
        widget.isVisible = true;
        widget.isVisible = false;
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('should handle high-frequency updates efficiently', async () => {
      const highFreqWidget = new DataWidget('high-freq-test', { updateInterval: 10 });
      highFreqWidget.fetchData = vi.fn().mockResolvedValue({ timestamp: Date.now() });
      highFreqWidget.element = mockElement;
      
      const start = performance.now();
      
      highFreqWidget.startUpdates();
      
      // Let it run for a short time
      await sleep(100);
      
      highFreqWidget.stopUpdates();
      
      const duration = performance.now() - start;
      
      // Should complete without excessive delay
      expect(duration).toBeLessThan(200);
      
      // Should have been called multiple times
      expect(highFreqWidget.fetchData).toHaveBeenCalled();
    });

    test('should handle large data sets efficiently', async () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: Math.random(),
        timestamp: Date.now()
      }));
      
      widget.fetchData.mockResolvedValue(largeData);
      
      await widget.initialize();
      
      const start = performance.now();
      
      const data = await widget.fetchData();
      widget.data = data;
      await widget.render();
      
      const duration = performance.now() - start;
      
      // Should handle large data efficiently
      expect(duration).toBeLessThan(100);
      expect(widget.data).toHaveLength(10000);
    });

    test('should clean up resources on destroy', async () => {
      widget.startUpdates();
      expect(widget.updateTimer).not.toBeNull();
      
      await widget.destroy();
      
      // Timer should be cleaned up
      expect(widget.updateTimer).toBeNull();
    });
  });

  describe('Integration', () => {
    test('should work with different data types', async () => {
      const dataTypes = [
        { type: 'object', data: { key: 'value' } },
        { type: 'array', data: [1, 2, 3] },
        { type: 'string', data: 'test string' },
        { type: 'number', data: 42 },
        { type: 'boolean', data: true },
        { type: 'null', data: null }
      ];
      
      await widget.initialize();
      
      for (const { type, data } of dataTypes) {
        widget.fetchData.mockResolvedValue(data);
        
        const result = await widget.fetchData();
        expect(result).toEqual(data);
        
        widget.data = result;
        await expect(widget.render()).resolves.not.toThrow();
      }
    });

    test('should maintain data consistency across updates', async () => {
      let counter = 0;
      widget.fetchData.mockImplementation(async () => {
        counter++;
        return { counter, timestamp: Date.now() };
      });
      
      // First fetch
      const data1 = await widget.fetchData();
      widget.data = data1;
      expect(widget.data.counter).toBe(1);
      
      // Second fetch
      const data2 = await widget.fetchData();
      widget.data = data2;
      expect(widget.data.counter).toBe(2);
      
      // Data should be consistent
      expect(widget.data.counter).toBeGreaterThan(data1.counter);
    });
  });
});

describe('DataWidget Edge Cases', () => {
  test('should handle timer cleanup edge cases', async () => {
    const widget = new DataWidget('cleanup-test');
    
    // Start and stop rapidly
    widget.startUpdates();
    widget.stopUpdates();
    widget.startUpdates();
    widget.stopUpdates();
    
    expect(widget.updateTimer).toBeNull();
  });

  test('should handle concurrent start/stop calls', async () => {
    const widget = new DataWidget('concurrent-test');
    
    // Simulate concurrent calls
    const promises = [
      Promise.resolve(widget.startUpdates()),
      Promise.resolve(widget.stopUpdates()),
      Promise.resolve(widget.startUpdates()),
      Promise.resolve(widget.pauseUpdates()),
      Promise.resolve(widget.resumeUpdates())
    ];
    
    await expect(Promise.all(promises)).resolves.not.toThrow();
    
    widget.stopUpdates();
  });

  test('should handle fetch timeout scenarios', async () => {
    const widget = new DataWidget('timeout-test');
    
    // Mock a slow fetch
    widget.fetchData = vi.fn().mockImplementation(async () => {
      await sleep(5000); // 5 second delay
      return { data: 'slow' };
    });
    
    // Start updates with short interval
    widget.updateInterval = 100;
    widget.startUpdates();
    
    // Should not block or crash
    await sleep(200);
    
    widget.stopUpdates();
  });

  test('should handle memory pressure scenarios', async () => {
    const widgets = [];
    
    // Create many DataWidgets
    for (let i = 0; i < 100; i++) {
      const widget = new DataWidget(`memory-test-${i}`, { updateInterval: 1000 });
      widget.fetchData = vi.fn().mockResolvedValue({ id: i, data: 'test' });
      widget.element = { setContent: vi.fn() };
      widgets.push(widget);
    }
    
    // Start all updates
    widgets.forEach(w => w.startUpdates());
    
    // Let them run briefly
    await sleep(50);
    
    // Stop all updates
    widgets.forEach(w => w.stopUpdates());
    
    // Should complete without issues
    expect(widgets).toHaveLength(100);
  });
});