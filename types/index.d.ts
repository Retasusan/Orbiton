/**
 * Orbiton Dashboard - TypeScript Definitions
 * 
 * Comprehensive type definitions for the Orbiton plugin system.
 * These types provide full IntelliSense support and enable AI coding assistants
 * to understand and generate code for the Orbiton ecosystem.
 * 
 * @version 2.0.0
 * @author Orbiton Team
 */

declare module 'orbiton' {
  // ============================================================================
  // Core Plugin System Types
  // ============================================================================

  /**
   * Base widget class for all Orbiton plugins
   * 
   * @example
   * ```typescript
   * import { BaseWidget } from 'orbiton';
   * 
   * export default class MyWidget extends BaseWidget {
   *   async initialize() {
   *     this.title = this.options.title || 'My Widget';
   *   }
   * 
   *   async render() {
   *     this.element.setContent(`{center}${this.title}{/center}`);
   *   }
   * }
   * ```
   */
  export class BaseWidget {
    /** Unique name of the plugin instance */
    readonly name: string;
    
    /** Validated configuration options */
    readonly options: Record<string, any>;
    
    /** Blessed.js UI element for this widget */
    element: any; // blessed.Widgets.BoxElement
    
    /** Whether the widget is currently visible */
    isVisible: boolean;
    
    /** Event bus for plugin communication */
    eventBus: EventBus;
    
    /** Plugin manager instance */
    pluginManager: PluginManager;
    
    /** Logger instance for this plugin */
    logger: Logger;

    /**
     * Create a new BaseWidget instance
     * @param name - Unique identifier for the plugin instance
     * @param options - Configuration options for the plugin
     */
    constructor(name: string, options?: Record<string, any>);

    /**
     * Initialize the widget (called once when plugin is loaded)
     * Override this method to set up initial state, validate configuration, and prepare resources
     */
    initialize(): Promise<void>;

    /**
     * Render the widget content (called whenever the widget needs to update its display)
     * This method should be fast and efficient
     */
    render(): Promise<void>;

    /**
     * Update the widget (called when the widget should refresh its data or state)
     * Default implementation calls render()
     */
    update(): Promise<void>;

    /**
     * Clean up resources when widget is destroyed
     * Called when the plugin is being removed or the dashboard is shutting down
     */
    destroy(): Promise<void>;

    /**
     * Get the configuration schema for this widget
     * @returns JSON Schema object for widget options
     */
    getOptionsSchema(): JSONSchema;

    /**
     * Validate the provided options against the plugin's schema
     * @param options - Options to validate
     * @returns Validated and normalized options
     * @throws ValidationError if options are invalid
     */
    validateOptions(options: Record<string, any>): Record<string, any>;

    /**
     * Set the widget's position in the dashboard grid
     * @param row - Starting row (0-based)
     * @param col - Starting column (0-based)
     * @param rowSpan - Number of rows to span
     * @param colSpan - Number of columns to span
     */
    setPosition(row: number, col: number, rowSpan: number, colSpan: number): void;

    /**
     * Apply the current theme to the widget
     * @param theme - Theme configuration object
     */
    applyTheme(theme: ThemeConfig): void;

    /**
     * Handle errors gracefully, preventing dashboard crashes
     * @param error - The error to handle
     */
    handleError(error: Error): void;

    /**
     * Get the current theme configuration
     * @returns Current theme object
     */
    getTheme(): ThemeConfig;

    /**
     * Get layout hints for the dashboard
     * @returns Layout preferences for this widget
     */
    getLayoutHints(): LayoutHints;

    /**
     * Register an event listener
     * @param event - Event name
     * @param handler - Event handler function
     */
    on(event: string, handler: (...args: any[]) => void): void;

    /**
     * Remove an event listener
     * @param event - Event name
     * @param handler - Event handler function to remove
     */
    off(event: string, handler: (...args: any[]) => void): void;

