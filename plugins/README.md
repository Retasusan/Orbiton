# Plugins

## How to Use Plugins in Orbiton

## How to Create a Plugin for Orbiton

Orbiton plugins let you add custom widgets (like system monitors, charts, logs, etc.) to your dashboard. This guide walks you through creating one from scratch.

---

### 1. Create a Plugin File

Create a new Folder in your plugin folder:

```bash
$ cd plugins
$ mkdir myPlugin
```

---

## 2. Export `createWidget(grid, position, options)` Function

Each plugin must export a `createWidget` function. This function receives:

- `grid`: the layout grid from `blessed-contrib`
- `position`: an array like `[row, col, rowSpan, colSpan]`
- `options`: optional custom configuration

### Example

```js
import blessed from "blessed";

export function createWidget(grid, [row, col, rowSpan, colSpan], options = {}) {
  const box = grid.set(row, col, rowSpan, colSpan, blessed.box, {
    label: "My Plugin",
    content: "Hello from my plugin!",
    border: "line",
    style: {
      border: { fg: "cyan" },
      fg: "white",
      bg: "black",
    },
  });

  // Optional: Update periodically
  const timer = setInterval(() => {
    box.setContent(`Updated: ${new Date().toLocaleTimeString()}`);
    box.screen.render();
  }, options.updateInterval || 1000);

  // Clean up on destroy
  box.on("destroy", () => clearInterval(timer));

  return box;
}
```

<!-- ## 3. Add the Plugin to Your Config

In orbiton.config.js, register your plugin:

```js
export default {
  plugins: [
    {
      path: "./plugins/myPlugin.js",
      position: [0, 0, 6, 6], // row, col, rowSpan, colSpan
      options: { updateInterval: 1000 },
    },
  ],
};
``` -->

## 3. Make default.json to Configure Default settings to Your Plugin

Create a `default.json` file in your plugin folder to define default settings:

```json
{
  "updateInterval": 1000
}
```

## 4. Add Your Configuration to `.orbitonrc.json`

```json
{
  "plugins": [
    {
      "name": "myPlugin",
      "path": "./plugins/myPlugin.js",
      "position": [0, 0, 6, 6],
      "options": { "updateInterval": 1000 }
    }
  ]
}
```

## 4. Run the Dashboard

```bash
$ npm start
```

Your plugin should now appear on the dashboard!

🔍 Tips
Use blessed-contrib for charts like donut, line, bar, etc.
Start Orbiton:

Make long content scrollable with:

## Resources

- blessed
- blessed-contrib
