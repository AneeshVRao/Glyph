# Glyph - Terminal Notes

A terminal-style, local-first note-taking application with powerful keyboard-driven workflows.

## Features

- 🖥️ **Terminal Interface**: Classic terminal aesthetic with CRT effects
- 💾 **Local-First**: All data stored locally in IndexedDB - no server required
- 🔍 **Powerful Search**: Full-text search across all notes
- 🏷️ **Tag System**: Organize notes with tags
- ⚡ **Keyboard-Driven**: Fast, keyboard-focused workflow
- 🎨 **Themes**: Multiple color themes (CRT, Matrix, Solarized, Dracula)
- 📅 **Daily Notes**: Quick access to today's note
- ♻️ **Undo Delete**: Recently deleted notes can be restored
- 📤 **Export/Import**: Backup and restore your notes as JSON

## Tech Stack

- **Vite** - Build tool
- **React** - UI framework
- **TypeScript** - Type safety
- **Dexie** - IndexedDB wrapper
- **shadcn-ui** - UI components
- **Tailwind CSS** - Styling

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun

### Installation

```sh
# Clone the repository
git clone https://github.com/AneeshVRao/Glyph.git

# Navigate to the project directory
cd Glyph

# Install dependencies
npm install
# or
bun install

# Start the development server
npm run dev
# or
bun run dev
```

The app will be available at `http://localhost:8080`

## Commands

Type `help` in the terminal to see all available commands:

### Notes

- `new "title"` - Create a new note
- `list [limit]` - List all notes
- `open <id|title>` - View a note
- `edit <id>` - Edit a note
- `delete <id>` - Delete a note
- `restore <id>` - Restore a deleted note
- `trash` - List recently deleted notes

### Search

- `search <query>` - Search notes
- `tags [name]` - List all tags or filter by tag

### Daily

- `today` - Open or create today's note

### Data

- `export` - Export all notes as JSON
- `import` - Import notes from JSON file

### Config

- `config list` - Show all settings
- `config <key> <value>` - Update a setting
- `config theme <name>` - Change theme (crt, matrix, solarized, dracula, nord, cyberpunk, terminal)

### Other

- `clear` - Clear terminal
- `version` - Show version info

## Keyboard Shortcuts

### Terminal

- `Tab` - Autocomplete commands and note titles
- `↑/↓` - Navigate command history
- `Ctrl+L` - Clear terminal

### Editor

- `Escape` - Save and close editor
- `Ctrl+Q` - Close without saving
- `Ctrl+T` - Toggle between edit and tags mode

## Building for Production

```sh
npm run build
# or
bun run build
```

The production-ready files will be in the `dist` directory.

## License

MIT

## Author

Aneesh V Rao - [GitHub](https://github.com/AneeshVRao)
