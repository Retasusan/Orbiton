#!/usr/bin/env node

import blessed from 'blessed';

const screen = blessed.screen();

const box = blessed.box({
  top: 'center',
  left: 'center',
  width: 20,
  height: 5,
  content: 'Hello!',
  border: { type: 'line' }
});

screen.append(box);
screen.render();

screen.key(['q'], () => process.exit(0));

// Simple keep alive
setInterval(() => {}, 1000);