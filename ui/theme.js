import path from "path";
import fs from "fs";

let currentTheme = null;

export async function loadTheme(name = "default") {
  const themePath = path.resolve("ui", "themes", `${name}.js`);
  if (!fs.existsSync(themePath)) {
    console.warn(`Theme "${name}" not found. Falling back to "default".`);
    name = "default";
  }

  currentTheme = (await import(`file://${themePath}`)).default;
  return currentTheme;
}

export function getTheme() {
  if (!currentTheme) {
    throw new Error("Theme not loaded. Call loadTheme() first.");
  }
  return currentTheme;
}
