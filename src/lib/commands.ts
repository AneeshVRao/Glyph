import {
  createNote,
  updateNote,
  deleteNote,
  undoDelete,
  getNote,
  listNotes,
  searchNotes,
  getAllTags,
  getNotesByTag,
  createOrGetTodayNote,
  exportNotes,
  importNotes,
  getRecentlyDeleted,
  purgeNote,
  getConfig,
  setConfig,
  getAllConfig,
  getNoteTitles,
  togglePin,
  createFolder,
  getFolder,
  listFolders,
  getFolderContents,
  type Note,
  type Folder,
  type DeletedNote,
} from "./db";
import { AVAILABLE_THEMES } from "@/hooks/useConfig";

export type OutputAction =
  | { type: 'open'; id: number }
  | { type: 'cd'; path: string }
  | { type: 'run'; command: string };

export type OutputLine = {
  type:
  | "prompt"
  | "output"
  | "error"
  | "warning"
  | "info"
  | "success"
  | "success"
  | "dim"
  | "markdown"
  | "highlight";
  content: string;
  timestamp?: number;
  action?: OutputAction;
};

export interface ShellContext {
  currentPath: number | undefined;
  setCurrentPath: (id: number | undefined) => void;
  pathString: string;
  stdin?: string[];
}

export type CommandResult = {
  output: OutputLine[];
  openEditor?: { note: Note; isNew: boolean };
  shouldClear?: boolean;
  triggerExport?: boolean;
  triggerImport?: boolean;
  pendingUndo?: { noteId: number; title: string };
};

// Command definitions for help and autocomplete
const COMMAND_DEFINITIONS = {
  // Notes
  new: {
    usage: 'new "title"',
    desc: "Create a new note",
    examples: ['new "My Ideas"', "new project-notes"],
    category: "notes",
    aliases: ["create", "add", "touch"],
  },
  mkdir: {
    usage: 'mkdir <name>',
    desc: "Create a new directory",
    examples: ['mkdir projects', 'mkdir "my stuff"'],
    category: "item",
    aliases: ["md"],
  },
  cd: {
    usage: "cd <path>",
    desc: "Change directory",
    examples: ["cd projects", "cd ..", "cd ~"],
    category: "item",
    aliases: ["chdir"],
  },
  pwd: {
    usage: "pwd",
    desc: "Print working directory",
    examples: ["pwd"],
    category: "item",
    aliases: [],
  },
  list: {
    usage: "list",
    desc: "List directory contents",
    examples: ["list", "ls"],
    category: "item",
    aliases: ["ls", "dir", "ll"],
  },
  open: {
    usage: "open <id|title>",
    desc: "View a note",
    examples: ["open 1", 'open "My Ideas"'],
    category: "notes",
    aliases: ["view", "show"],
  },
  edit: {
    usage: "edit <id>",
    desc: "Edit a note",
    examples: ["edit 1"],
    category: "notes",
    aliases: ["e"],
  },
  delete: {
    usage: "delete <id>",
    desc: "Delete a note (with undo)",
    examples: ["delete 1"],
    category: "notes",
    aliases: ["rm", "remove"],
  },
  restore: {
    usage: "restore <id>",
    desc: "Restore a deleted note",
    examples: ["restore 1"],
    category: "notes",
    aliases: ["undo", "undelete"],
  },
  trash: {
    usage: "trash",
    desc: "List recently deleted notes",
    examples: ["trash"],
    category: "notes",
    aliases: ["deleted"],
  },
  pin: {
    usage: "pin <id>",
    desc: "Pin a note to the top",
    examples: ["pin 1"],
    category: "notes",
    aliases: ["star", "favorite"],
  },
  unpin: {
    usage: "unpin <id>",
    desc: "Unpin a note",
    examples: ["unpin 1"],
    category: "notes",
    aliases: ["unstar"],
  },
  rename: {
    usage: 'rename <id> "new title"',
    desc: "Rename a note",
    examples: ['rename 1 "New Title"'],
    category: "notes",
    aliases: ["mv"],
  },
  purge: {
    usage: "purge <id>",
    desc: "Permanently delete from trash",
    examples: ["purge 1"],
    category: "notes",
    aliases: [],
  },

  // Search
  search: {
    usage: "search <query>",
    desc: "Search notes",
    examples: ["search javascript", 'search "my idea"'],
    category: "search",
    aliases: ["find"],
  },
  grep: {
    usage: "grep <pattern>",
    desc: "Filter output",
    examples: ['list | grep "work"', 'list | grep #1'],
    category: "item",
    aliases: ["filter"],
  },
  tags: {
    usage: "tags [name]",
    desc: "List tags or filter by tag",
    examples: ["tags", "tags work"],
    category: "search",
    aliases: [],
  },

  // Daily
  today: {
    usage: "today",
    desc: "Open today's daily note",
    examples: ["today"],
    category: "daily",
    aliases: ["daily"],
  },

  // Data
  export: {
    usage: "export",
    desc: "Download notes as JSON",
    examples: ["export"],
    category: "data",
    aliases: ["backup"],
  },
  import: {
    usage: "import",
    desc: "Import notes from JSON",
    examples: ["import"],
    category: "data",
    aliases: [],
  },

  // Config
  config: {
    usage: "config [key] [value]",
    desc: "View or set configuration",
    examples: ["config", "config theme amber", "config scanlines false"],
    category: "config",
    aliases: ["set", "settings"],
  },

  // Other
  clear: {
    usage: "clear",
    desc: "Clear terminal",
    examples: ["clear"],
    category: "other",
    aliases: ["cls"],
  },
  version: {
    usage: "version",
    desc: "Show version info",
    examples: ["version"],
    category: "other",
    aliases: ["v"],
  },
  stats: {
    usage: "stats",
    desc: "Show note statistics",
    examples: ["stats"],
    category: "other",
    aliases: ["info"],
  },
  help: {
    usage: "help [command]",
    desc: "Show help",
    examples: ["help", "help edit", "help search"],
    category: "other",
    aliases: ["?", "h"],
  },
};

