import { describe, it, expect, beforeEach } from 'vitest';
import { db, createNote, togglePin } from '../lib/db';

describe('Pinned Notes Database Logic', () => {
  beforeEach(async () => {
    await db.notes.clear();
  });

  it('should create notes with pinned=false by default', async () => {
    const note = await createNote('Default Note');
    expect(note.pinned).toBe(false);
  });

  it('should toggle pin status correctly', async () => {
    const note = await createNote('Pin Me');
    expect(note.id).toBeDefined();

    // Pin it
    const isPinned = await togglePin(note.id!);
    expect(isPinned).toBe(true);

    const pinnedNote = await db.notes.get(note.id!);
    expect(pinnedNote?.pinned).toBe(true);

    // Unpin it
    const isUnpinned = await togglePin(note.id!);
    expect(isUnpinned).toBe(false);

    const unpinnedNote = await db.notes.get(note.id!);
    expect(unpinnedNote?.pinned).toBe(false);
  });

  it('should return false when toggling non-existent note', async () => {
    const result = await togglePin(99999);
    expect(result).toBe(false);
  });
});