    /**
     * Emit an event
     * @param event - Event name
     * @param data - Event data
     */
    emit(event: string, ...data: any[]): void;
  }

  /**
   * Data widget class for plugins that fetch and display dynamic data
   * Extends BaseWidget with automatic data fetching, caching, and update management
   * 
   * @example
   * ```typescript
   * import { DataWidget } from 'orbiton';
   * 
   * export default class WeatherWidget extends DataWidget {
   *   async initialize() {
   *     await super.initialize();
   *     this.apiKey = this.options.apiKey;
   *     this.updateInterval = 30000; // 30 seconds
   *     this.startUpdates();
   *   }
   * 
   *   async fetchData() {
   *     const response = await fetch(`https://api.weather.com/current?key=${this.apiKey}`);
   *     return await response.json();
   *   }
   * 
   *   async render() {
   *     if (!this.data) {
   *       this.element.setContent('{center}Loading...{/center}');
   *       return;
   *     }
   *     this.element.setContent(`{center}${this.data.temperature}°C{/center}`);
   *   }
   * }
   * ```
   */
  export class DataWidget extends BaseWidget {
    /** The current data for the widget */
    data: any;
    
    /** Timestamp of the last successful data fetch */
    lastUpdate: Date | null;
    
    /** Update interval in milliseconds */
    updateInterval: number;
    
    /** Timer for automatic updates */
    updateTimer: NodeJS.Timer | null;
    
    /** Whether the widget has encountered an error */
    hasError: boolean;
    
    /** Current error message */
    errorMessage: string | null;

    /**
     * Create a new DataWidget instance
     * @param name - Unique identifier for the plugin instance
     * @param options - Configuration options for the plugin
     */
    constructor(name: string, options?: Record<string, any>);

    /**
     * Fetch data from external source
     * Override this method to implement data fetching logic
     * Should return the data to be stored in this.data
     */
    fetchData(): Promise<any>;

    /**
     * Start automatic data updates based on updateInterval
     */
    startUpdates(): void;

    /**
     * Stop automatic data updates
     */
    stopUpdates(): void;

    /**
     * Temporarily pause updates (useful when widget is not visible)
     */
    pauseUpdates(): void;

    /**
     * Resume paused updates
     */
    resumeUpdates(): void;
  }

  // ============================================================================
  // Configuration Types
  // ============================================================================

  /**
   * Main Orbiton configuration interface
   */
  export interface OrbitonConfig {
    /** Enable automatic environment detection */
    autoDetect?: boolean;
    
    /** Layout configuration */
    layout?: LayoutConfig;
    
    /** Plugin configurations */
    plugins?: PluginConfig[];
    
    /** Theme configuration */
    theme?: string | ThemeConfig;
    
    /** Performance settings */
    performance?: PerformanceConfig;
    
    /** Keyboard shortcuts */
    keybindings?: KeybindingConfig;
    
    /** Logging configuration */
    logging?: LoggingConfig;
  }

  /**
   * Plugin configuration interface
   */
  export interface PluginConfig {
    /** Plugin name */
    name: string;
    
    /** Whether the plugin is enabled */
    enabled?: boolean;
    
    /** Widget position [row, col, rowSpan, colSpan] */
    position?: [number, number, number, number];
    
    /** Plugin-specific options */
    options?: Record<string, any>;
    
    /** Update interval in milliseconds */
    updateInterval?: number;
    
    /** Plugin priority (higher = more important) */
    priority?: number;
    
    /** Custom styling for this plugin */
    style?: WidgetStyle;
    
    /** Events this plugin should emit or listen to */
    events?: EventConfig;
  }

  /**
   * Layout configuration interface
   */
  export interface LayoutConfig {
    /** Layout preset name */
    preset?: string;
    
    /** Whether to use custom layout */
    custom?: boolean;
    
    /** Grid configuration */
    grid?: GridConfig;
    