// Get all command names including aliases
export function getAllCommands(): string[] {
  const commands: string[] = [];
  Object.entries(COMMAND_DEFINITIONS).forEach(([cmd, def]) => {
    commands.push(cmd);
    commands.push(...def.aliases);
  });
  return [...new Set(commands)];
}

// Fuzzy match for command suggestions
function findSimilarCommand(input: string): string | null {
  const commands = Object.keys(COMMAND_DEFINITIONS);
  const lowerInput = input.toLowerCase();

  // Check aliases first
  for (const [cmd, def] of Object.entries(COMMAND_DEFINITIONS)) {
    if (def.aliases.includes(lowerInput)) {
      return cmd;
    }
  }

  // Simple Levenshtein-like similarity
  let bestMatch = "";
  let bestScore = Infinity;

  for (const cmd of commands) {
    if (cmd.startsWith(lowerInput) || lowerInput.startsWith(cmd)) {
      return cmd;
    }

    // Calculate simple edit distance
    let distance = 0;
    const minLen = Math.min(cmd.length, lowerInput.length);
    const maxLen = Math.max(cmd.length, lowerInput.length);

    for (let i = 0; i < minLen; i++) {
      if (cmd[i] !== lowerInput[i]) distance++;
    }
    distance += maxLen - minLen;

    if (distance < bestScore && distance <= 2) {
      bestScore = distance;
      bestMatch = cmd;
    }
  }

  return bestMatch || null;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNoteRow(note: Note, highlightQuery?: string): string {
  const id = String(note.id).padStart(4, " ");
  let title =
    note.title.length > 40
      ? note.title.slice(0, 37) + "..."
      : note.title.padEnd(40, " ");

  // Add highlight markers if query matches
  if (highlightQuery) {
    const lowerTitle = title.toLowerCase();
    const lowerQuery = highlightQuery.toLowerCase();
    const idx = lowerTitle.indexOf(lowerQuery);
    if (idx !== -1) {
      title =
        title.slice(0, idx) +
        "»" +
        title.slice(idx, idx + highlightQuery.length) +
        "«" +
        title.slice(idx + highlightQuery.length);
    }
  }

  const tags = note.tags.length > 0 ? `[${note.tags.join(", ")}]` : "";
  const pinned = note.pinned ? "📌 " : "";
  return `${pinned}#${id}  ${title}  ${tags}`;
}

// Resolve command aliases
function resolveAlias(cmd: string): string {
  for (const [command, def] of Object.entries(COMMAND_DEFINITIONS)) {
    if (command === cmd || def.aliases.includes(cmd)) {
      return command;
    }
  }
  return cmd;
}

export async function parseAndExecute(input: string, context: ShellContext): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { output: [] };
  }

  // Security: reject excessively long input
  if (trimmed.length > 1000) {
    return {
      output: [
        { type: "error", content: "Input too long (max 1000 characters)" },
      ],
    };
  }

  // Parse command and arguments
  // Parse command and arguments (allow hyphens in command names)
  const match = trimmed.match(/^([\w-]+)(?:\s+(.*))?$/s);
  if (!match) {
    return {
      output: [
        { type: "error", content: `Invalid command format: ${trimmed}` },
      ],
    };
  }

  const [, command, argsStr = ""] = match;
  const cmd = resolveAlias(command.toLowerCase());

  try {
    switch (cmd) {
      case "help":
        return showHelp(argsStr.trim());

      case "new":
        return await handleNew(argsStr, context);

      case "grep":
        return handleGrep(argsStr, context);

      case "mkdir":
        return await handleMkdir(argsStr, context);

      case "cd":
        return await handleCd(argsStr, context);

      case "pwd":
        return {
          output: [{ type: "info", content: context.pathString }],
        };

      case "list":
        return await handleList(context);

      case "open":
        return await handleOpen(argsStr);

      case "edit":
        return await handleEdit(argsStr);

      case "delete":
        return await handleDelete(argsStr);

      case "restore":
        return await handleRestore(argsStr);

      case "trash":
        return await handleTrash();

      case "rename":
        return await handleRename(argsStr);

      case "purge":
        return await handlePurge(argsStr);

      case "search":
        return await handleSearch(argsStr);

      case "tags":
        return await handleTags(argsStr);

      case "today":
        return await handleToday();

      case "export":
        return {
          output: [{ type: "success", content: "Initiating export..." }],
          triggerExport: true,
        };

      case "import":
        return handleImport();

      case "config":
        return await handleConfig(argsStr);

      case "clear":
        return { output: [], shouldClear: true };

      case "pin":
        return await handlePin(argsStr);

      case "unpin":
        return await handleUnpin(argsStr);

      case "version":
        return {
          output: [
            {
              type: "info",
              content: `
  ________    __  ______  __  __ 
 / ____/ /   / / / / __ \\/ / / / 
/ / __/ /   / /_/ / /_/ / /_/ /  
/ /_/ / /___/ __  / ____/ __  /   
\\____/_____/_/ /_/_/   /_/ /_/    v2.1.0
`,
            },
            {
              type: "dim",
              content: "Terminal-style note-taking • Local-first • Offline",
            },
            { type: "output", content: "" },
            { type: "dim", content: "Created by Aneesh V Rao" },
          ],
        };

      case "stats":
        return await handleStats();

      default: {
        const suggestion = findSimilarCommand(command);
        const output: OutputLine[] = [
          { type: "error", content: `Unknown command: \`${command}\`` },
        ];

        if (suggestion) {
          output.push({
            type: "info",
            content: `Did you mean: \`${suggestion}\`?`,
          });
        }

        output.push({
          type: "dim",
          content: 'Type "help" for available commands',
        });

        return { output };
      }
    }
  } catch (error) {
    return {
      output: [
        {
          type: "error",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"
            }`,
        },
      ],
    };
  }
}

function showHelp(specificCommand?: string): CommandResult {
  // Help for specific command
  if (specificCommand) {
    const cmd = resolveAlias(specificCommand.toLowerCase());
    const def = COMMAND_DEFINITIONS[cmd as keyof typeof COMMAND_DEFINITIONS];

    if (!def) {
      return {
        output: [
          { type: "error", content: `Unknown command: ${specificCommand}` },
          { type: "dim", content: 'Type "help" to see all commands' },
        ],
      };
    }

    const output: OutputLine[] = [
      { type: "info", content: `─── Help: ${cmd} ───` },
      { type: "output", content: "" },
      { type: "success", content: "Usage:" },
      { type: "output", content: `  ${def.usage}` },
      { type: "output", content: "" },
      { type: "success", content: "Description:" },
      { type: "output", content: `  ${def.desc}` },
      { type: "output", content: "" },
      { type: "success", content: "Examples:" },
      ...def.examples.map((ex) => ({
        type: "dim" as const,
        content: `  $ ${ex}`,
      })),
    ];

    if (def.aliases.length > 0) {
      output.push({ type: "output", content: "" });
      output.push({ type: "success", content: "Aliases:" });
      output.push({ type: "dim", content: `  ${def.aliases.join(", ")}` });
    }

    return { output };
  }

  // Full help
  const categories = {
    notes: { name: "NOTES", icon: "📝" },
    search: { name: "SEARCH", icon: "🔍" },
    daily: { name: "DAILY", icon: "📅" },
    data: { name: "DATA", icon: "💾" },
    config: { name: "CONFIG", icon: "⚙️" },
    other: { name: "OTHER", icon: "🔧" },
  };

  const output: OutputLine[] = [
    {
      type: "info",
      content: "╭───────────────────────────────────────────────╮",
    },
    {
      type: "info",
      content: "│          GLYPH v2.1 - COMMANDS                │",
    },
    {
      type: "info",
      content: "╰───────────────────────────────────────────────╯",
    },
    { type: "output", content: "" },
  ];

  for (const [catKey, catInfo] of Object.entries(categories)) {
    const cmds = Object.entries(COMMAND_DEFINITIONS).filter(
      ([_, def]) => def.category === catKey
    );

    if (cmds.length === 0) continue;

    output.push({ type: "success", content: catInfo.name });

    for (const [cmdName, def] of cmds) {
      const aliases =
        def.aliases.length > 0 ? ` (${def.aliases.join(", ")})` : "";
      output.push({
        type: "output",
        content: `  ${def.usage.padEnd(22)} ${def.desc}${aliases}`,
      });
    }

    output.push({ type: "output", content: "" });
  }

  output.push({
    type: "dim",
    content: 'Tip: Use "help <command>" for detailed help on a command',
  });
  output.push({ type: "dim", content: "Example: help search" });

  return { output };
}

async function handleNew(argsStr: string, context: ShellContext): Promise<CommandResult> {
  // Extract title from quotes or use entire string
  const titleMatch = argsStr.match(/^"([^"]+)"$|^'([^']+)'$|^(.+)$/);
  const title =
    titleMatch?.[1] || titleMatch?.[2] || titleMatch?.[3] || "Untitled";

  if (!title.trim()) {
    return {
      output: [
        { type: "error", content: "Missing title" },
        { type: "dim", content: 'Usage: new "My Note Title"' },
        { type: "dim", content: 'Example: new "Project Ideas"' },
      ],
    };
  }

  const note = await createNote(title.trim(), "", [], context.currentPath);

  return {
    output: [
      { type: "success", content: `✓ Note created (id: ${note.id})` },
      { type: "dim", content: `  Opening editor...` },
    ],
    openEditor: { note, isNew: true },
  };
}

async function handleList(context: ShellContext): Promise<CommandResult> {
  const { notes, folders } = await getFolderContents(context.currentPath);

  if (notes.length === 0 && folders.length === 0) {
    return {
      output: [
        { type: "dim", content: "(empty)" },
      ],
    };
  }

  const output: OutputLine[] = [];

  // List folders first
  folders.forEach(f => {
    output.push({
      type: "info", // Blue/Info color for folders
      content: `${f.name}/`,
      action: { type: 'cd', path: f.name }
    });
  });

  // Then notes
  notes
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    })
    .forEach(n => {
      output.push({
        type: "output",
        content: formatNoteRow(n),
        action: { type: 'open', id: n.id! }
      });
    });

  return {
    output: [
      ...output,
      { type: "dim", content: `Total: ${folders.length + notes.length} item(s)` },
    ]
  };
}

async function handleMkdir(argsStr: string, context: ShellContext): Promise<CommandResult> {
  const nameMatch = argsStr.match(/^"([^"]+)"$|^'([^']+)'$|^(.+)$/);
  const name = nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3];

  if (!name?.trim()) {
    return {
      output: [{ type: "error", content: "Missing directory name" }],
    };
  }

  try {
    await createFolder(name.trim(), context.currentPath);
    return {
      output: [{ type: "success", content: `✓ Directory "${name.trim()}" created` }],
    };
  } catch (e) {
    return {
      output: [{ type: "error", content: `Failed to create directory: ${e}` }],
    };
  }
}

async function handleCd(argsStr: string, context: ShellContext): Promise<CommandResult> {
  const path = argsStr.trim();

  if (!path || path === "~" || path === "/") {
    context.setCurrentPath(undefined);
    return { output: [] };
  }

  if (path === "..") {
    if (context.currentPath === undefined) {
      // Already at root
      return { output: [] };
    }
    const current = await getFolder(context.currentPath);
    context.setCurrentPath(current?.parentId);
    return { output: [] };
  }

  // Find folder in current directory
  const { folders } = await getFolderContents(context.currentPath);
  const target = folders.find(f => f.name.toLowerCase() === path.toLowerCase());

  if (target) {
    context.setCurrentPath(target.id);
    return { output: [] };
  }

  return {
    output: [{ type: "error", content: `cd: ${path}: No such directory` }],
  };
}

async function handleOpen(argsStr: string): Promise<CommandResult> {
  // Try as ID first
  const id = parseInt(argsStr);

  if (!isNaN(id)) {
    const note = await getNote(id);
    if (!note || note.deleted) {
      return {
        output: [{ type: "error", content: `Note #${id} not found` }],
      };
    }
    return showNote(note);
  }

  // Try as title search
  const query = argsStr.replace(/^["']|["']$/g, "").trim();
  if (!query) {
    return {
      output: [
        { type: "error", content: "Missing note ID or title" },
        { type: "dim", content: 'Usage: open <id> or open "title"' },
        { type: "dim", content: "Example: open 1" },
      ],
    };
  }

  const titles = await getNoteTitles();
  const matches = titles.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase())
  );

  if (matches.length === 0) {
    return {
      output: [{ type: "error", content: `No note found matching "${query}"` }],
    };
  }

  if (matches.length === 1) {
    const note = await getNote(matches[0].id);
    if (note) return showNote(note);
  }

  // Multiple matches
  return {
    output: [
      { type: "warning", content: `Multiple notes match "${query}":` },
      { type: "output", content: "" },
      ...matches.slice(0, 5).map((m) => ({
        type: "output" as const,
        content: `  #${m.id}  ${m.title}`,
      })),
      { type: "output", content: "" },
      { type: "dim", content: "Use the note ID to open: open <id>" },
    ],
  };
}

