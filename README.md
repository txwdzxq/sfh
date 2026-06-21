# SSH FTP Hollow

A Vue and TypeScript Electron application built entirely using OpenCode  
Mainly used for SSH connections and small file transfers (<100M)  

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

### User Data

Connections and settings are stored in `{userData}/config/`:

| File | Description |
|---|---|
| `connections.json` | Saved SSH connections |
| `settings.json` | App settings (theme, font, locale, etc.) |

User data directory by platform:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\sfh\config\` |
| macOS | `~/Library/Application Support/sfh/config/` |
| Linux | `~/.config/sfh/config/` |