    /** Whether layout should be responsive */
    responsive?: boolean;
    
    /** Responsive breakpoints */
    breakpoints?: Record<string, GridConfig>;
    
    /** Layout spacing */
    spacing?: number;
    
    /** Layout padding */
    padding?: number;
  }

  /**
   * Grid configuration interface
   */
  export interface GridConfig {
    /** Number of rows */
    rows: number;
    
    /** Number of columns */
    cols: number;
  }

  /**
   * Theme configuration interface
   */
  export interface ThemeConfig {
    /** Theme name */
    name?: string;
    
    /** Color palette */
    colors?: ColorPalette;
    
    /** Style definitions */
    styles?: StyleDefinitions;
    
    /** Border styles */
    borders?: BorderStyles;
  }

  /**
   * Color palette interface
   */
  export interface ColorPalette {
    /** Primary color */
    primary?: string;
    
    /** Secondary color */
    secondary?: string;
    
    /** Accent color */
    accent?: string;
    
    /** Background color */
    background?: string;
    
    /** Foreground/text color */
    foreground?: string;
    
    /** Border color */
    border?: string;
    
    /** Success color */
    success?: string;
    
    /** Warning color */
    warning?: string;
    
    /** Error color */
    error?: string;
    
    /** Info color */
    info?: string;
    
    /** Muted/dim color */
    muted?: string;
  }

  /**
   * Style definitions interface
   */
  export interface StyleDefinitions {
    /** Title styling */
    title?: TextStyle;
    
    /** Border styling */
    border?: BorderStyle;
    
    /** Focus styling */
    focus?: TextStyle;
    
    /** Error styling */
    error?: TextStyle;
    
    /** Success styling */
    success?: TextStyle;
    
    /** Warning styling */
    warning?: TextStyle;
    
    /** Info styling */
    info?: TextStyle;
  }

  /**
   * Text style interface
   */
  export interface TextStyle {
    /** Foreground color */
    fg?: string;
    
    /** Background color */
    bg?: string;
    
    /** Bold text */
    bold?: boolean;
    
    /** Italic text */
    italic?: boolean;
    
    /** Underlined text */
    underline?: boolean;
    
    /** Inverse colors */
    inverse?: boolean;
  }

  /**
   * Border style interface
   */
  export interface BorderStyle {
    /** Border type */
    type?: 'line' | 'double' | 'round' | 'single' | 'heavy' | 'none';
    
    /** Border color */
    fg?: string;
    
    /** Border background */
    bg?: string;
  }

  /**
   * Border styles collection
   */
  export interface BorderStyles {
    /** Default border style */
    default?: BorderStyle;
    
    /** Focused border style */
    focus?: BorderStyle;
    
    /** Error border style */
    error?: BorderStyle;
    
    /** Success border style */
    success?: BorderStyle;
  }

  /**
   * Widget-specific styling
   */
  export interface WidgetStyle {
    /** Border styling */
    border?: BorderStyle;
    
    /** Label styling */
    label?: TextStyle;
    
    /** Content styling */
    content?: TextStyle;
    
    /** Custom CSS-like properties */
    [key: string]: any;
  }

  /**
   * Performance configuration interface
   */
  export interface PerformanceConfig {
    /** Global update interval in milliseconds */
    updateInterval?: number;
    
    /** Maximum concurrent updates */
    maxConcurrentUpdates?: number;
    
    /** Maximum memory usage in bytes */
    maxMemoryUsage?: number;
    
    /** Whether to pause invisible widgets */
    pauseInvisibleWidgets?: boolean;
    
    /** Enable CPU throttling */
    cpuThrottling?: boolean;
    
    /** Enable network throttling */
    networkThrottling?: boolean;
  }

  /**
   * Keyboard binding configuration
   */
  export interface KeybindingConfig {
    /** Quit application */
    quit?: string[];
    
    /** Refresh current widget */
    refresh?: string[];
    