function showNote(note: Note): CommandResult {
  return {
    output: [
      { type: "info", content: `╭─── #${note.id}: ${note.title} ───╮` },
      { type: "output", content: "" },
      { type: "markdown", content: note.body },
      { type: "output", content: "" },
      { type: "dim", content: `Created: ${formatDate(note.createdAt)}` },
      { type: "dim", content: `Updated: ${formatDate(note.updatedAt)}` },
      ...(note.tags.length > 0
        ? [{ type: "dim" as const, content: `Tags: ${note.tags.join(", ")}` }]
        : []),
    ],
  };
}

async function handleEdit(argsStr: string): Promise<CommandResult> {
  const id = parseInt(argsStr);
  if (isNaN(id)) {
    return {
      output: [
        { type: "error", content: "Missing note ID" },
        { type: "dim", content: "Usage: edit <id>" },
        { type: "dim", content: "Example: edit 1" },
      ],
    };
  }

  const note = await getNote(id);
  if (!note || note.deleted) {
    return {
      output: [{ type: "error", content: `Note #${id} not found` }],
    };
  }

  return {
    output: [
      { type: "info", content: `Opening editor for #${id}: ${note.title}...` },
    ],
    openEditor: { note, isNew: false },
  };
}

async function handleDelete(argsStr: string): Promise<CommandResult> {
  const id = parseInt(argsStr);
  if (isNaN(id)) {
    return {
      output: [
        { type: "error", content: "Missing note ID" },
        { type: "dim", content: "Usage: delete <id>" },
        { type: "dim", content: "Example: delete 1" },
      ],
    };
  }

  const result = await deleteNote(id);
  if (!result.success) {
    return {
      output: [
        { type: "error", content: `Note #${id} not found or already deleted` },
      ],
    };
  }

  return {
    output: [
      {
        type: "warning",
        content: `✓ Note #${id} "${result.deletedNote?.title}" deleted`,
      },
      { type: "info", content: `  Type "restore ${id}" to undo` },
    ],
    pendingUndo: { noteId: id, title: result.deletedNote?.title || "" },
  };
}

