/**
 * @fileoverview GitHub Status Widget Plugin
 * 
 * A comprehensive GitHub user status widget that displays user information,
 * recent activity, and open pull requests using the new DataWidget system.
 * 
 * @author Orbiton Team
 * @version 2.0.0
 */

import { DataWidget } from '../../src/plugins/DataWidget.js';
import blessed from 'blessed';

/**
 * GitHub status widget that displays user information and activity
 */
export default class GitHubStatusWidget extends DataWidget {
  constructor(name, options = {}, context = {}) {
    super(name, options, context);
    
    // GitHub API configuration
    this.apiBase = 'https://api.github.com';
    this.userAgent = 'orbiton-github-status-plugin';
    
    // GitHub data cache
    this.githubData = {
      user: null,
      events: [],
      pullRequests: [],
      lastFetch: null
    };
  }

  /**
   * Get options schema for validation
   * @returns {Object} JSON schema for options
   */
  getOptionsSchema() {
    return {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Widget title',
          default: 'GitHub Status'
        },
        updateInterval: {
          type: 'number',
          description: 'Update interval in milliseconds',
          minimum: 60000, // Minimum 1 minute to respect API limits
          default: 300000 // 5 minutes
        },
        username: {
          type: 'string',
          description: 'GitHub username to monitor'
        },
        token: {
          type: 'string',
          description: 'GitHub personal access token (optional but recommended)'
        },
        showEvents: {
          type: 'boolean',
          description: 'Whether to show recent events',
          default: true
        },
        showPullRequests: {
          type: 'boolean',
          description: 'Whether to show open pull requests',
          default: true
        },
        maxEvents: {
          type: 'number',
          description: 'Maximum number of events to display',
          minimum: 1,
          maximum: 20,
          default: 5
        },
        maxPullRequests: {
          type: 'number',
          description: 'Maximum number of pull requests to display',
          minimum: 1,
          maximum: 20,
          default: 10
        },
        maxRepos: {
          type: 'number',
          description: 'Maximum number of repositories to check for PRs',
          minimum: 1,
          maximum: 10,
          default: 5
        }
      },
      required: ['username']
    };
  }

  /**
   * Get default options
   * @returns {Object} Default options
   */
  getDefaultOptions() {
    return {
      title: 'GitHub Status',
      updateInterval: 300000,
      showEvents: true,
      showPullRequests: true,
      maxEvents: 5,
      maxPullRequests: 10,
      maxRepos: 5
    };
  }

  /**
   * Perform widget-specific initialization
   * @returns {Promise<void>}
   */
  async performInitialization() {
    this.logger.debug('Initializing GitHub status widget');
    
    if (!this.options.username) {
      throw new Error('GitHub username is required');
    }
    
    this.logger.debug(`Monitoring GitHub user: ${this.options.username}`);
  }

  /**
   * Create the main UI element
   * @returns {Promise<void>}
   */
  async createElement() {
    // Create main container
    this.element = blessed.box({
      label: this.options.title || 'GitHub Status',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: this.theme.border || 'cyan' },
        fg: this.theme.fg || 'white',
        bg: this.theme.bg || 'black'
      },
      padding: { left: 2, right: 2, top: 1, bottom: 1 },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true
    });
  }

  /**
   * Fetch GitHub data
   * @returns {Promise<Object>} GitHub data
   */
  async fetchData() {
    try {
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': this.userAgent
      };

      // Add authorization header if token is provided
      if (this.options.token) {
        headers['Authorization'] = `token ${this.options.token}`;
      }

      const [user, events, pullRequests] = await Promise.all([
        this.fetchUserInfo(headers),
        this.options.showEvents ? this.fetchUserEvents(headers) : [],
        this.options.showPullRequests ? this.fetchOpenPullRequests(headers) : []
      ]);

      const data = {
        user,
        events: events.slice(0, this.options.maxEvents),
        pullRequests: pullRequests.slice(0, this.options.maxPullRequests),
        lastFetch: new Date()
      };

      this.githubData = data;
      return data;

    } catch (error) {
      this.logger.error('Failed to fetch GitHub data:', error);
      throw error;
    }
  }

  /**
   * Fetch user information from GitHub API
   * @param {Object} headers - Request headers
   * @returns {Promise<Object>} User information
   */
  async fetchUserInfo(headers) {
    const response = await fetch(`${this.apiBase}/users/${this.options.username}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info (status: ${response.status})`);
    }

    return await response.json();
  }

  /**
   * Fetch user events from GitHub API
   * @param {Object} headers - Request headers
   * @returns {Promise<Array>} User events
   */
  async fetchUserEvents(headers) {
    const response = await fetch(`${this.apiBase}/users/${this.options.username}/events`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events (status: ${response.status})`);
    }

    return await response.json();
  }

  /**
   * Fetch open pull requests from user's repositories
   * @param {Object} headers - Request headers
   * @returns {Promise<Array>} Open pull requests
   */
  async fetchOpenPullRequests(headers) {
    try {
      // Get user's repositories
      const reposResponse = await fetch(
        `${this.apiBase}/users/${this.options.username}/repos?per_page=50&type=owner&sort=updated`,
        { headers }
      );

      if (!reposResponse.ok) {
        throw new Error(`Failed to fetch repos (status: ${reposResponse.status})`);
      }

      const repos = await reposResponse.json();
      const pullRequests = [];

      // Fetch PRs from first N repositories to avoid API limits
      for (const repo of repos.slice(0, this.options.maxRepos)) {
        try {
          const prsResponse = await fetch(
            `${this.apiBase}/repos/${this.options.username}/${repo.name}/pulls?state=open&per_page=5`,
            { headers }
          );

          if (prsResponse.ok) {
            const repoPRs = await prsResponse.json();
            for (const pr of repoPRs) {
              pullRequests.push({
                repo: repo.name,
                number: pr.number,
                title: pr.title,
                url: pr.html_url,
                created_at: pr.created_at,
                state: pr.state
              });
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch PRs for repo ${repo.name}:`, error);
        }
      }

      return pullRequests;

    } catch (error) {
      this.logger.warn('Failed to fetch pull requests:', error);
      return [];
    }
  }

  /**
   * Update widget content with fetched data
   * @returns {Promise<void>}
   */
  async updateContent() {
    if (!this.data) return;

    try {
      const content = this.formatGitHubData(this.data);
      this.element.setContent(content);
      
    } catch (error) {
      this.logger.error('Failed to update content:', error);
      this.showErrorState(error);
    }
  }

  /**
   * Format GitHub data for display
   * @param {Object} data - GitHub data
   * @returns {string} Formatted content
   */
  formatGitHubData(data) {
    const { user, events, pullRequests } = data;

    let content = `{bold}GitHub User Information{/bold}\n\n`;
    content += `Username       : {cyan-fg}${user.login}{/cyan-fg}\n`;
    content += `Name           : {green-fg}${user.name || 'N/A'}{/green-fg}\n`;
    content += `Profile URL    : {underline}${user.html_url}{/underline}\n`;
    content += `Public Repos   : {yellow-fg}${user.public_repos}{/yellow-fg}\n`;
    content += `Followers      : {yellow-fg}${user.followers}{/yellow-fg}\n`;
    content += `Following      : {yellow-fg}${user.following}{/yellow-fg}\n`;

    if (user.bio) {
      content += `Bio            : ${user.bio}\n`;
    }

    if (user.location) {
      content += `Location       : ${user.location}\n`;
    }

    if (user.company) {
      content += `Company        : ${user.company}\n`;
    }

    content += `\n`;

    // Show recent events if enabled
    if (this.options.showEvents && events.length > 0) {
      content += `{bold}Recent Activity{/bold}\n`;
      for (const event of events) {
        const date = this.formatDate(event.created_at);
        const eventType = this.formatEventType(event.type);
        const repoName = event.repo ? event.repo.name : 'Unknown';
        
        content += `• {cyan-fg}${eventType}{/cyan-fg} in {yellow-fg}${repoName}{/yellow-fg} - {gray-fg}${date}{/gray-fg}\n`;
      }
      content += `\n`;
    }

    // Show open pull requests if enabled
    if (this.options.showPullRequests && pullRequests.length > 0) {
      content += `{bold}Open Pull Requests{/bold}\n`;
      for (const pr of pullRequests) {
        const date = this.formatDate(pr.created_at);
        content += `#{green-fg}${pr.number}{/green-fg} [{yellow-fg}${pr.repo}{/yellow-fg}] ${pr.title}\n`;
        content += `  Created: {gray-fg}${date}{/gray-fg}\n`;
        content += `  URL: {underline}${pr.url}{/underline}\n\n`;
      }
    } else if (this.options.showPullRequests) {
      content += `{bold}Open Pull Requests{/bold}\n`;
      content += `No open pull requests found.\n\n`;
    }

    content += `{gray-fg}Last updated: ${this.formatDate(data.lastFetch.toISOString())}{/gray-fg}\n`;
    content += `{gray-fg}Note: Visit https://github.com/${user.login} for full profile{/gray-fg}`;

    return content;
  }

  /**
   * Format date for display
   * @param {string} dateStr - ISO date string
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  /**
   * Format GitHub event type for display
   * @param {string} eventType - GitHub event type
   * @returns {string} Formatted event type
   */
  formatEventType(eventType) {
    const eventTypes = {
      'PushEvent': 'Push',
      'CreateEvent': 'Create',
      'DeleteEvent': 'Delete',
      'PullRequestEvent': 'Pull Request',
      'IssuesEvent': 'Issue',
      'IssueCommentEvent': 'Comment',
      'WatchEvent': 'Star',
      'ForkEvent': 'Fork',
      'ReleaseEvent': 'Release',
      'PublicEvent': 'Made Public'
    };

    return eventTypes[eventType] || eventType.replace('Event', '');
  }

  /**
   * Show error state in the widget
   * @param {Error} error - The error to display
   */
  showErrorState(error) {
    let errorContent = `{red-fg}Failed to fetch GitHub data: ${error.message}{/red-fg}\n\n`;
    
    if (error.message.includes('status: 401')) {
      errorContent += `{yellow-fg}Authentication failed. Please check your GitHub token.{/yellow-fg}\n`;
    } else if (error.message.includes('status: 403')) {
      errorContent += `{yellow-fg}API rate limit exceeded. Consider using a GitHub token.{/yellow-fg}\n`;
    } else if (error.message.includes('status: 404')) {
      errorContent += `{yellow-fg}User '${this.options.username}' not found.{/yellow-fg}\n`;
    }
    
    errorContent += `{gray-fg}Press 'r' to retry{/gray-fg}`;
    
    this.element.setContent(errorContent);
  }

  /**
   * Perform widget-specific cleanup
   * @returns {Promise<void>}
   */
  async performDestroy() {
    // Clear data cache
    this.githubData = null;
    
    this.logger.debug('GitHub status widget cleanup completed');
  }

  /**
   * Set up event handlers for the widget
   * @protected
   */
  setupEventHandlers() {
    super.setupEventHandlers();
    
    if (!this.element) return;
    
    // Add GitHub-specific key handlers
    this.element.key(['g'], () => {
      // Open GitHub profile in browser (if possible)
      if (this.data && this.data.user) {
        this.logger.info(`GitHub profile: ${this.data.user.html_url}`);
      }
    });
    
    this.element.key(['e'], () => {
      // Toggle events display
      this.options.showEvents = !this.options.showEvents;
      this.updateContent();
      if (this.element.screen) this.element.screen.render();
    });
    
    this.element.key(['p'], () => {
      // Toggle pull requests display
      this.options.showPullRequests = !this.options.showPullRequests;
      this.updateContent();
      if (this.element.screen) this.element.screen.render();
    });
  }
}