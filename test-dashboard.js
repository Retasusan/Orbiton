#!/usr/bin/env node

import blessed from 'blessed';

// Disable console output to avoid interfering with blessed
console.log = () => {};
console.error = () => {};
console.warn = () => {};

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Orbiton Dashboard',
  cursor: {
    artificial: true,
    shape: 'line',
    blink: true,
    color: null
  },
  debug: false,
  fullUnicode: true,
  dockBorders: true,
  autoPadding: true,
});

// Create a simple widget
const clockBox = blessed.box({
  top: 0,
  left: 0,
  width: '50%',
  height: '50%',
  label: 'Clock',
  content: 'Current time: ' + new Date().toLocaleTimeString(),
  tags: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'white' },
    fg: 'white',
    bg: 'black'
  }
});

const infoBox = blessed.box({
  top: 0,
  left: '50%',
  width: '50%',
  height: '50%',
  label: 'System Info',
  content: 'System: ' + process.platform + '\nNode: ' + process.version,
  tags: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'white' },
    fg: 'white',
    bg: 'black'
  }
});

const statusBox = blessed.box({
  top: '50%',
  left: 0,
  width: '100%',
  height: '50%',
  label: 'Status',
  content: 'Dashboard is running!\n\nPress q, Ctrl+C, or Escape to quit.',
  tags: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'white' },
    fg: 'white',
    bg: 'black'
  }
});

screen.append(clockBox);
screen.append(infoBox);
screen.append(statusBox);

// Set up key handlers
screen.key(['escape', 'q', 'C-c'], (ch, key) => {
  return process.exit(0);
});

// Update clock every second
setInterval(() => {
  clockBox.setContent('Current time: ' + new Date().toLocaleTimeString());
  screen.render();
}, 1000);

// Render the screen
screen.render();

// The blessed screen should now keep the process alive