async function handleRestore(argsStr: string): Promise<CommandResult> {
  const id = parseInt(argsStr);
  if (isNaN(id)) {
    return {
      output: [
        { type: "error", content: "Missing note ID" },
        { type: "dim", content: "Usage: restore <id>" },
        { type: "dim", content: 'Tip: Use "trash" to see deleted notes' },
      ],
    };
  }

  const success = await undoDelete(id);
  if (!success) {
    return {
      output: [{ type: "error", content: `Note #${id} not found in trash` }],
    };
  }

  return {
    output: [{ type: "success", content: `✓ Note #${id} restored` }],
  };
}

async function handleTrash(): Promise<CommandResult> {
  const deleted = await getRecentlyDeleted();

  if (deleted.length === 0) {
    return {
      output: [{ type: "dim", content: "Trash is empty." }],
    };
  }

  return {
    output: [
      { type: "info", content: `─── Trash (${deleted.length} notes) ───` },
      { type: "output", content: "" },
      ...deleted.map((note: DeletedNote) => ({
        type: "warning" as const,
        content: `  #${note.noteId}  ${note.title}  [deleted ${formatDate(
          note.deletedAt
        )}]`,
      })),
      { type: "output", content: "" },
      { type: "dim", content: 'Use "restore <id>" to recover a note' },
    ],
  };
}

