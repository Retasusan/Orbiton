/**
 * @fileoverview Clock Widget Tests
 * 
 * Comprehensive tests for the migrated clock widget using the new BaseWidget system.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ClockWidget from './index.js';

// Mock dependencies
vi.mock('blessed', () => ({
  default: {
    box: vi.fn(() => ({
      setContent: vi.fn(),
      key: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      destroy: vi.fn(),
      screen: {
        render: vi.fn()
      }
    }))
  }
}));

vi.mock('cfonts', () => ({
  default: {
    render: vi.fn(() => ({
      string: 'MOCKED_TIME_DISPLAY'
    }))
  }
}));

vi.mock('os', () => ({
  default: {
    cpus: vi.fn(() => [
      { times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 } },
      { times: { user: 1200, nice: 0, sys: 600, idle: 8200, irq: 0 } }
    ]),
    totalmem: vi.fn(() => 8589934592), // 8GB
    freemem: vi.fn(() => 4294967296)   // 4GB
  }
}));

vi.mock('blessed-contrib', () => ({
  default: {
    line: vi.fn(() => ({
      setData: vi.fn(),
      toggle: vi.fn()
    }))
  }
}));

vi.mock('battery-level', () => ({
  default: vi.fn(() => Promise.resolve(0.75)) // 75% battery
}));

describe('ClockWidget', () => {
  let widget;
  let mockContext;

  beforeEach(() => {
    mockContext = {
      eventBus: {
        subscribe: vi.fn(() => vi.fn()),
        emitEvent: vi.fn(),
        onKeyboard: vi.fn(() => vi.fn()),
        onMouse: vi.fn(() => vi.fn()),
        onFocus: vi.fn(() => vi.fn())
      },
      theme: {
        border: 'white',
        fg: 'white',
        bg: 'black'
      }
    };

    widget = new ClockWidget('test-clock', {}, mockContext);
  });

  afterEach(() => {
    if (widget && !widget.isDestroyed) {
      widget.destroy();
    }
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create widget with default options', () => {
      expect(widget.name).toBe('test-clock');
      expect(widget.options.title).toBe('Clock');
      expect(widget.options.format).toBe('24h');
      expect(widget.options.updateInterval).toBe(1000);
      expect(widget.options.showMetrics).toBe(true);
    });

    it('should create widget with custom options', () => {
      const customWidget = new ClockWidget('custom-clock', {
        title: 'Custom Clock',
        format: '12h',
        updateInterval: 500,
        showMetrics: false
      }, mockContext);

      expect(customWidget.options.title).toBe('Custom Clock');
      expect(customWidget.options.format).toBe('12h');
      expect(customWidget.options.updateInterval).toBe(500);
      expect(customWidget.options.showMetrics).toBe(false);
    });

    it('should initialize system metrics arrays', () => {
      expect(widget.cpuHistory).toHaveLength(60);
      expect(widget.memHistory).toHaveLength(60);
      expect(widget.batHistory).toHaveLength(60);
      expect(widget.cpuHistory.every(val => val === 0)).toBe(true);
      expect(widget.memHistory.every(val => val === 0)).toBe(true);
      expect(widget.batHistory.every(val => val === null)).toBe(true);
    });
  });

  describe('Options Schema', () => {
    it('should return valid options schema', () => {
      const schema = widget.getOptionsSchema();
      
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.title).toBeDefined();
      expect(schema.properties.format).toBeDefined();
      expect(schema.properties.format.enum).toEqual(['12h', '24h']);
      expect(schema.properties.updateInterval).toBeDefined();
      expect(schema.properties.updateInterval.minimum).toBe(100);
    });

    it('should validate options correctly', () => {
      const validOptions = {
        title: 'Test Clock',
        format: '12h',
        updateInterval: 2000
      };

      const validated = widget.validateOptions(validOptions);
      expect(validated.title).toBe('Test Clock');
      expect(validated.format).toBe('12h');
      expect(validated.updateInterval).toBe(2000);
    });

    it('should reject invalid options', () => {
      const invalidOptions = {
        format: 'invalid',
        updateInterval: 50 // Below minimum
      };

      expect(() => widget.validateOptions(invalidOptions)).toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await widget.initialize();
      
      expect(widget.isInitialized).toBe(true);
      expect(widget.prevCpu).toBeDefined();
      expect(widget.use12h).toBe(false); // Default 24h format
      expect(widget.timeZone).toBeDefined();
    });

    it('should set up 12h format correctly', async () => {
      const widget12h = new ClockWidget('test-clock-12h', { format: '12h' }, mockContext);
      await widget12h.initialize();
      
      expect(widget12h.use12h).toBe(true);
    });
  });

  describe('Element Creation', () => {
    it('should create main element', async () => {
      await widget.createElement();
      
      expect(widget.element).toBeDefined();
      expect(widget.clockBox).toBeDefined();
    });

    it('should create metrics elements when showMetrics is true', async () => {
      widget.options.showMetrics = true;
      await widget.createElement();
      
      expect(widget.cpuLine).toBeDefined();
      expect(widget.infoBox).toBeDefined();
    });

    it('should not create metrics elements when showMetrics is false', async () => {
      widget.options.showMetrics = false;
      await widget.createElement();
      
      expect(widget.cpuLine).toBeNull();
      expect(widget.infoBox).toBeNull();
    });
  });

  describe('System Metrics', () => {
    beforeEach(async () => {
      await widget.initialize();
    });

    it('should get CPU usage data', () => {
      const cpuUsage = widget.getCpuUsage();
      
      expect(cpuUsage).toBeDefined();
      expect(cpuUsage.idle).toBeGreaterThan(0);
      expect(cpuUsage.total).toBeGreaterThan(0);
    });

    it('should calculate CPU percentage', () => {
      // First call to establish baseline
      widget.getCpuPercent();
      
      // Second call should return a percentage
      const cpuPercent = widget.getCpuPercent();
      
      expect(typeof cpuPercent).toBe('number');
      expect(cpuPercent).toBeGreaterThanOrEqual(0);
      expect(cpuPercent).toBeLessThanOrEqual(100);
    });

    it('should get memory usage percentage', () => {
      const memUsage = widget.getMemoryUsage();
      
      expect(typeof memUsage).toBe('number');
      expect(memUsage).toBeGreaterThanOrEqual(0);
      expect(memUsage).toBeLessThanOrEqual(100);
      expect(memUsage).toBe(50); // 4GB used out of 8GB = 50%
    });

    it('should get battery percentage', async () => {
      const batteryPercent = await widget.getBatteryPercentage();
      
      expect(batteryPercent).toBe(75); // Mocked to return 75%
    });

    it('should handle battery error gracefully', async () => {
      const batteryLevel = await import('battery-level');
      batteryLevel.default.mockRejectedValueOnce(new Error('No battery'));
      
      const batteryPercent = await widget.getBatteryPercentage();
      expect(batteryPercent).toBeNull();
    });
  });

  describe('Time Formatting', () => {
    it('should format uptime correctly', () => {
      expect(widget.formatUptime(3661)).toBe('01:01:01'); // 1 hour, 1 minute, 1 second
      expect(widget.formatUptime(90)).toBe('00:01:30');   // 1 minute, 30 seconds
      expect(widget.formatUptime(30)).toBe('00:00:30');   // 30 seconds
    });
  });

  describe('Updates', () => {
    beforeEach(async () => {
      await widget.initialize();
      await widget.createElement();
    });

    it('should start updates with correct interval', () => {
      const spy = vi.spyOn(global, 'setInterval');
      
      widget.startUpdates(2000);
      
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 2000);
      expect(widget.updateTimer).toBeDefined();
    });

    it('should stop updates correctly', () => {
      const spy = vi.spyOn(global, 'clearInterval');
      
      widget.startUpdates();
      widget.stopUpdates();
      
      expect(spy).toHaveBeenCalled();
      expect(widget.updateTimer).toBeNull();
    });

    it('should update time display', async () => {
      const cfonts = await import('cfonts');
      
      await widget.updateTime();
      
      expect(cfonts.default.render).toHaveBeenCalled();
      expect(widget.clockBox.setContent).toHaveBeenCalledWith('MOCKED_TIME_DISPLAY');
    });

    it('should update metrics when enabled', async () => {
      widget.options.showMetrics = true;
      await widget.createElement(); // Recreate with metrics
      
      await widget.updateMetrics();
      
      expect(widget.cpuLine.setData).toHaveBeenCalled();
      expect(widget.infoBox.setContent).toHaveBeenCalled();
    });
  });

  describe('Event Handlers', () => {
    beforeEach(async () => {
      await widget.initialize();
      await widget.createElement();
    });

    it('should set up event handlers', () => {
      widget.setupEventHandlers();
      
      expect(widget.element.key).toHaveBeenCalledWith(['t'], expect.any(Function));
      expect(widget.element.key).toHaveBeenCalledWith(['m'], expect.any(Function));
    });
  });

  describe('Lifecycle', () => {
    it('should destroy widget properly', async () => {
      await widget.initialize();
      await widget.createElement();
      widget.startUpdates();
      
      await widget.destroy();
      
      expect(widget.isDestroyed).toBe(true);
      expect(widget.updateTimer).toBeNull();
      expect(widget.clockBox).toBeNull();
      expect(widget.cpuLine).toBeNull();
      expect(widget.infoBox).toBeNull();
    });

    it('should get widget status', async () => {
      await widget.initialize();
      
      const status = widget.getStatus();
      
      expect(status.name).toBe('test-clock');
      expect(status.isInitialized).toBe(true);
      expect(status.isDestroyed).toBe(false);
      expect(status.errorCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle render errors gracefully', async () => {
      await widget.initialize();
      
      // Mock createElement to throw an error
      widget.createElement = vi.fn().mockRejectedValue(new Error('Render error'));
      
      await expect(widget.render()).rejects.toThrow('Render error');
      expect(widget.errorCount).toBe(1);
    });

    it('should handle update errors gracefully', async () => {
      await widget.initialize();
      await widget.createElement();
      
      // Mock updateTime to throw an error
      widget.updateTime = vi.fn().mockRejectedValue(new Error('Update error'));
      
      await widget.update();
      
      expect(widget.errorCount).toBe(1);
      expect(widget.lastError.message).toBe('Update failed');
    });
  });
});