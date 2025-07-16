/**
 * @fileoverview Layout Manager
 * 
 * Manages dashboard layout with flexible grid system, responsive design,
 * and widget positioning.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { Logger } from '../utils/Logger.js';
import { DashboardError } from '../utils/Errors.js';

/**
 * Layout manager for dashboard widgets
 */
export class LayoutManager {
  constructor(options = {}) {
    this.logger = new Logger('layout-manager');
    
    // Layout configuration
    this.config = {
      grid: {
        rows: 12,
        cols: 12,
        gap: 8,
        minCellSize: 50
      },
      responsive: true,
      autoLayout: false,
      ...options
    };
    
    // Layout state
    this.container = null;
    this.widgets = new Map(); // widgetId -> layout info
    this.grid = null;
    this.needsUpdateFlag = false;
    
    // Responsive breakpoints
    this.breakpoints = {
      mobile: 768,
      tablet: 1024,
      desktop: 1440
    };
    
    // Current viewport
    this.viewport = {
      width: 0,
      height: 0,
      type: 'desktop'
    };
  }

  /**
   * Initialize the layout manager
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info('Initializing layout manager');
    
    // Update viewport
    this.updateViewport();
    
    // Initialize grid
    this.initializeGrid();
    
    this.logger.info(`Layout manager initialized: ${this.config.grid.cols}x${this.config.grid.rows} grid`);
  }

  /**
   * Set the container element
   * @param {HTMLElement} container - Container element
   * @returns {Promise<void>}
   */
  async setContainer(container) {
    this.container = container;
    this.updateViewport();
    this.applyContainerStyles();
    this.needsUpdateFlag = true;
  }

  /**
   * Set layout configuration
   * @param {Object} config - Layout configuration
   */
  setConfiguration(config) {
    Object.assign(this.config, config);
    this.initializeGrid();
    this.needsUpdateFlag = true;
  }

  /**
   * Add a widget to the layout
   * @param {string} widgetId - Widget ID
   * @param {Array|Object} position - Widget position [x, y, width, height] or {x, y, width, height}
   * @param {Object} size - Widget size (deprecated, use position)
   * @returns {Object} Layout information
   */
  addWidget(widgetId, position, size) {
    try {
      // Normalize position format
      const layout = this.normalizePosition(position, size);
      
      // Validate position
      this.validatePosition(layout);
      
      // Find available position if auto-layout is enabled
      if (this.config.autoLayout && !position) {
        layout = this.findAvailablePosition(layout.width, layout.height);
      }
      
      // Check for conflicts
      if (this.hasConflict(widgetId, layout)) {
        if (this.config.autoLayout) {
          layout = this.resolveConflict(layout);
        } else {
          this.logger.warn(`Widget ${widgetId} position conflicts with existing widgets`);
        }
      }
      
      // Store widget layout
      this.widgets.set(widgetId, {
        ...layout,
        id: widgetId,
        created: new Date(),
        lastUpdate: new Date()
      });
      
      this.needsUpdateFlag = true;
      
      this.logger.debug(`Widget ${widgetId} added to layout at [${layout.x}, ${layout.y}, ${layout.width}, ${layout.height}]`);
      
      return this.getWidgetLayout(widgetId);
      
    } catch (error) {
      this.logger.error(`Failed to add widget ${widgetId} to layout:`, error);
      throw new DashboardError(`Layout error: ${error.message}`, error);
    }
  }

  /**
   * Remove a widget from the layout
   * @param {string} widgetId - Widget ID
   * @returns {boolean} Whether widget was removed
   */
  removeWidget(widgetId) {
    if (this.widgets.has(widgetId)) {
      this.widgets.delete(widgetId);
      this.needsUpdateFlag = true;
      this.logger.debug(`Widget ${widgetId} removed from layout`);
      return true;
    }
    return false;
  }

  /**
   * Update a widget's position
   * @param {string} widgetId - Widget ID
   * @param {Array|Object} position - New position
   * @param {Object} size - New size (deprecated)
   * @returns {Object} Updated layout information
   */
  updateWidget(widgetId, position, size) {
    if (!this.widgets.has(widgetId)) {
      throw new DashboardError(`Widget ${widgetId} not found in layout`);
    }

    const currentLayout = this.widgets.get(widgetId);
    const newLayout = this.normalizePosition(position, size);
    
    // Merge with current layout
    const updatedLayout = {
      ...currentLayout,
      ...newLayout,
      lastUpdate: new Date()
    };
    
    // Validate new position
    this.validatePosition(updatedLayout);
    
    // Check for conflicts
    if (this.hasConflict(widgetId, updatedLayout)) {
      if (this.config.autoLayout) {
        updatedLayout = this.resolveConflict(updatedLayout);
      } else {
        this.logger.warn(`Widget ${widgetId} new position conflicts with existing widgets`);
      }
    }
    
    this.widgets.set(widgetId, updatedLayout);
    this.needsUpdateFlag = true;
    
    this.logger.debug(`Widget ${widgetId} layout updated`);
    
    return this.getWidgetLayout(widgetId);
  }