async function handleSearch(argsStr: string): Promise<CommandResult> {
  const query = argsStr.trim();
  if (!query) {
    return {
      output: [
        { type: "error", content: "Missing search query" },
        { type: "dim", content: "Usage: search <query>" },
        { type: "dim", content: "Example: search javascript" },
      ],
    };
  }

  const notes = await searchNotes(query);

  if (notes.length === 0) {
    return {
      output: [
        { type: "dim", content: `No results for "${query}"` },
        { type: "output", content: "" },
        { type: "dim", content: "Search looks in titles, body, and tags" },
      ],
    };
  }

  return {
    output: [
      {
        type: "info",
        content: `─── Search: "${query}" (${notes.length} results) ───`,
      },
      { type: "output", content: "" },
      ...notes.map((note) => ({
        type: "output" as const,
        content: formatNoteRow(note, query),
      })),
      { type: "output", content: "" },
      { type: "dim", content: "Matches marked with » «" },
    ],
  };
}

async function handleTags(argsStr: string): Promise<CommandResult> {
  if (argsStr.trim()) {
    // Filter by specific tag
    const notes = await getNotesByTag(argsStr.trim());

    if (notes.length === 0) {
      return {
        output: [{ type: "dim", content: `No notes with tag "${argsStr}"` }],
      };
    }

    return {
      output: [
        {
          type: "info",
          content: `─── Tag: ${argsStr} (${notes.length} notes) ───`,
        },
        { type: "output", content: "" },
        ...notes.map((note) => ({
          type: "output" as const,
          content: formatNoteRow(note),
        })),
      ],
    };
  }

  // List all tags
  const tags = await getAllTags();

  if (tags.length === 0) {
    return {
      output: [
        { type: "dim", content: "No tags yet." },
        { type: "dim", content: "Add tags when editing notes with Ctrl+T" },
      ],
    };
  }

  return {
    output: [
      { type: "info", content: "─── All Tags ───" },
      { type: "output", content: "" },
      ...tags.map(({ tag, count }) => ({
        type: "output" as const,
        content: `  ${tag} (${count})`,
      })),
      { type: "output", content: "" },
      { type: "dim", content: 'Use "tags <name>" to filter by tag' },
    ],
  };
}

