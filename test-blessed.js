#!/usr/bin/env node

import blessed from 'blessed';

// Create screen without any console.log to avoid interfering with blessed
const screen = blessed.screen({
  smartCSR: true,
  title: 'Test Dashboard'
});

const box = blessed.box({
  top: 'center',
  left: 'center',
  width: '50%',
  height: '50%',
  content: 'Hello World!\n\nPress q or Ctrl+C to quit.',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    bg: 'blue',
    border: {
      fg: '#f0f0f0'
    }
  }
});

screen.append(box);

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render();

// Keep the process alive by listening to the screen
screen.on('destroy', () => {
  process.exit(0);
});