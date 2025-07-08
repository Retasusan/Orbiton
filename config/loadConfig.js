import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function loadUserConfig() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const configPath = path.join(__dirname, "..", ".orbitonrc.json");

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `🚫 Configuration file not found at:\n  ${configPath}\n\n` +
        `Please create a ".orbitonrc.json" file in the project root or your home directory.\n` +
        `Example content:\n\n` +
        `{\n  "preset": "developer",\n  "custom": false, \n  "plugins": ["weather"]\n}`
    );
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in .orbitonrc.json");
    return { preset: "developer", custom: false, plugins: [] };
  }
}