    /** Show help */
    help?: string[];
    
    /** Focus next widget */
    focusNext?: string[];
    
    /** Focus previous widget */
    focusPrev?: string[];
    
    /** Custom keybindings */
    [key: string]: string[] | undefined;
  }

  /**
   * Logging configuration
   */
  export interface LoggingConfig {
    /** Log level */
    level?: 'debug' | 'info' | 'warn' | 'error';
    
    /** Log file path */
    file?: string;
    
    /** Enable console logging */
    console?: boolean;
    
    /** Maximum log file size */
    maxSize?: number;
    
    /** Number of log files to keep */
    maxFiles?: number;
  }

  /**
   * Event configuration for plugins
   */
  export interface EventConfig {
    /** Events this plugin emits */
    emit?: string[];
    
    /** Events this plugin listens to */
    listen?: string[];
  }

  /**
   * Layout hints for widgets
   */
  export interface LayoutHints {
    /** Minimum width */
    minWidth?: number;
    
    /** Minimum height */
    minHeight?: number;
    
    /** Preferred width */
    preferredWidth?: number;
    
    /** Preferred height */
    preferredHeight?: number;
    
    /** Maximum width */
    maxWidth?: number;
    
    /** Maximum height */
    maxHeight?: number;
    
    /** Whether widget can be resized */
    canResize?: boolean;
    
    /** Preferred aspect ratio (width:height) */
    aspectRatio?: number;
    
    /** Whether widget is interactive */
    interactive?: boolean;
    
    /** Widget priority for layout */
    priority?: number;
  }

  // ============================================================================
  // Plugin Metadata Types
  // ============================================================================

  /**
   * Plugin metadata interface
   */
  export interface PluginMetadata {
    /** Plugin name */
    name: string;
    
    /** Plugin version */
    version: string;
    
    /** Plugin description */
    description: string;
    
    /** Plugin author */
    author: string;
    
    /** Plugin license */
    license: string;
    
    /** Plugin keywords */
    keywords: string[];
    
    /** Plugin category */
    category: PluginCategory;
    
    /** Plugin size hint */
    size: PluginSize;
    
    /** Default update interval */
    updateInterval: number;
    
    /** Main entry point */
    main?: string;
    
    /** Plugin dependencies */
    dependencies?: string[];
    
    /** Peer dependencies */
    peerDependencies?: string[];
    
    /** System requirements */
    systemRequirements?: SystemRequirements;
    
    /** Configuration schema */
    optionsSchema: JSONSchema;
    
    /** Plugin examples */
    examples?: PluginExample[];
    
    /** AI-friendly metadata */
    ai?: AIMetadata;
  }

  /**
   * Plugin category enumeration
   */
  export type PluginCategory = 
    | 'system' 
    | 'development' 
    | 'monitoring' 
    | 'utility' 
    | 'custom';

  /**
   * Plugin size enumeration
   */
  export type PluginSize = 'small' | 'medium' | 'large';

  /**
   * System requirements interface
   */
  export interface SystemRequirements {
    /** Supported platforms */
    platform?: string[];
    
    /** Required system commands */
    commands?: string[];
    
    /** Minimum Node.js version */
    nodeVersion?: string;
    
    /** Required environment variables */
    env?: string[];
  }

  /**
   * Plugin example interface
   */
  export interface PluginExample {
    /** Example name */
    name: string;
    
    /** Example description */
    description: string;
    
    /** Example configuration */
    config: PluginConfig;
    
    /** Screenshot path (optional) */
    screenshot?: string;
  }

  /**
   * AI-friendly metadata interface
   */
  export interface AIMetadata {
    /** Development patterns */
    patterns?: {
      /** Base class used */
      baseClass?: string;
      
      /** Data source type */
      dataSource?: string;
      
      /** Update pattern */
      updatePattern?: string;
      
      /** Common methods */
      methods?: string[];
    };
    
