import Dexie, { type Table } from "dexie";

export interface Note {
  id?: number;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  deletedAt?: number;
}

export interface Config {
  id?: number;
  key: string;
  value: string;
}

export interface DeletedNote {
  id?: number;
  noteId: number;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

export class NotesDatabase extends Dexie {
  notes!: Table<Note>;
  config!: Table<Config>;
  recentlyDeleted!: Table<DeletedNote>;

  constructor() {
    super("GlyphNotesDB");

    this.version(2).stores({
      notes: "++id, title, *tags, createdAt, updatedAt, deleted",
      config: "++id, key",
      recentlyDeleted: "++id, noteId, deletedAt",
    });
  }
}

export const db = new NotesDatabase();

// Default configuration
const DEFAULT_CONFIG: Record<string, string> = {
  theme: "crt",
  scanlines: "true",
  autosave: "true",
  dateFormat: "short",
};

// Sanitize text to prevent XSS when content is rendered
function sanitizeText(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Configuration operations
export async function getConfig(key: string): Promise<string> {
  const config = await db.config.where("key").equals(key).first();
  return config?.value ?? DEFAULT_CONFIG[key] ?? "";
}

export async function setConfig(key: string, value: string): Promise<void> {
  const existing = await db.config.where("key").equals(key).first();
  if (existing) {
    await db.config.update(existing.id!, { value });
  } else {
    await db.config.add({ key, value });
  }
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const configs = await db.config.toArray();
  const result = { ...DEFAULT_CONFIG };
  configs.forEach((c) => {
    result[c.key] = c.value;
  });
  return result;
}

// Database operations
export async function createNote(
  title: string,
  body: string = "",
  tags: string[] = []
): Promise<Note> {
  // Sanitize inputs
  const safeTitle = sanitizeText(title.slice(0, 500)); // Max 500 char title
  const safeBody = sanitizeText(body);
  const safeTags = tags
    .map((t) => sanitizeText(t.slice(0, 100))) // Max 100 char per tag
    .slice(0, 50); // Max 50 tags

  const now = Date.now();
  const id = await db.notes.add({
    title: safeTitle,
    body: safeBody,
    tags: safeTags,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  });

  const note = await db.notes.get(id);
  if (!note) throw new Error("Failed to create note");
  return note;
}

export async function updateNote(
  id: number,
  updates: Partial<Pick<Note, "title" | "body" | "tags">>
): Promise<Note | undefined> {
  // Sanitize any provided fields
  const sanitized: Partial<Pick<Note, "title" | "body" | "tags">> = {};
  if (updates.title !== undefined) {
    sanitized.title = sanitizeText(updates.title.slice(0, 500));
  }
  if (updates.body !== undefined) {
    sanitized.body = sanitizeText(updates.body);
  }
  if (updates.tags !== undefined) {
    sanitized.tags = updates.tags
      .map((t) => sanitizeText(t.slice(0, 100)))
      .slice(0, 50);
  }

  await db.notes.update(id, {
    ...sanitized,
    updatedAt: Date.now(),
  });
  return db.notes.get(id);
}

// Soft delete - stores note for undo
export async function deleteNote(
  id: number
): Promise<{ success: boolean; deletedNote?: DeletedNote }> {
  const note = await db.notes.get(id);
  if (!note || note.deleted) return { success: false };

  const now = Date.now();

  // Store in recently deleted for undo
  const deletedNote: DeletedNote = {
    noteId: id,
    title: note.title,
    body: note.body,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: now,
  };

  await db.recentlyDeleted.add(deletedNote);

  await db.notes.update(id, {
    deleted: true,
    deletedAt: now,
    updatedAt: now,
  });

  return { success: true, deletedNote };
}

// Restore a recently deleted note
export async function undoDelete(noteId: number): Promise<boolean> {
  const note = await db.notes.get(noteId);
  if (!note || !note.deleted) return false;

  // Remove from recently deleted
  await db.recentlyDeleted.where("noteId").equals(noteId).delete();

  // Restore the note
  await db.notes.update(noteId, {
    deleted: false,
    deletedAt: undefined,
    updatedAt: Date.now(),
  });

  return true;
}

// Get recently deleted notes
export async function getRecentlyDeleted(): Promise<DeletedNote[]> {
  return db.recentlyDeleted.orderBy("deletedAt").reverse().toArray();
}

// Permanently delete (purge)
export async function purgeNote(noteId: number): Promise<boolean> {
  await db.recentlyDeleted.where("noteId").equals(noteId).delete();
  await db.notes.delete(noteId);
  return true;
}

// Clean up old deleted notes (older than X days)
export async function purgeOldDeleted(
  olderThanMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<number> {
  const cutoff = Date.now() - olderThanMs;
  const oldNotes = await db.recentlyDeleted
    .where("deletedAt")
    .below(cutoff)
    .toArray();

  for (const note of oldNotes) {
    await db.notes.delete(note.noteId);
    await db.recentlyDeleted.delete(note.id!);
  }

  return oldNotes.length;
}

export async function restoreNote(id: number): Promise<boolean> {
  return undoDelete(id);
}

export async function getNote(id: number): Promise<Note | undefined> {
  return db.notes.get(id);
}

export async function listNotes(
  includeDeleted: boolean = false
): Promise<Note[]> {
  if (includeDeleted) {
    return db.notes.toArray();
  }
  return db.notes.filter((note) => !note.deleted).toArray();
}

export async function searchNotes(query: string): Promise<Note[]> {
  const lowerQuery = query.toLowerCase();
  const notes = await db.notes.filter((note) => !note.deleted).toArray();

  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.body.toLowerCase().includes(lowerQuery) ||
      note.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

export async function getNotesByTag(tag: string): Promise<Note[]> {
  return db.notes
    .where("tags")
    .equals(tag)
    .and((note) => !note.deleted)
    .toArray();
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const notes = await db.notes.filter((note) => !note.deleted).toArray();
  const tagCounts = new Map<string, number>();

  notes.forEach((note) => {
    note.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getTodayNote(): Promise<Note | undefined> {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const title = `Daily: ${dateStr}`;

  const notes = await db.notes
    .filter((note) => !note.deleted && note.title === title)
    .toArray();

  return notes[0];
}

export async function createOrGetTodayNote(): Promise<Note> {
  const existing = await getTodayNote();
  if (existing) return existing;

  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  return createNote(`Daily: ${dateStr}`, "", ["daily"]);
}

export async function exportNotes(): Promise<string> {
  const notes = await db.notes.toArray();
  const config = await getAllConfig();
  return JSON.stringify(
    { notes, config, exportedAt: Date.now(), version: "1.1" },
    null,
    2
  );
}

// Validate that an imported note has the required shape
function isValidNoteShape(
  obj: unknown
): obj is { title: string; body?: string; tags?: unknown[]; createdAt?: number; updatedAt?: number } {
  if (obj === null || typeof obj !== "object") return false;
  // Prevent prototype pollution: reject objects with __proto__ or constructor keys
  const keys = Object.keys(obj as Record<string, unknown>);
  if (keys.includes("__proto__") || keys.includes("constructor") || keys.includes("prototype")) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record.title !== "string" || record.title.trim().length === 0) return false;
  if (record.body !== undefined && typeof record.body !== "string") return false;
  if (record.tags !== undefined && !Array.isArray(record.tags)) return false;
  return true;
}

export async function importNotes(
  jsonData: string
): Promise<{ imported: number; skipped: number; duplicates: number }> {
  // Size limit: reject imports larger than 50MB
  if (jsonData.length > 50 * 1024 * 1024) {
    throw new Error("Import file too large (max 50MB)");
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonData);
  } catch {
    throw new Error("Invalid JSON format");
  }

  // Validate top-level structure
  if (data === null || typeof data !== "object") {
    throw new Error("Invalid import format: expected an object or array");
  }

  // Handle both old format (array) and new format (object with notes array)
  const rawNotes: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>).notes)
      ? (data as Record<string, unknown>).notes as unknown[]
      : [];

  if (rawNotes.length === 0) {
    throw new Error("No valid notes found in import data");
  }

  // Cap import at 10,000 notes
  if (rawNotes.length > 10_000) {
    throw new Error("Import exceeds maximum of 10,000 notes");
  }

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  const existingNotes = await db.notes.toArray();
  const existingTitles = new Set(
    existingNotes.map((n) => n.title.toLowerCase())
  );

  for (const rawNote of rawNotes) {
    try {
      // Validate shape
      if (!isValidNoteShape(rawNote)) {
        skipped++;
        continue;
      }

      // Sanitize fields
      const safeTitle = sanitizeText(rawNote.title.trim().slice(0, 500));
      const safeBody = sanitizeText(typeof rawNote.body === "string" ? rawNote.body : "");
      const safeTags = (Array.isArray(rawNote.tags) ? rawNote.tags : [])
        .filter((t): t is string => typeof t === "string")
        .map((t) => sanitizeText(t.slice(0, 100)))
        .slice(0, 50);

      // Check for title collision
      let finalTitle = safeTitle;
      if (existingTitles.has(finalTitle.toLowerCase())) {
        finalTitle = `${safeTitle} (imported ${
          new Date().toISOString().split("T")[0]
        })`;
        duplicates++;
      }

      existingTitles.add(finalTitle.toLowerCase());

      await db.notes.add({
        title: finalTitle,
        body: safeBody,
        tags: safeTags,
        createdAt: typeof rawNote.createdAt === "number" ? rawNote.createdAt : Date.now(),
        updatedAt: Date.now(),
        deleted: false,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped, duplicates };
}

export async function clearAllNotes(): Promise<void> {
  await db.notes.clear();
  await db.recentlyDeleted.clear();
}

// Get all note titles for autocomplete
export async function getNoteTitles(): Promise<
  { id: number; title: string }[]
> {
  const notes = await db.notes.filter((note) => !note.deleted).toArray();
  return notes.map((n) => ({ id: n.id!, title: n.title }));
}
