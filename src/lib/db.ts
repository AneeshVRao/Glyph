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
  undoTimeout: "30000", // 30 seconds in ms
};

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
  const now = Date.now();
  const id = await db.notes.add({
    title,
    body,
    tags,
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
  await db.notes.update(id, {
    ...updates,
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

export async function importNotes(
  jsonData: string
): Promise<{ imported: number; skipped: number; duplicates: number }> {
  const data = JSON.parse(jsonData);

  // Handle both old format (array) and new format (object with notes array)
  const notesToImport: Note[] = Array.isArray(data) ? data : data.notes || [];

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  const existingNotes = await db.notes.toArray();
  const existingTitles = new Set(
    existingNotes.map((n) => n.title.toLowerCase())
  );

  for (const note of notesToImport) {
    try {
      // Remove id to create new entries
      const { id, ...noteData } = note;

      // Check for title collision
      let finalTitle = noteData.title;
      if (existingTitles.has(finalTitle.toLowerCase())) {
        // Add (imported) suffix or timestamp
        finalTitle = `${noteData.title} (imported ${
          new Date().toISOString().split("T")[0]
        })`;
        duplicates++;
      }

      existingTitles.add(finalTitle.toLowerCase());

      await db.notes.add({
        ...noteData,
        title: finalTitle,
        deleted: false,
        updatedAt: Date.now(),
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
