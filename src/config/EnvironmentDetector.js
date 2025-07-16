/**
 * @fileoverview Environment Detection System
 * 
 * Detects the user's environment and system capabilities to provide
 * intelligent plugin suggestions and configuration defaults.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger.js';

const execAsync = promisify(exec);

/**
 * Environment detector for intelligent configuration
 */
export class EnvironmentDetector {
  constructor() {
    this.logger = new Logger('environment-detector');
    this.detectionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Detect complete environment profile
   * @returns {Promise<Object>} Environment profile
   */
  async detectEnvironment() {
    const cacheKey = 'environment-profile';
    
    // Check cache
    if (this.detectionCache.has(cacheKey)) {
      const cached = this.detectionCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.logger.debug('Using cached environment profile');
        return cached.profile;
      }
    }

    this.logger.info('Detecting environment...');
    const startTime = Date.now();

    try {
      // Detect all capabilities
      const capabilities = await this.detectCapabilities();
      
      // Determine platform type
      const platform = this.determinePlatform(capabilities);
      
      // Generate plugin suggestions
      const suggestedPlugins = this.suggestPlugins(platform, capabilities);
      
      // Suggest layout
      const suggestedLayout = this.suggestLayout(platform, capabilities);
      
      const profile = {
        platform,
        capabilities,
        suggestedPlugins,
        suggestedLayout,
        detectedAt: new Date(),
        detectionTime: Date.now() - startTime
      };

      // Cache the result
      this.detectionCache.set(cacheKey, {
        profile,
        timestamp: Date.now()
      });

      this.logger.timing('Environment detection', startTime);
      this.logger.info(`Environment detected: ${platform} with ${Object.keys(capabilities).length} capability categories`);
      
      return profile;
      
    } catch (error) {
      this.logger.error('Environment detection failed:', error);
      
      // Return minimal fallback profile
      return {
        platform: 'minimal',
        capabilities: { system: this.getBasicSystemInfo() },
        suggestedPlugins: ['clock'],
        suggestedLayout: 'minimal',
        detectedAt: new Date(),
        detectionTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Detect system capabilities
   * @returns {Promise<Object>} System capabilities
   */
  async detectCapabilities() {
    const capabilities = {};

    // System capabilities
    capabilities.system = await this.detectSystemCapabilities();
    
    // Development tools
    capabilities.development = await this.detectDevelopmentTools();
    
    // Container technologies
    capabilities.containers = await this.detectContainerTech();
    
    // Version control
    capabilities.vcs = await this.detectVersionControl();
    
    // Cloud and infrastructure
    capabilities.cloud = await this.detectCloudTools();
    
    // Monitoring and observability
    capabilities.monitoring = await this.detectMonitoringTools();

    return capabilities;
  }

  /**
   * Detect basic system capabilities
   * @returns {Promise<Object>} System capabilities
   */
  async detectSystemCapabilities() {
    const system = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      homeDir: os.homedir(),
      tempDir: os.tmpdir()
    };

    // Detect if running in various environments
    system.isWSL = await this.isRunningInWSL();
    system.isDocker = await this.isRunningInDocker();
    system.isCI = this.isRunningInCI();
    system.hasGpu = await this.hasGPU();
    system.hasBattery = await this.hasBattery();
    system.hasLowMemory = system.totalMemory < 2 * 1024 * 1024 * 1024; // Less than 2GB
    
    // Network interfaces
    system.networkInterfaces = Object.keys(os.networkInterfaces());
    
    return system;
  }

  /**
   * Detect development tools
   * @returns {Promise<Object>} Development tools
   */
  async detectDevelopmentTools() {
    const tools = {};
    
    // Package managers
    tools.npm = await this.isCommandAvailable('npm');
    tools.yarn = await this.isCommandAvailable('yarn');
    tools.pnpm = await this.isCommandAvailable('pnpm');
    
    // Runtime environments
    tools.node = await this.isCommandAvailable('node');
    tools.python = await this.isCommandAvailable('python') || await this.isCommandAvailable('python3');
    tools.go = await this.isCommandAvailable('go');
    tools.rust = await this.isCommandAvailable('cargo');
    tools.java = await this.isCommandAvailable('java');
    
    // Build tools
    tools.make = await this.isCommandAvailable('make');
    tools.cmake = await this.isCommandAvailable('cmake');
    tools.gradle = await this.isCommandAvailable('gradle');
    tools.maven = await this.isCommandAvailable('mvn');
    
    // Editors and IDEs
    tools.vscode = await this.isCommandAvailable('code');
    tools.vim = await this.isCommandAvailable('vim');
    tools.emacs = await this.isCommandAvailable('emacs');
    
    return tools;
  }

  /**
   * Detect container technologies
   * @returns {Promise<Object>} Container technologies
   */
  async detectContainerTech() {
    const containers = {};
    
    containers.docker = await this.isCommandAvailable('docker');
    containers.podman = await this.isCommandAvailable('podman');
    containers.kubernetes = await this.isCommandAvailable('kubectl');
    containers.helm = await this.isCommandAvailable('helm');
    containers.compose = await this.isCommandAvailable('docker-compose');
    
    // Check if Docker daemon is running
    if (containers.docker) {
      containers.dockerRunning = await this.isDockerRunning();
    }
    
    return containers;
  }

  /**
   * Detect version control systems
   * @returns {Promise<Object>} Version control systems
   */
  async detectVersionControl() {
    const vcs = {};
    
    vcs.git = await this.isCommandAvailable('git');
    vcs.svn = await this.isCommandAvailable('svn');
    vcs.hg = await this.isCommandAvailable('hg');
    
    // Check if in a git repository
    if (vcs.git) {
      vcs.inGitRepo = await this.isInGitRepository();
      if (vcs.inGitRepo) {
        vcs.gitRemotes = await this.getGitRemotes();
      }
    }
    
    return vcs;
  }

  /**
   * Detect cloud tools
   * @returns {Promise<Object>} Cloud tools
   */
  async detectCloudTools() {
    const cloud = {};
    
    // AWS
    cloud.aws = await this.isCommandAvailable('aws');
    
    // Google Cloud
    cloud.gcloud = await this.isCommandAvailable('gcloud');
    
    // Azure
    cloud.azure = await this.isCommandAvailable('az');
    
    // Terraform
    cloud.terraform = await this.isCommandAvailable('terraform');
    
    // Ansible
    cloud.ansible = await this.isCommandAvailable('ansible');
    
    return cloud;
  }

  /**
   * Detect monitoring tools
   * @returns {Promise<Object>} Monitoring tools
   */
  async detectMonitoringTools() {
    const monitoring = {};
    
    monitoring.htop = await this.isCommandAvailable('htop');
    monitoring.top = await this.isCommandAvailable('top');
    monitoring.ps = await this.isCommandAvailable('ps');
    monitoring.netstat = await this.isCommandAvailable('netstat');
    monitoring.ss = await this.isCommandAvailable('ss');
    monitoring.lsof = await this.isCommandAvailable('lsof');
    monitoring.iostat = await this.isCommandAvailable('iostat');
    monitoring.vmstat = await this.isCommandAvailable('vmstat');
    
    return monitoring;
  }

  /**
   * Determine platform type based on capabilities
   * @param {Object} capabilities - Detected capabilities
   * @returns {string} Platform type
   */
  determinePlatform(capabilities) {
    const { system, development, containers, vcs } = capabilities;
    
    // Server environment indicators
    if (system.isCI || system.isDocker || !system.hasBattery) {
      return 'server';
    }
    
    // Development environment indicators
    if (development.node && development.npm && vcs.git) {
      if (containers.docker || development.python || development.go) {
        return 'development';
      }
    }
    
    // Monitoring/ops environment
    if (containers.kubernetes || capabilities.cloud.aws || capabilities.cloud.gcloud) {
      return 'monitoring';
    }
    
    // Minimal environment (limited capabilities)
    if (system.hasLowMemory || Object.values(development).filter(Boolean).length < 3) {
      return 'minimal';
    }
    
    // Default to development
    return 'development';
  }

  /**
   * Suggest plugins based on platform and capabilities
   * @param {string} platform - Platform type
   * @param {Object} capabilities - System capabilities
   * @returns {Array<string>} Suggested plugin names
   */
  suggestPlugins(platform, capabilities) {
    const plugins = ['system-info', 'clock']; // Always include these
    
    const { development, containers, vcs, monitoring } = capabilities;
    
    // Add plugins based on detected capabilities
    if (vcs.git && vcs.inGitRepo) {
      plugins.push('git-status');
    }
    
    if (containers.docker && containers.dockerRunning) {
      plugins.push('docker-monitor');
    }
    
    if (development.npm) {
      plugins.push('npm-scripts');
    }
    
    if (containers.kubernetes) {
      plugins.push('k8s-monitor');
    }
    
    if (monitoring.htop || monitoring.top) {
      plugins.push('process-monitor');
    }
    
    // Platform-specific suggestions
    switch (platform) {
      case 'server':
        plugins.push('network-monitor', 'log-viewer');
        break;
        
      case 'development':
        plugins.push('project-info', 'test-runner');
        break;
        
      case 'monitoring':
        plugins.push('metrics-dashboard', 'alert-status');
        break;
        
      case 'minimal':
        // Keep only essential plugins
        return ['clock', 'system-info'];
    }
    
    // Remove duplicates and return
    return [...new Set(plugins)];
  }

  /**
   * Suggest layout based on platform and capabilities
   * @param {string} platform - Platform type
   * @param {Object} capabilities - System capabilities
   * @returns {string} Suggested layout preset
   */
  suggestLayout(platform, capabilities) {
    const layoutMap = {
      development: 'developer',
      server: 'server',
      monitoring: 'monitoring',
      minimal: 'minimal'
    };
    
    return layoutMap[platform] || 'developer';
  }

  /**
   * Check if command is available
   * @param {string} command - Command to check
   * @returns {Promise<boolean>} Whether command is available
   */
  async isCommandAvailable(command) {
    try {
      const checkCommand = process.platform === 'win32' ? 'where' : 'which';
      await execAsync(`${checkCommand} ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if running in WSL
   * @returns {Promise<boolean>} Whether running in WSL
   */
  async isRunningInWSL() {
    try {
      if (process.platform !== 'linux') return false;
      
      const release = await fs.readFile('/proc/version', 'utf-8');
      return release.toLowerCase().includes('microsoft');
    } catch {
      return false;
    }
  }

  /**
   * Check if running in Docker
   * @returns {Promise<boolean>} Whether running in Docker
   */
  async isRunningInDocker() {
    try {
      await fs.access('/.dockerenv');
      return true;
    } catch {
      try {
        const cgroup = await fs.readFile('/proc/1/cgroup', 'utf-8');
        return cgroup.includes('docker');
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if running in CI environment
   * @returns {boolean} Whether running in CI
   */
  isRunningInCI() {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.TRAVIS ||
      process.env.CIRCLECI ||
      process.env.JENKINS_URL
    );
  }

  /**
   * Check if system has GPU
   * @returns {Promise<boolean>} Whether system has GPU
   */
  async hasGPU() {
    try {
      if (process.platform === 'linux') {
        await execAsync('lspci | grep -i vga');
        return true;
      } else if (process.platform === 'darwin') {
        const result = await execAsync('system_profiler SPDisplaysDataType');
        return result.stdout.includes('Graphics');
      } else if (process.platform === 'win32') {
        const result = await execAsync('wmic path win32_VideoController get name');
        return result.stdout.trim().split('\n').length > 2;
      }
    } catch {
      // Ignore errors
    }
    return false;
  }

  /**
   * Check if system has battery
   * @returns {Promise<boolean>} Whether system has battery
   */
  async hasBattery() {
    try {
      if (process.platform === 'linux') {
        const batteryPath = '/sys/class/power_supply';
        const entries = await fs.readdir(batteryPath);
        return entries.some(entry => entry.startsWith('BAT'));
      } else if (process.platform === 'darwin') {
        const result = await execAsync('pmset -g batt');
        return !result.stdout.includes('AC Power');
      } else if (process.platform === 'win32') {
        const result = await execAsync('wmic path win32_battery get name');
        return result.stdout.trim().split('\n').length > 2;
      }
    } catch {
      // Ignore errors
    }
    return false;
  }

  /**
   * Check if Docker daemon is running
   * @returns {Promise<boolean>} Whether Docker is running
   */
  async isDockerRunning() {
    try {
      await execAsync('docker info');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if in git repository
   * @returns {Promise<boolean>} Whether in git repository
   */
  async isInGitRepository() {
    try {
      await execAsync('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get git remotes
   * @returns {Promise<Array<string>>} Git remote names
   */
  async getGitRemotes() {
    try {
      const result = await execAsync('git remote');
      return result.stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Get basic system information
   * @returns {Object} Basic system info
   */
  getBasicSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      hostname: os.hostname()
    };
  }

  /**
   * Clear detection cache
   */
  clearCache() {
    this.detectionCache.clear();
    this.logger.debug('Environment detection cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.detectionCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}