    /** Code examples for AI */
    examples?: AIExample[];
    
    /** Usage scenarios */
    scenarios?: string[];
    
    /** Common configurations */
    configurations?: Record<string, any>[];
  }

  /**
   * AI code example interface
   */
  export interface AIExample {
    /** Scenario description */
    scenario: string;
    
    /** Example code */
    code: string;
    
    /** Explanation */
    explanation?: string;
  }

  // ============================================================================
  // Core System Types
  // ============================================================================

  /**
   * Configuration manager class
   */
  export class ConfigManager {
    /**
     * Load and merge configuration from multiple sources
     * @param configPath - Optional path to configuration file
     * @returns Merged configuration
     */
    loadConfig(configPath?: string): Promise<OrbitonConfig>;

    /**
     * Detect the current environment and suggest appropriate plugins
     * @returns Environment profile
     */
    detectEnvironment(): Promise<EnvironmentProfile>;

    /**
     * Migrate configuration from legacy format
     * @returns Migration result
     */
    migrateFromLegacy(): Promise<MigrationResult>;

    /**
     * Validate configuration against schema
     * @param config - Configuration to validate
     * @returns Validation result
     */
    validate(config: OrbitonConfig): Promise<ValidationResult>;

    /**
     * Save configuration to file
     * @param config - Configuration to save
     * @param path - Optional file path
     */
    saveConfig(config: OrbitonConfig, path?: string): Promise<void>;
  }

  /**
   * Plugin manager class
   */
  export class PluginManager {
    /**
     * Discover available plugins from all sources
     * @returns Array of discovered plugins
     */
    discoverPlugins(): Promise<PluginInfo[]>;

    /**
     * Load and initialize a plugin
     * @param pluginName - Name of the plugin to load
     * @param options - Plugin configuration options
     * @returns Loaded plugin instance
     */
    loadPlugin(pluginName: string, options?: Record<string, any>): Promise<BaseWidget>;

    /**
     * Unload a plugin
     * @param pluginName - Name of the plugin to unload
     */
    unloadPlugin(pluginName: string): Promise<void>;

    /**
     * Get a loaded plugin by name
     * @param pluginName - Name of the plugin
     * @returns Plugin instance or undefined
     */
    getPlugin(pluginName: string): BaseWidget | undefined;

    /**
     * List all loaded plugins
     * @returns Array of loaded plugin instances
     */
    getLoadedPlugins(): BaseWidget[];

    /**
     * Resolve a plugin module from various sources
     * @param pluginName - Name of the plugin to resolve
     * @returns Plugin class
     */
    resolvePlugin(pluginName: string): Promise<typeof BaseWidget>;
  }

  /**
   * Event bus for plugin communication
   */
  export class EventBus {
    /**
     * Register an event handler
     * @param event - Event name
     * @param handler - Event handler function
     */
    on(event: string, handler: (...args: any[]) => void): void;

    /**
     * Register a one-time event handler
     * @param event - Event name
     * @param handler - Event handler function
     */
    once(event: string, handler: (...args: any[]) => void): void;

    /**
     * Remove an event handler
     * @param event - Event name
     * @param handler - Handler to remove
     */
    off(event: string, handler: (...args: any[]) => void): void;

    /**
     * Emit an event to all registered handlers
     * @param event - Event name
     * @param data - Event data
     */
    emit(event: string, ...data: any[]): void;

    /**
     * Remove all listeners for an event
     * @param event - Event name
     */
    removeAllListeners(event?: string): void;

    /**
     * Get the number of listeners for an event
     * @param event - Event name
     * @returns Number of listeners
     */
    listenerCount(event: string): number;
  }

  /**
   * Logger interface
   */
  export interface Logger {
    /** Log debug message */
    debug(message: string, ...args: any[]): void;
    
    /** Log info message */
    info(message: string, ...args: any[]): void;
    
