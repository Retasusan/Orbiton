# Installation Guide

This guide covers all the ways to install and set up Orbiton on your system.

## System Requirements

### Minimum Requirements
- **Node.js**: Version 16.0 or higher
- **npm**: Version 7.0 or higher (comes with Node.js)
- **Terminal**: Any modern terminal with Unicode support
- **Operating System**: macOS, Linux, or Windows

### Recommended Setup
- **Node.js**: Version 18.0 or higher (LTS)
- **Terminal**: iTerm2 (macOS), Windows Terminal (Windows), or modern Linux terminal
- **Memory**: 512MB available RAM
- **Disk Space**: 100MB for installation and plugins

### Terminal Compatibility

**Fully Supported:**
- iTerm2 (macOS)
- Windows Terminal (Windows)
- GNOME Terminal (Linux)
- Konsole (KDE)
- Alacritty
- Hyper

**Basic Support:**
- Terminal.app (macOS)
- Command Prompt (Windows)
- xterm (Linux)

## Installation Methods

### Method 1: Global Installation (Recommended)

Install Orbiton globally to use it from anywhere:

```bash
# Install globally via npm
npm install -g orbiton

# Verify installation
orbiton --version

# Start using Orbiton
orbiton
```

**Advantages:**
- Available from any directory
- Easy to update
- Consistent experience across projects

### Method 2: NPX (No Installation)

Run Orbiton without installing:

```bash
# Run directly with npx
npx orbiton

# Run with specific version
npx orbiton@latest

# Run with options
npx orbiton --preset developer
```

**Advantages:**
- No installation required
- Always uses latest version
- Great for trying Orbiton

### Method 3: Local Development

For contributing or customizing Orbiton:

```bash
# Clone the repository
git clone https://github.com/your-org/orbiton.git
cd orbiton

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build and run
npm run build
npm start
```

**Advantages:**
- Full source code access
- Can modify and contribute
- Development features enabled

### Method 4: Docker (Coming Soon)

```bash
# Run with Docker
docker run -it orbiton/dashboard

# With volume mounting for persistence
docker run -it -v ~/.orbiton:/root/.orbiton orbiton/dashboard
```

## Platform-Specific Instructions

### macOS

#### Using Homebrew (Recommended)
```bash
# Install Node.js via Homebrew
brew install node

# Install Orbiton
npm install -g orbiton

# Start Orbiton
orbiton
```

#### Using Node.js Installer
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Open Terminal and run:
   ```bash
   npm install -g orbiton
   orbiton
   ```

#### Terminal Setup
For the best experience on macOS:

```bash
# Install iTerm2 (recommended)
brew install --cask iterm2

# Or use built-in Terminal.app
# Go to Terminal > Preferences > Profiles > Text
# Enable "Use built-in Powerline glyphs"
```

### Linux

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js and npm
sudo apt install nodejs npm

# Verify versions
node --version  # Should be 16+ 
npm --version   # Should be 7+

# If versions are too old, use NodeSource repository:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Orbiton
npm install -g orbiton

# Start Orbiton
orbiton
```

#### CentOS/RHEL/Fedora
```bash
# Install Node.js and npm
sudo dnf install nodejs npm

# Or for older versions:
sudo yum install nodejs npm

# Install Orbiton
npm install -g orbiton

# Start Orbiton
orbiton
```

#### Arch Linux
```bash
# Install Node.js and npm
sudo pacman -S nodejs npm

# Install Orbiton
npm install -g orbiton

# Start Orbiton
orbiton
```

### Windows

#### Using Node.js Installer (Recommended)
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Run the installer (includes npm)
3. Open Command Prompt or PowerShell as Administrator
4. Install Orbiton:
   ```cmd
   npm install -g orbiton
   orbiton
   ```

#### Using Chocolatey
```powershell
# Install Chocolatey (if not already installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Install Orbiton
npm install -g orbiton

