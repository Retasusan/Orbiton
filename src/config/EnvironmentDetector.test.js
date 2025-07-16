/**
 * @fileoverview Tests for EnvironmentDetector class
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentDetector } from './EnvironmentDetector.js';
import os from 'os';
import fs from 'fs/promises';
import { exec } from 'child_process';

// Mock os module
vi.mock('os', () => ({
  hostname: vi.fn().mockReturnValue('test-host'),
  cpus: vi.fn().mockReturnValue(Array(4).fill({})),
  totalmem: vi.fn().mockReturnValue(8 * 1024 * 1024 * 1024),
  freemem: vi.fn().mockReturnValue(4 * 1024 * 1024 * 1024),
  homedir: vi.fn().mockReturnValue('/home/user'),
  networkInterfaces: vi.fn().mockReturnValue({
    eth0: [{ address: '192.168.1.1' }],
    wlan0: [{ address: '192.168.1.2' }]
  }),
  platform: vi.fn().mockReturnValue('linux')
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs module
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn()
  },
  access: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn()
}));

describe('EnvironmentDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new EnvironmentDetector();
    
    // Clear cache
    detector.detectionCache.clear();
    
    // Setup default mocks
    exec.mockImplementation((command, callback) => {
      if (command.includes('git --version')) {
        callback(null, { stdout: 'git version 2.34.1' });
      } else if (command.includes('docker --version')) {
        callback(null, { stdout: 'Docker version 20.10.12' });
      } else if (command.includes('python --version')) {
        callback(null, { stdout: 'Python 3.9.7' });
      } else if (command.includes('node --version')) {
        callback(null, { stdout: 'v16.14.0' });
      } else if (command.includes('which')) {
        if (command.includes('git') || command.includes('docker') || command.includes('python') || command.includes('node')) {
          callback(null, { stdout: '/usr/bin/' + command.split(' ')[1] });
        } else {
          callback(new Error('Command not found'));
        }
      } else {
        callback(new Error('Command not found'));
      }
    });
    
    fs.access.mockResolvedValue();
    fs.readdir.mockResolvedValue([]);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectEnvironment', () => {
    test('should detect development environment', async () => {
      // Mock development environment indicators
      fs.access.mockImplementation((path) => {
        if (path.includes('.git') || path.includes('package.json') || path.includes('node_modules')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });
      
      const profile = await detector.detectEnvironment();
      
      expect(profile.type).toBe('development');
      expect(profile.capabilities.containers.docker).toBe(true);
      expect(profile.capabilities.vcs.git).toBe(true);
      expect(profile.suggestedPlugins).toContain('git-status');
      expect(profile.suggestedLayout).toBe('developer');
    });

    test('should detect server environment', async () => {
      // Mock server environment
      os.platform.mockReturnValue('linux');
      os.cpus.mockReturnValue(Array(8).fill({}));
      os.totalmem.mockReturnValue(16 * 1024 * 1024 * 1024);
      
      exec.mockImplementation((command, callback) => {
        if (command.includes('systemctl')) {
          callback(null, { stdout: 'nginx.service loaded active running' });
        } else if (command.includes('ps aux')) {
          callback(null, { stdout: 'nginx: master process' });
        } else {
          callback(new Error('Command not found'));
        }
      });
      
      const profile = await detector.detectEnvironment();
      
      expect(profile.type).toBe('server');
      expect(profile.suggestedPlugins).toContain('system-monitor');
      expect(profile.suggestedLayout).toBe('monitoring');
    });

    test('should use cached results', async () => {
      // First call
      const profile1 = await detector.detectEnvironment();
      
      // Second call should use cache
      const profile2 = await detector.detectEnvironment();
      
      expect(profile1).toEqual(profile2);
      expect(exec).toHaveBeenCalledTimes(4); // Only called once for initial detection
    });

    test('should handle detection errors gracefully', async () => {
      // Mock all commands to fail
      exec.mockImplementation((command, callback) => {
        callback(new Error('Command failed'));
      });
      
      const profile = await detector.detectEnvironment();
      
      expect(profile.type).toBe('minimal');
      expect(profile.capabilities).toBeDefined();
      expect(profile.suggestedPlugins).toContain('system-info');
    });
  });

  describe('detectDevelopmentTools', () => {
    test('should detect Git availability', async () => {
      const tools = await detector.detectDevelopmentTools();
      
      expect(tools.git).toBe(true);
      expect(exec).toHaveBeenCalledWith('git --version', expect.any(Function));
    });

    test('should detect Docker availability', async () => {
      const tools = await detector.detectDevelopmentTools();
      
      expect(tools.docker).toBe(true);
      expect(exec).toHaveBeenCalledWith('docker --version', expect.any(Function));
    });

    test('should handle missing tools', async () => {
      exec.mockImplementation((command, callback) => {
        callback(new Error('Command not found'));
      });
      
      const tools = await detector.detectDevelopmentTools();
      
      expect(tools.git).toBe(false);
      expect(tools.docker).toBe(false);
      expect(tools.python).toBe(false);
      expect(tools.node).toBe(false);
    });
  });

  describe('detectSystemCapabilities', () => {
    test('should detect system information', async () => {
      const capabilities = await detector.detectSystemCapabilities();
      
      expect(capabilities.platform).toBe('linux');
      expect(capabilities.cpuCores).toBe(4);
      expect(capabilities.totalMemory).toBe(8 * 1024 * 1024 * 1024);
      expect(capabilities.hostname).toBe('test-host');
      expect(capabilities.networkInterfaces).toContain('eth0');
    });

    test('should detect project context', async () => {
      fs.access.mockImplementation((path) => {
        if (path.includes('.git')) return Promise.resolve();
        if (path.includes('package.json')) return Promise.resolve();
        return Promise.reject(new Error('Not found'));
      });
      
      const capabilities = await detector.detectSystemCapabilities();
      
      expect(capabilities.inGitRepo).toBe(true);
      expect(capabilities.hasPackageJson).toBe(true);
    });
  });

  describe('determineEnvironmentType', () => {
    test('should classify as development environment', () => {
      const capabilities = {
        vcs: { git: true, inGitRepo: true },
        containers: { docker: true },
        runtime: { node: true },
        hasPackageJson: true
      };
      
      const type = detector.determineEnvironmentType(capabilities);
      
      expect(type).toBe('development');
    });

    test('should classify as server environment', () => {
      const capabilities = {
        platform: 'linux',
        cpuCores: 8,
        totalMemory: 16 * 1024 * 1024 * 1024,
        services: { nginx: true },
        vcs: { git: false }
      };
      
      const type = detector.determineEnvironmentType(capabilities);
      
      expect(type).toBe('server');
    });

    test('should default to minimal environment', () => {
      const capabilities = {
        platform: 'unknown',
        cpuCores: 1,
        totalMemory: 1024 * 1024 * 1024
      };
      
      const type = detector.determineEnvironmentType(capabilities);
      
      expect(type).toBe('minimal');
    });
  });

  describe('generatePluginSuggestions', () => {
    test('should suggest development plugins', () => {
      const capabilities = {
        vcs: { git: true },
        containers: { docker: true },
        runtime: { node: true }
      };
      
      const suggestions = detector.generatePluginSuggestions('development', capabilities);
      
      expect(suggestions).toContain('git-status');
      expect(suggestions).toContain('docker-monitor');
      expect(suggestions).toContain('system-monitor');
    });

    test('should suggest server plugins', () => {
      const capabilities = {
        services: { nginx: true },
        containers: { docker: true }
      };
      
      const suggestions = detector.generatePluginSuggestions('server', capabilities);
      
      expect(suggestions).toContain('system-monitor');
      expect(suggestions).toContain('docker-monitor');
      expect(suggestions).toContain('process-monitor');
    });

    test('should remove duplicate suggestions', () => {
      const capabilities = {
        vcs: { git: true },
        containers: { docker: true }
      };
      
      const suggestions = detector.generatePluginSuggestions('development', capabilities);
      
      // Should not have duplicates
      expect(suggestions.length).toBe(new Set(suggestions).size);
    });
  });

  describe('clearCache', () => {
    test('should clear detection cache', async () => {
      // Populate cache
      await detector.detectEnvironment();
      expect(detector.detectionCache.size).toBeGreaterThan(0);
      
      // Clear cache
      detector.clearCache();
      expect(detector.detectionCache.size).toBe(0);
    });
  });

  describe('getDetectionSummary', () => {
    test('should provide detection summary', async () => {
      await detector.detectEnvironment();
      
      const summary = detector.getDetectionSummary();
      
      expect(summary.lastDetection).toBeDefined();
      expect(summary.cacheSize).toBeGreaterThan(0);
      expect(summary.cacheTimeout).toBe(5 * 60 * 1000);
    });

    test('should handle no detection', () => {
      const summary = detector.getDetectionSummary();
      
      expect(summary.lastDetection).toBeNull();
      expect(summary.cacheSize).toBe(0);
    });
  });
});