async function handleToday(): Promise<CommandResult> {
  const note = await createOrGetTodayNote();

  return {
    output: [
      { type: "info", content: `Opening today's note (#${note.id})...` },
    ],
    openEditor: { note, isNew: false },
  };
}

function handleExport(): CommandResult {
  return {
    output: [{ type: "info", content: "Preparing export..." }],
    triggerExport: true,
  };
}

function handleImport(): CommandResult {
  return {
    output: [
      { type: "info", content: "Select a JSON file to import..." },
      {
        type: "dim",
        content: "Note: Duplicate titles will be renamed automatically",
      },
    ],
    triggerImport: true,
  };
}

async function handlePin(argsStr: string): Promise<CommandResult> {
  const id = parseInt(argsStr);
  if (isNaN(id)) {
    return { output: [{ type: "error", content: "Invalid note ID" }] };
  }

  const result = await togglePin(id);
  // If togglePin returns false, it might mean note not found OR it was unpinned (if logic was toggled)
  // But togglePin returns the NEW boolean state.
  // Wait, my togglePin implementation returns false if note not found.
  // Use getNote to check existence first? No, togglePin returns boolean, but I need to know if it failed.
  // Actually, let's just check existence first to be safe.

  const note = await getNote(id);
  if (!note || note.deleted) {
    return { output: [{ type: "error", content: `Note #${id} not found` }] };
  }

  if (note.pinned) {
    return { output: [{ type: "warning", content: `Note #${id} is already pinned` }] };
  }

  await togglePin(id);
  return { output: [{ type: "success", content: `✓ Pinned note #${id}` }] };
}