# Start Orbiton
orbiton
```

#### Using Windows Subsystem for Linux (WSL)
```bash
# In WSL terminal, follow Linux instructions
sudo apt update
sudo apt install nodejs npm
npm install -g orbiton
orbiton
```

#### Terminal Setup for Windows
For the best experience on Windows:

1. **Install Windows Terminal** (recommended):
   - Download from Microsoft Store
   - Or download from [GitHub](https://github.com/microsoft/terminal)

2. **Configure Windows Terminal**:
   ```json
   {
     "profiles": {
       "defaults": {
         "fontFace": "Cascadia Code",
         "fontSize": 12,
         "colorScheme": "Campbell"
       }
     }
   }
   ```

## Post-Installation Setup

### First Run

After installation, run Orbiton for the first time:

```bash
orbiton
```

Orbiton will:
1. Detect your system environment
2. Create a default configuration
3. Suggest relevant plugins
4. Start the dashboard

### Configuration Directory

Orbiton creates configuration files in:

- **macOS/Linux**: `~/.orbiton/`
- **Windows**: `%USERPROFILE%\.orbiton\`

Contents:
```
~/.orbiton/
├── config.json          # Main configuration
├── plugins/             # Local plugins
├── themes/              # Custom themes
├── cache/               # Cached data
└── logs/                # Log files
```

### Environment Variables

Optional environment variables:

```bash
# Custom configuration directory
export ORBITON_CONFIG_DIR="/path/to/config"

# Debug mode
export ORBITON_DEBUG=true

# Custom plugin directory
export ORBITON_PLUGIN_DIR="/path/to/plugins"

# Disable auto-detection
export ORBITON_AUTO_DETECT=false
```

## Verification

### Check Installation

```bash
# Check Orbiton version
orbiton --version

# Check Node.js version
node --version

# Check npm version
npm --version

# Run system check
orbiton doctor
```

### Test Basic Functionality

```bash
# Start with minimal configuration
orbiton --preset minimal

# Test plugin system
orbiton plugin list

# Test configuration
orbiton config validate
```

## Updating

### Update Global Installation

```bash
# Update to latest version
npm update -g orbiton

# Or reinstall
npm uninstall -g orbiton
npm install -g orbiton

# Check new version
orbiton --version
```

### Update Local Development

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Rebuild if necessary
npm run build
```

## Uninstallation

### Remove Global Installation

```bash
# Uninstall Orbiton
npm uninstall -g orbiton

# Remove configuration (optional)
rm -rf ~/.orbiton
```

### Remove Local Development

```bash
# Remove project directory
rm -rf /path/to/orbiton

# Remove global symlinks (if any)
npm unlink
```

## Troubleshooting Installation

### Common Issues

#### Permission Errors (macOS/Linux)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use a Node version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
nvm use node
```

#### Windows Permission Errors
```powershell
# Run as Administrator
# Or change npm prefix
npm config set prefix %APPDATA%\npm
```

#### Node.js Version Issues
```bash
# Check current version
node --version

# Update Node.js
# macOS with Homebrew:
brew upgrade node

# Linux:
sudo apt update && sudo apt upgrade nodejs

# Windows: Download new installer from nodejs.org
```

#### Network Issues
```bash
# Check npm registry
npm config get registry

# Use different registry if needed
npm config set registry https://registry.npmjs.org/

# Clear npm cache
npm cache clean --force
```

#### Terminal Compatibility Issues
```bash
# Check terminal capabilities
echo $TERM
tput colors

# Set terminal type if needed
export TERM=xterm-256color

# Test Unicode support
echo "Unicode test: ✓ ✗ ▲ ▼ ◆ ●"
```

### Getting Help

If you encounter issues:

1. **Check the troubleshooting guide**: `docs/troubleshooting.md`
2. **Run diagnostics**: `orbiton doctor`
3. **Enable debug mode**: `orbiton --debug`
4. **Check system requirements** above
5. **Search existing issues**: GitHub Issues
6. **Ask for help**: Discord community or GitHub Discussions

## Next Steps

After successful installation:

1. **Read the User Guide**: `docs/user-guide.md`
2. **Explore Built-in Plugins**: `orbiton plugin list`
3. **Customize Configuration**: `orbiton config init`
4. **Try Plugin Development**: `docs/plugin-development.md`
5. **Join the Community**: Discord, GitHub Discussions

Congratulations! You're ready to use Orbiton. 🎉