    /** Log warning message */
    warn(message: string, ...args: any[]): void;
    
    /** Log error message */
    error(message: string, ...args: any[]): void;
  }

  // ============================================================================
  // Environment and System Types
  // ============================================================================

  /**
   * Environment profile interface
   */
  export interface EnvironmentProfile {
    /** Platform type */
    platform: EnvironmentPlatform;
    
    /** Detected capabilities */
    capabilities: SystemCapabilities;
    
    /** Suggested plugins */
    suggestedPlugins: string[];
    
    /** Suggested layout */
    suggestedLayout: string;
    
    /** Environment-specific configuration */
    config?: Partial<OrbitonConfig>;
  }

  /**
   * Environment platform enumeration
   */
  export type EnvironmentPlatform = 
    | 'development' 
    | 'server' 
    | 'desktop' 
    | 'minimal';

  /**
   * System capabilities interface
   */
  export interface SystemCapabilities {
    /** Docker availability */
    docker: boolean;
    
    /** Git availability */
    git: boolean;
    
    /** Node.js availability */
    node: boolean;
    
    /** Python availability */
    python: boolean;
    
    /** System-specific capabilities */
    system: SystemInfo;
  }

  /**
   * System information interface
   */
  export interface SystemInfo {
    /** Has GPU */
    hasGpu: boolean;
    
    /** Has battery */
    hasBattery: boolean;
    
    /** Network interfaces */
    networkInterfaces: string[];
    
    /** Available system commands */
    availableCommands: string[];
    
    /** Operating system */
    os: string;
    
    /** Architecture */
    arch: string;
    
    /** CPU information */
    cpu: CPUInfo;
    
    /** Memory information */
    memory: MemoryInfo;
  }

  /**
   * CPU information interface
   */
  export interface CPUInfo {
    /** Number of cores */
    cores: number;
    
    /** CPU model */
    model: string;
    
    /** CPU speed in MHz */
    speed: number;
  }

  /**
   * Memory information interface
   */
  export interface MemoryInfo {
    /** Total memory in bytes */
    total: number;
    
    /** Free memory in bytes */
    free: number;
    
    /** Used memory in bytes */
    used: number;
  }

  // ============================================================================
  // Validation and Error Types
  // ============================================================================

  /**
   * Validation result interface
   */
  export interface ValidationResult {
    /** Whether validation passed */
    isValid: boolean;
    
    /** Validation errors */
    errors: ValidationError[];
    
    /** Validation warnings */
    warnings: ValidationWarning[];
  }

  /**
   * Validation error interface
   */
  export interface ValidationError {
    /** Error message */
    message: string;
    
    /** Field path */
    path?: string;
    
    /** Error code */
    code?: string;
    
    /** Suggested fix */
    suggestion?: string;
  }

  /**
   * Validation warning interface
   */
  export interface ValidationWarning {
    /** Warning message */
    message: string;
    
    /** Field path */
    path?: string;
    
    /** Warning type */
    type?: string;
    
    /** Suggested action */
    suggestion?: string;
  }

  /**
   * Migration result interface
   */
  export interface MigrationResult {
    /** Whether migration was successful */
    success: boolean;
    
    /** Migration message */
    message: string;
    
    /** Backup file path */
    backupPath?: string;
    
    /** Migration errors */
    errors?: string[];
    
    /** Manual migration steps */
    manualSteps?: ManualMigrationStep[];
  }

  /**
   * Manual migration step interface
   */
  export interface ManualMigrationStep {
    /** Step description */
    description: string;
    
    /** Required action */
    action: string;
    
    /** Old format example */
    oldFormat?: any;
    
    /** New format example */
    newFormat?: any;
  }

  /**
   * Plugin information interface
   */
  export interface PluginInfo {
    /** Plugin name */
    name: string;
    
    /** Plugin version */
    version: string;
    
    /** Plugin description */
    description: string;
    
    /** Whether plugin is installed */
    installed: boolean;
    
