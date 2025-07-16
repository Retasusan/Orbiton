/**
 * Global test setup for Orbiton Dashboard
 * 
 * This file runs before all tests and sets up the testing environment,
 * mocks, and utilities needed for comprehensive testing.
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Global Test Configuration
// ============================================================================

// Increase timeout for integration tests
vi.setConfig({ testTimeout: 10000 });

// ============================================================================
// Mock blessed.js for testing
// ============================================================================

const mockElement = {
  setContent: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  width: 80,
  height: 24,
  style: {},
  border: {},
  label: '',
  content: ''
};

const mockScreen = {
  render: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  width: 80,
  height: 24,
  program: {
    key: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
};

const mockBlessed = {
  screen: vi.fn(() => mockScreen),
  box: vi.fn(() => mockElement),
  text: vi.fn(() => mockElement),
  list: vi.fn(() => mockElement),
  table: vi.fn(() => mockElement),
  progressbar: vi.fn(() => mockElement),
  Element: class MockElement extends EventEmitter {
    constructor(options = {}) {
      super();
      Object.assign(this, mockElement, options);
    }
  }
};

vi.mock('blessed', () => mockBlessed);

// ============================================================================
// Mock Node.js modules for testing
// ============================================================================

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn()
}));

// Mock os module
vi.mock('os', () => ({
  platform: vi.fn(() => 'linux'),
  arch: vi.fn(() => 'x64'),
  cpus: vi.fn(() => [
    { model: 'Test CPU', speed: 2400, times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 } }
  ]),
  totalmem: vi.fn(() => 8589934592), // 8GB
  freemem: vi.fn(() => 4294967296),  // 4GB
  loadavg: vi.fn(() => [1.2, 1.1, 1.0]),
  uptime: vi.fn(() => 86400), // 1 day
  hostname: vi.fn(() => 'test-host'),
  networkInterfaces: vi.fn(() => ({
    eth0: [{ family: 'IPv4', address: '192.168.1.100', internal: false }]
  }))
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
  execSync: vi.fn()
}));

// Mock fetch for API testing
global.fetch = vi.fn();

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock plugin instance for testing
 */
export function createMockPlugin(name = 'test-plugin', options = {}) {
  const plugin = {
    name,
    options,
    element: { ...mockElement },
    isVisible: true,
    data: null,
    lastUpdate: null,
    updateInterval: 5000,
    updateTimer: null,
    hasError: false,
    errorMessage: null,
    
    // Mock methods
    initialize: vi.fn(),
    render: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    fetchData: vi.fn(),
    startUpdates: vi.fn(),
    stopUpdates: vi.fn(),
    validateOptions: vi.fn((opts) => opts),
    getOptionsSchema: vi.fn(() => ({ type: 'object' })),
    setPosition: vi.fn(),
    applyTheme: vi.fn(),
    handleError: vi.fn(),
    getTheme: vi.fn(() => ({
      primary: 'blue',
      secondary: 'green',
      accent: 'yellow',
      background: 'black',
      foreground: 'white'
    })),
    getLayoutHints: vi.fn(() => ({
      minWidth: 10,
      minHeight: 5,
      preferredWidth: 20,
      preferredHeight: 10
    })),
    
    // Event emitter methods
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  };
  
  return plugin;
}

/**
 * Create a mock configuration for testing
 */
export function createMockConfig(overrides = {}) {
  return {
    autoDetect: true,
    layout: {
      preset: 'developer',
      grid: { rows: 4, cols: 4 }
    },
    plugins: [
      {
        name: 'test-plugin',
        position: [0, 0, 2, 2],
        options: {}
      }
    ],
    theme: 'default',
    performance: {
      updateInterval: 5000,
      maxConcurrentUpdates: 3
    },
    ...overrides
  };
}

/**
 * Create a mock event bus for testing
 */
export function createMockEventBus() {
  const events = new Map();
  const emittedEvents = [];
  
  return {
    on: vi.fn((event, handler) => {
      if (!events.has(event)) {
        events.set(event, []);
      }
      events.get(event).push(handler);
    }),
    
    off: vi.fn((event, handler) => {
      if (events.has(event)) {
        const handlers = events.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }),
    
    emit: vi.fn((event, ...args) => {
      emittedEvents.push({ event, args });
      if (events.has(event)) {
        events.get(event).forEach(handler => handler(...args));
      }
    }),
    
    removeAllListeners: vi.fn((event) => {
      if (event) {
        events.delete(event);
      } else {
        events.clear();
      }
    }),
    
    listenerCount: vi.fn((event) => {
      return events.has(event) ? events.get(event).length : 0;
    }),
    
    // Test utilities
    getEmittedEvents: () => emittedEvents,
    clearHistory: () => emittedEvents.length = 0
  };
}

/**
 * Create a mock logger for testing
 */
export function createMockLogger() {
  const messages = [];
  
  return {
    debug: vi.fn((message, ...args) => {
      messages.push({ level: 'debug', message, args });
    }),
    
    info: vi.fn((message, ...args) => {
      messages.push({ level: 'info', message, args });
    }),
    
    warn: vi.fn((message, ...args) => {
      messages.push({ level: 'warn', message, args });
    }),
    
    error: vi.fn((message, ...args) => {
      messages.push({ level: 'error', message, args });
    }),
    
    // Test utilities
    getMessages: () => messages,
    clearHistory: () => messages.length = 0
  };
}

/**
 * Wait for a specified amount of time
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await sleep(interval);
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a mock fetch response
 */
export function createMockResponse(data, options = {}) {
  const { status = 200, statusText = 'OK', headers = {} } = options;
  
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Map(Object.entries(headers)),
    json: vi.fn(() => Promise.resolve(data)),
    text: vi.fn(() => Promise.resolve(JSON.stringify(data))),
    blob: vi.fn(() => Promise.resolve(new Blob([JSON.stringify(data)]))),
    arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0)))
  };
}

/**
 * Mock performance.now() for consistent timing in tests
 */
let mockTime = 0;
global.performance = {
  now: vi.fn(() => mockTime),
  mark: vi.fn(),
  measure: vi.fn()
};

export function setMockTime(time) {
  mockTime = time;
}

export function advanceMockTime(ms) {
  mockTime += ms;
}

// ============================================================================
// Global Test Hooks
// ============================================================================

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockTime = 0;
  
  // Reset fetch mock
  if (global.fetch) {
    global.fetch.mockClear();
  }
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Console suppression for cleaner test output
// ============================================================================

// Suppress console output during tests unless explicitly needed
const originalConsole = { ...console };

beforeAll(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  }
});

afterAll(() => {
  if (!process.env.VERBOSE_TESTS) {
    Object.assign(console, originalConsole);
  }
});

// ============================================================================
// Export test utilities
// ============================================================================

export {
  mockBlessed,
  mockElement,
  mockScreen
};