  /**
   * Get widget layout information
   * @param {string} widgetId - Widget ID
   * @returns {Object|null} Layout information with pixel coordinates
   */
  getWidgetLayout(widgetId) {
    const layout = this.widgets.get(widgetId);
    if (!layout) {
      return null;
    }

    // Convert grid coordinates to pixels
    const pixelLayout = this.gridToPixels(layout);
    
    return {
      ...layout,
      ...pixelLayout
    };
  }

  /**
   * Get all widget layouts
   * @returns {Array<Object>} All widget layouts
   */
  getAllLayouts() {
    return Array.from(this.widgets.keys()).map(id => this.getWidgetLayout(id));
  }

  /**
   * Update the layout (recalculate positions)
   * @returns {Promise<void>}
   */
  async update() {
    if (!this.needsUpdateFlag) {
      return;
    }

    this.logger.debug('Updating layout');
    
    // Update viewport
    this.updateViewport();
    
    // Recalculate grid if responsive
    if (this.config.responsive) {
      this.updateResponsiveGrid();
    }
    
    // Apply container styles
    this.applyContainerStyles();
    
    this.needsUpdateFlag = false;
    
    this.logger.debug('Layout updated');
  }

  /**
   * Check if layout needs update
   * @returns {boolean} Whether layout needs update
   */
  needsUpdate() {
    return this.needsUpdateFlag;
  }

  /**
   * Handle window resize
   */
  handleResize() {
    const oldViewport = { ...this.viewport };
    this.updateViewport();
    
    // Check if viewport type changed
    if (oldViewport.type !== this.viewport.type) {
      this.logger.info(`Viewport changed: ${oldViewport.type} -> ${this.viewport.type}`);
      this.needsUpdateFlag = true;
    }
    
    // Always update on resize if responsive
    if (this.config.responsive) {
      this.needsUpdateFlag = true;
    }
  }

  /**
   * Get layout statistics
   * @returns {Object} Layout statistics
   */
  getStatistics() {
    return {
      widgets: this.widgets.size,
      grid: {
        rows: this.config.grid.rows,
        cols: this.config.grid.cols,
        cellWidth: this.grid?.cellWidth || 0,
        cellHeight: this.grid?.cellHeight || 0
      },
      viewport: this.viewport,
      utilization: this.calculateGridUtilization(),
      conflicts: this.detectAllConflicts().length
    };
  }

  /**
   * Initialize grid system
   * @private
   */
  initializeGrid() {
    this.grid = {
      rows: this.config.grid.rows,
      cols: this.config.grid.cols,
      gap: this.config.grid.gap,
      cellWidth: 0,
      cellHeight: 0
    };
    
    this.calculateCellSizes();
  }

  /**
   * Calculate grid cell sizes
   * @private
   */
  calculateCellSizes() {
    if (!this.container) {
      return;
    }

    const availableWidth = this.container.width - (this.grid.gap * (this.grid.cols - 1));
    const availableHeight = this.container.height - (this.grid.gap * (this.grid.rows - 1));
    
    this.grid.cellWidth = Math.max(
      availableWidth / this.grid.cols,
      this.config.grid.minCellSize
    );
    
    this.grid.cellHeight = Math.max(
      availableHeight / this.grid.rows,
      this.config.grid.minCellSize
    );
  }

  /**
   * Update viewport information
   * @private
   */
  updateViewport() {
    if (typeof window !== 'undefined') {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
    } else {
      this.viewportWidth = process.stdout.columns;
      this.viewportHeight = process.stdout.rows;
    }
    
    // Determine viewport type
    if (this.viewport.width <= this.breakpoints.mobile) {
      this.viewport.type = 'mobile';
    } else if (this.viewport.width <= this.breakpoints.tablet) {
      this.viewport.type = 'tablet';
    } else {
      this.viewport.type = 'desktop';
    }
  }

  /**
   * Update responsive grid configuration
   * @private
   */
  updateResponsiveGrid() {
    const originalGrid = { ...this.config.grid };
    
    // Adjust grid based on viewport
    switch (this.viewport.type) {
      case 'mobile':
        this.config.grid.cols = Math.min(originalGrid.cols, 6);
        this.config.grid.rows = Math.max(originalGrid.rows, 16);
        break;
      case 'tablet':
        this.config.grid.cols = Math.min(originalGrid.cols, 8);
        this.config.grid.rows = Math.max(originalGrid.rows, 12);
        break;
      default:
        // Desktop - use original configuration
        this.config.grid = { ...originalGrid };
    }
    
    this.initializeGrid();
  }

  /**
   * Apply styles to container
   * @private
   */
  applyContainerStyles() {
    if (!this.container || !this.container.style) {
      return;
    }

    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.overflow = 'hidden';
  }