    /** Whether plugin is enabled */
    enabled: boolean;
    
    /** Plugin source */
    source: PluginSource;
    
    /** Plugin metadata */
    metadata?: PluginMetadata;
  }

  /**
   * Plugin source enumeration
   */
  export type PluginSource = 'builtin' | 'npm' | 'local' | 'git';

  // ============================================================================
  // Testing Types
  // ============================================================================

  /**
   * Plugin test harness for testing plugins in isolation
   */
  export class PluginTestHarness {
    /**
     * Create a new test harness
     * @param PluginClass - The plugin class to test
     */
    constructor(PluginClass: typeof BaseWidget);

    /**
     * Create a plugin instance for testing
     * @param options - Plugin options
     * @returns Plugin instance
     */
    createPlugin(options?: Record<string, any>): Promise<BaseWidget>;

    /**
     * Render a plugin and return the content
     * @param plugin - Plugin to render
     * @param position - Position array [row, col, rowSpan, colSpan]
     * @returns Rendered content
     */
    renderPlugin(plugin: BaseWidget, position?: [number, number, number, number]): Promise<string>;

    /**
     * Simulate a data update for testing
     * @param plugin - Plugin to update
     * @param data - New data
     */
    simulateUpdate(plugin: DataWidget, data: any): Promise<void>;

    /**
     * Simulate keyboard input
     * @param plugin - Plugin to send input to
     * @param key - Key to simulate
     */
    simulateKeyPress(plugin: BaseWidget, key: string): Promise<void>;

    /**
     * Get mock objects for testing
     */
    getMocks(): TestMocks;
  }

  /**
   * Test mocks interface
   */
  export interface TestMocks {
    /** Mock grid */
    grid: MockGrid;
    
    /** Mock theme */
    theme: MockTheme;
    
    /** Mock event bus */
    eventBus: MockEventBus;
    
    /** Mock logger */
    logger: MockLogger;
  }

  /**
   * Mock grid interface
   */
  export interface MockGrid {
    /** Get rendered content */
    getRenderedContent(): string;
    
    /** Set grid size */
    setSize(rows: number, cols: number): void;
    
    /** Clear grid */
    clear(): void;
  }

  /**
   * Mock theme interface
   */
  export interface MockTheme extends ThemeConfig {
    /** Apply theme to element */
    apply(element: any): void;
  }

  /**
   * Mock event bus interface
   */
  export interface MockEventBus extends EventBus {
    /** Get emitted events */
    getEmittedEvents(): Array<{ event: string; data: any[] }>;
    
    /** Clear event history */
    clearHistory(): void;
  }

  /**
   * Mock logger interface
   */
  export interface MockLogger extends Logger {
    /** Get logged messages */
    getMessages(): Array<{ level: string; message: string; args: any[] }>;
    
    /** Clear log history */
    clearHistory(): void;
  }

  // ============================================================================
  // Utility Types
  // ============================================================================

  /**
   * JSON Schema interface
   */
  export interface JSONSchema {
    /** Schema type */
    type?: string;
    
    /** Schema properties */
    properties?: Record<string, JSONSchema>;
    
    /** Required properties */
    required?: string[];
    
    /** Default value */
    default?: any;
    
    /** Description */
    description?: string;
    
    /** Enumeration values */
    enum?: any[];
    
    /** Minimum value */
    minimum?: number;
    
    /** Maximum value */
    maximum?: number;
    
    /** Minimum length */
    minLength?: number;
    
    /** Maximum length */
    maxLength?: number;
    
    /** Pattern */
    pattern?: string;
    
    /** Format */
    format?: string;
    
    /** Items schema (for arrays) */
    items?: JSONSchema;
    
    /** Additional properties */
    additionalProperties?: boolean | JSONSchema;
  }

  /**
   * Blessed.js key event interface
   */
  export interface KeyEvent {
    /** Key name */
    name: string;
    