async function handleUnpin(argsStr: string): Promise<CommandResult> {
  const id = parseInt(argsStr);
  if (isNaN(id)) {
    return { output: [{ type: "error", content: "Invalid note ID" }] };
  }

  const note = await getNote(id);
  if (!note || note.deleted) {
    return { output: [{ type: "error", content: `Note #${id} not found` }] };
  }

  if (!note.pinned) {
    return { output: [{ type: "warning", content: `Note #${id} is not pinned` }] };
  }

  await togglePin(id);
  return { output: [{ type: "success", content: `✓ Unpinned note #${id}` }] };
}

async function handleConfig(argsStr: string): Promise<CommandResult> {
  const parts = argsStr.trim().split(/\s+/);
  const [key, ...valueParts] = parts;
  const value = valueParts.join(" ");

  // List all config — support both "config" (no args) and "config list"
  if (!key || key === "list") {
    const config = await getAllConfig();
    return {
      output: [
        { type: "info", content: "─── Configuration ───" },
        { type: "output", content: "" },
        ...Object.entries(config).map(([k, v]) => ({
          type: "output" as const,
          content: `  ${k.padEnd(15)} = ${v}`,
        })),
        { type: "output", content: "" },
        { type: "dim", content: "Usage: config <key> <value>" },
        { type: "dim", content: "Example: config theme dracula" },
        { type: "output", content: "" },
        { type: "success", content: `Available themes: ${AVAILABLE_THEMES.join(", ")}` },
      ],
    };
  }

  // Get specific config
  if (!value) {
    const currentValue = await getConfig(key);
    return {
      output: [
        { type: "output", content: `${key} = ${currentValue || "(not set)"}` },
      ],
    };
  }

  // Validate known config keys
  const validKeys = ["theme", "scanlines", "autosave", "dateFormat", "crtEnabled", "glowIntensity", "soundEnabled"];
  if (!validKeys.includes(key.toLowerCase())) {
    return {
      output: [
        { type: "error", content: `Unknown config key: ${key}` },
        { type: "dim", content: `Valid keys: ${validKeys.join(", ")}` },
      ],
    };
  }

  // Validate theme values
  if (key === "theme" && !AVAILABLE_THEMES.includes(value as any)) {
    return {
      output: [
        { type: "error", content: `Invalid theme: ${value}` },
        { type: "dim", content: `Available themes: ${AVAILABLE_THEMES.join(", ")}` },
      ],
    };
  }

  // Validate boolean values
  if (
    ["scanlines", "autosave", "crtEnabled", "soundEnabled"].includes(key) &&
    !["true", "false"].includes(value)
  ) {
    return {
      output: [
        { type: "error", content: `Invalid value for ${key}: ${value}` },
        { type: "dim", content: "Use: true or false" },
      ],
    };
  }

  // Validate number values
  if (key === "glowIntensity") {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 1) {
      return {
        output: [
          { type: "error", content: `Invalid value for ${key}: ${value}` },
          { type: "dim", content: "Use a number between 0 and 1" },
        ]
      };
    }
  }

  // Set config
  await setConfig(key, value);

  return {
    output: [
      { type: "success", content: `✓ ${key} = ${value}` },
      ...(key === "theme"
        ? [
          {
            type: "dim" as const,
            content: "Theme updated. Changes apply immediately.",
          },
        ]
        : []),
    ],
  };
}

async function handleRename(argsStr: string): Promise<CommandResult> {
  // Parse: rename <id> "new title" or rename <id> new-title
  const match = argsStr.match(/^(\d+)\s+(?:"([^"]+)"|'([^']+)'|(.+))$/);
  if (!match) {
    return {
      output: [
        { type: "error", content: "Invalid format" },
        { type: "dim", content: 'Usage: rename <id> "new title"' },
        { type: "dim", content: 'Example: rename 1 "Better Title"' },
      ],
    };
  }

  const id = parseInt(match[1]);
  const newTitle = (match[2] || match[3] || match[4]).trim();

  if (!newTitle) {
    return {
      output: [{ type: "error", content: "Title cannot be empty" }],
    };
  }

  const note = await getNote(id);
  if (!note || note.deleted) {
    return {
      output: [{ type: "error", content: `Note #${id} not found` }],
    };
  }

  const oldTitle = note.title;
  await updateNote(id, { title: newTitle });

  return {
    output: [
      { type: "success", content: `✓ Note #${id} renamed` },
      { type: "dim", content: `  "${oldTitle}" → "${newTitle}"` },
    ],
  };
}