  /**
   * Normalize position format
   * @private
   * @param {Array|Object} position - Position in various formats
   * @param {Object} size - Size object (deprecated)
   * @returns {Object} Normalized position
   */
  normalizePosition(position, size) {
    let layout = {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    };

    if (Array.isArray(position)) {
      // Array format: [x, y, width, height]
      const [x, y, width, height] = position;
      layout = { x, y, width, height };
    } else if (position && typeof position === 'object') {
      // Object format: {x, y, width, height}
      layout = { ...layout, ...position };
    }

    // Handle deprecated size parameter
    if (size && typeof size === 'object') {
      layout.width = size.width || layout.width;
      layout.height = size.height || layout.height;
    }

    return layout;
  }

  /**
   * Validate position
   * @private
   * @param {Object} layout - Layout to validate
   */
  validatePosition(layout) {
    const { x, y, width, height } = layout;
    
    if (x < 0 || y < 0) {
      throw new Error('Position coordinates cannot be negative');
    }
    
    if (width <= 0 || height <= 0) {
      throw new Error('Width and height must be positive');
    }
    
    if (x + width > this.grid.cols) {
      throw new Error(`Widget extends beyond grid width (${x + width} > ${this.grid.cols})`);
    }
    
    if (y + height > this.grid.rows) {
      throw new Error(`Widget extends beyond grid height (${y + height} > ${this.grid.rows})`);
    }
  }

  /**
   * Check for layout conflicts
   * @private
   * @param {string} widgetId - Widget ID to exclude from conflict check
   * @param {Object} layout - Layout to check
   * @returns {boolean} Whether there are conflicts
   */
  hasConflict(widgetId, layout) {
    for (const [id, existingLayout] of this.widgets) {
      if (id === widgetId) continue;
      
      if (this.layoutsOverlap(layout, existingLayout)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if two layouts overlap
   * @private
   * @param {Object} layout1 - First layout
   * @param {Object} layout2 - Second layout
   * @returns {boolean} Whether layouts overlap
   */
  layoutsOverlap(layout1, layout2) {
    return !(
      layout1.x + layout1.width <= layout2.x ||
      layout2.x + layout2.width <= layout1.x ||
      layout1.y + layout1.height <= layout2.y ||
      layout2.y + layout2.height <= layout1.y
    );
  }

  /**
   * Find available position for widget
   * @private
   * @param {number} width - Widget width
   * @param {number} height - Widget height
   * @returns {Object} Available position
   */
  findAvailablePosition(width, height) {
    for (let y = 0; y <= this.grid.rows - height; y++) {
      for (let x = 0; x <= this.grid.cols - width; x++) {
        const testLayout = { x, y, width, height };
        if (!this.hasConflict(null, testLayout)) {
          return testLayout;
        }
      }
    }
    
    // If no position found, place at origin (will conflict)
    return { x: 0, y: 0, width, height };
  }

  /**
   * Resolve layout conflict
   * @private
   * @param {Object} layout - Conflicting layout
   * @returns {Object} Resolved layout
   */
  resolveConflict(layout) {
    // Try to find a new position
    const newPosition = this.findAvailablePosition(layout.width, layout.height);
    
    if (!this.hasConflict(null, newPosition)) {
      return { ...layout, ...newPosition };
    }
    
    // If still conflicting, reduce size
    const reducedLayout = {
      ...layout,
      width: Math.max(1, Math.floor(layout.width / 2)),
      height: Math.max(1, Math.floor(layout.height / 2))
    };
    
    return this.findAvailablePosition(reducedLayout.width, reducedLayout.height);
  }

  /**
   * Convert grid coordinates to pixel coordinates
   * @private
   * @param {Object} layout - Grid layout
   * @returns {Object} Pixel coordinates
   */
  gridToPixels(layout) {
    return {
      x: layout.x * (this.grid.cellWidth + this.grid.gap),
      y: layout.y * (this.grid.cellHeight + this.grid.gap),
      width: layout.width * this.grid.cellWidth + (layout.width - 1) * this.grid.gap,
      height: layout.height * this.grid.cellHeight + (layout.height - 1) * this.grid.gap
    };
  }

  /**
   * Calculate grid utilization percentage
   * @private
   * @returns {number} Utilization percentage
   */
  calculateGridUtilization() {
    const totalCells = this.grid.rows * this.grid.cols;
    let usedCells = 0;
    
    for (const layout of this.widgets.values()) {
      usedCells += layout.width * layout.height;
    }
    
    return totalCells > 0 ? (usedCells / totalCells) * 100 : 0;
  }

  /**
   * Detect all layout conflicts
   * @private
   * @returns {Array} Array of conflict information
   */
  detectAllConflicts() {
    const conflicts = [];
    const widgets = Array.from(this.widgets.entries());
    
    for (let i = 0; i < widgets.length; i++) {
      for (let j = i + 1; j < widgets.length; j++) {
        const [id1, layout1] = widgets[i];
        const [id2, layout2] = widgets[j];
        
        if (this.layoutsOverlap(layout1, layout2)) {
          conflicts.push({
            widget1: id1,
            widget2: id2,
            layout1,
            layout2
          });
        }
      }
    }
    
    return conflicts;
  }
}