    /** Key sequence */
    sequence: string;
    
    /** Control key pressed */
    ctrl: boolean;
    
    /** Meta key pressed */
    meta: boolean;
    
    /** Shift key pressed */
    shift: boolean;
  }

  /**
   * Position tuple type
   */
  export type Position = [number, number, number, number];

  /**
   * Color value type
   */
  export type Color = string | number;

  /**
   * Event handler type
   */
  export type EventHandler = (...args: any[]) => void;

  /**
   * Plugin constructor type
   */
  export type PluginConstructor = new (name: string, options?: Record<string, any>) => BaseWidget;

  // ============================================================================
  // Error Classes
  // ============================================================================

  /**
   * Base Orbiton error class
   */
  export class OrbitonError extends Error {
    /** Error code */
    code: string;
    
    /** Error context */
    context: Record<string, any>;
    
    /** Error timestamp */
    timestamp: Date;

    constructor(message: string, code?: string, context?: Record<string, any>);
  }

  /**
   * Plugin-specific error class
   */
  export class PluginError extends OrbitonError {
    /** Plugin name that caused the error */
    pluginName: string;

    constructor(pluginName: string, message: string, originalError?: Error);
  }

  /**
   * Configuration error class
   */
  export class ConfigurationError extends OrbitonError {
    /** Configuration errors */
    errors: ValidationError[];

    constructor(message: string, errors: ValidationError[]);
  }

  /**
   * Validation error class
   */
  export class ValidationError extends OrbitonError {
    /** Field that failed validation */
    field: string;
    
    /** Invalid value */
    value: any;
    
    /** Expected format or type */
    expected: string;

    constructor(field: string, value: any, expected: string, message?: string);
  }

  // ============================================================================
  // Module Exports
  // ============================================================================

  /**
   * Create a new Orbiton dashboard instance
   * @param config - Dashboard configuration
   * @returns Dashboard instance
   */
  export function createDashboard(config?: OrbitonConfig): Promise<Dashboard>;

  /**
   * Dashboard class
   */
  export class Dashboard {
    /** Configuration manager */
    config: ConfigManager;
    
    /** Plugin manager */
    plugins: PluginManager;
    
    /** Event bus */
    events: EventBus;
    
    /** Logger */
    logger: Logger;

    /**
     * Initialize the dashboard
     */
    initialize(): Promise<void>;

    /**
     * Start the dashboard
     */
    start(): Promise<void>;

    /**
     * Stop the dashboard
     */
    stop(): Promise<void>;

    /**
     * Reload a specific plugin
     * @param pluginName - Name of plugin to reload
     */
    reloadPlugin(pluginName: string): Promise<void>;
  }

  // ============================================================================
  // Global Constants
  // ============================================================================

  /** Orbiton version */
  export const VERSION: string;

  /** Default configuration */
  export const DEFAULT_CONFIG: OrbitonConfig;

  /** Built-in themes */
  export const THEMES: Record<string, ThemeConfig>;

  /** Built-in presets */
  export const PRESETS: Record<string, Partial<OrbitonConfig>>;
}

// ============================================================================
// Ambient Module Declarations
// ============================================================================

declare module 'orbiton/testing' {
  export * from 'orbiton';
  export { PluginTestHarness, TestMocks, MockGrid, MockTheme, MockEventBus, MockLogger };
}

declare module 'orbiton/types' {
  export * from 'orbiton';
}

declare module 'orbiton/config' {
  export { ConfigManager, OrbitonConfig, PluginConfig, ThemeConfig, LayoutConfig };
}

declare module 'orbiton/plugins' {
  export { BaseWidget, DataWidget, PluginManager, PluginMetadata };
}

declare module 'orbiton/events' {
  export { EventBus, EventHandler };
}

declare module 'orbiton/errors' {
  export { OrbitonError, PluginError, ConfigurationError, ValidationError };
}