async function handlePurge(argsStr: string): Promise<CommandResult> {
  const id = parseInt(argsStr);
  if (isNaN(id)) {
    return {
      output: [
        { type: "error", content: "Missing note ID" },
        { type: "dim", content: "Usage: purge <id>" },
        { type: "dim", content: 'Tip: Use "trash" to see deleted notes' },
      ],
    };
  }

  const note = await getNote(id);
  if (!note) {
    return {
      output: [{ type: "error", content: `Note #${id} not found` }],
    };
  }

  if (!note.deleted) {
    return {
      output: [
        { type: "warning", content: `Note #${id} is not in trash` },
        { type: "dim", content: "Delete it first with: delete <id>" },
      ],
    };
  }

  await purgeNote(id);

  return {
    output: [
      { type: "warning", content: `✓ Note #${id} "${note.title}" permanently deleted` },
      { type: "dim", content: "  This cannot be undone" },
    ],
  };
}

async function handleStats(): Promise<CommandResult> {
  const allNotes = await listNotes();
  const deletedNotes = await getRecentlyDeleted();
  const allTags = await getAllTags();

  const totalWords = allNotes.reduce((sum, note) => {
    const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
    return sum + words;
  }, 0);

  const totalChars = allNotes.reduce((sum, note) => sum + note.body.length, 0);

  // Calculate days since first note
  const oldest = allNotes.reduce(
    (min, note) => Math.min(min, note.createdAt),
    Date.now()
  );
  const daysSinceFirst = allNotes.length > 0
    ? Math.ceil((Date.now() - oldest) / (1000 * 60 * 60 * 24))
    : 0;

  // Find most recently updated note
  const mostRecent = allNotes.reduce(
    (latest, note) => (note.updatedAt > latest.updatedAt ? note : latest),
    allNotes[0]
  );

  return {
    output: [
      { type: "info", content: "╭───────────────────────────────────────────────╮" },
      { type: "info", content: "│              GLYPH STATISTICS                 │" },
      { type: "info", content: "╰───────────────────────────────────────────────╯" },
      { type: "output", content: "" },
      { type: "success", content: "NOTES" },
      { type: "output", content: `  Total notes      ${allNotes.length}` },
      { type: "output", content: `  In trash         ${deletedNotes.length}` },
      { type: "output", content: `  Total tags       ${allTags.length}` },
      { type: "output", content: "" },
      { type: "success", content: "CONTENT" },
      { type: "output", content: `  Total words      ${totalWords.toLocaleString()}` },
      { type: "output", content: `  Total characters ${totalChars.toLocaleString()}` },
      { type: "output", content: "" },
      { type: "success", content: "ACTIVITY" },
      { type: "output", content: `  Days active      ${daysSinceFirst}` },
      ...(mostRecent
        ? [
          {
            type: "output" as const,
            content: `  Last edited      ${formatDate(mostRecent.updatedAt)}`,
          },
        ]
        : []),
      { type: "output", content: "" },
      ...(allTags.length > 0
        ? [
          { type: "success" as const, content: "TOP TAGS" },
          ...allTags.slice(0, 5).map(({ tag, count }) => ({
            type: "output" as const,
            content: `  ${tag.padEnd(20)} ${count} note${count !== 1 ? "s" : ""}`,
          })),
        ]
        : []),
    ],
  };
}

function handleGrep(argsStr: string, context: ShellContext): CommandResult {
  const pattern = argsStr.trim();
  if (!pattern) {
    return {
      output: [{ type: "error", content: "Missing pattern" }],
    };
  }

  if (!context.stdin || context.stdin.length === 0) {
    return {
      output: [{ type: "error", content: "grep: no input provided (pipe only)" }],
    };
  }

  const regex = new RegExp(pattern, "i");
  const filtered = context.stdin.filter((line) => regex.test(line));

  if (filtered.length === 0) {
    return { output: [] };
  }

  return {
    output: filtered.map((line) => ({
      type: "output",
      content: line,
    })),
  };
}

export {
  updateNote,
  exportNotes,
  importNotes,
  getConfig,
  getAllConfig,
  getNoteTitles,
};
