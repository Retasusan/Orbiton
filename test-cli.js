#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('test-cli')
  .description('Test CLI that should stay alive')
  .version('1.0.0');

program
  .command('test')
  .description('Test command that stays alive')
  .action(async () => {
    console.log('Starting test command...');
    
    // Disable console output
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    
    // Create blessed screen
    const blessed = await import('blessed');
    
    const screen = blessed.default.screen({
      smartCSR: true,
      title: 'Test CLI'
    });
    
    const box = blessed.default.box({
      top: 'center',
      left: 'center',
      width: '50%',
      height: '50%',
      content: 'Test CLI is running!\nPress q to quit.',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'white' },
        fg: 'white',
        bg: 'black'
      }
    });
    
    screen.append(box);
    
    screen.key(['q', 'C-c'], () => {
      process.exit(0);
    });
    
    screen.render();
    
    // Keep alive
    return new Promise(() => {});
  });

await program.parseAsync(process.argv);