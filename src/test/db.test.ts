import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  createNote,
  getNote,
  listNotes,
  updateNote,
  deleteNote,
  undoDelete,
  searchNotes,
  getAllTags,
  getNoteTitles,
} from '../lib/db';

describe('Database Operations', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await db.notes.clear();
    await db.recentlyDeleted.clear();
    await db.config.clear();
  });

  describe('createNote', () => {
    it('should create a new note with title', async () => {
      const note = await createNote('Test Note');
      
      expect(note).toBeDefined();
      expect(note.id).toBeDefined();
      expect(note.title).toBe('Test Note');
      expect(note.body).toBe('');
      expect(note.tags).toEqual([]);
      expect(note.deleted).toBe(false);
    });

    it('should create a note with body and tags', async () => {
      const note = await createNote('Tagged Note', 'Some content', ['work', 'important']);
      
      expect(note.title).toBe('Tagged Note');
      expect(note.body).toBe('Some content');
      expect(note.tags).toEqual(['work', 'important']);
    });
  });

  describe('getNote', () => {
    it('should retrieve a note by ID', async () => {
      const created = await createNote('Find Me');
      const found = await getNote(created.id!);
      
      expect(found).toBeDefined();
      expect(found?.title).toBe('Find Me');
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await getNote(99999);
      expect(found).toBeUndefined();
    });
  });

  describe('listNotes', () => {
    it('should return empty array when no notes exist', async () => {
      const notes = await listNotes();
      expect(notes).toEqual([]);
    });

    it('should return all non-deleted notes', async () => {
      await createNote('Note 1');
      await createNote('Note 2');
      await createNote('Note 3');
      
      const notes = await listNotes();
      expect(notes).toHaveLength(3);
    });

    it('should exclude deleted notes by default', async () => {
      const note1 = await createNote('Keep Me');
      const note2 = await createNote('Delete Me');
      
      await deleteNote(note2.id!);
      
      const notes = await listNotes();
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Keep Me');
    });

    it('should include deleted notes when requested', async () => {
      await createNote('Note 1');
      const note2 = await createNote('Note 2');
      await deleteNote(note2.id!);
      
      const notes = await listNotes(true);
      expect(notes).toHaveLength(2);
    });
  });

  describe('updateNote', () => {
    it('should update note title', async () => {
      const note = await createNote('Original Title');
      await updateNote(note.id!, { title: 'Updated Title' });
      
      const updated = await getNote(note.id!);
      expect(updated?.title).toBe('Updated Title');
    });

    it('should update note body', async () => {
      const note = await createNote('Test', 'Original body');
      await updateNote(note.id!, { body: 'Updated body' });
      
      const updated = await getNote(note.id!);
      expect(updated?.body).toBe('Updated body');
    });

    it('should update note tags', async () => {
      const note = await createNote('Test', '', ['old-tag']);
      await updateNote(note.id!, { tags: ['new-tag', 'another-tag'] });
      
      const updated = await getNote(note.id!);
      expect(updated?.tags).toEqual(['new-tag', 'another-tag']);
    });

    it('should update updatedAt timestamp', async () => {
      const note = await createNote('Test');
      const originalTime = note.updatedAt;
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await updateNote(note.id!, { body: 'New content' });
      const updated = await getNote(note.id!);
      
      expect(updated?.updatedAt).toBeGreaterThan(originalTime);
    });
  });

  describe('deleteNote', () => {
    it('should soft delete a note', async () => {
      const note = await createNote('Delete Me');
      const result = await deleteNote(note.id!);
      
      expect(result.success).toBe(true);
      expect(result.deletedNote).toBeDefined();
      expect(result.deletedNote?.title).toBe('Delete Me');
      
      const found = await getNote(note.id!);
      expect(found?.deleted).toBe(true);
    });

    it('should return false for non-existent note', async () => {
      const result = await deleteNote(99999);
      expect(result.success).toBe(false);
    });

    it('should return false for already deleted note', async () => {
      const note = await createNote('Delete Me');
      await deleteNote(note.id!);
      const result = await deleteNote(note.id!);
      
      expect(result.success).toBe(false);
    });
  });

  describe('undoDelete', () => {
    it('should restore a deleted note', async () => {
      const note = await createNote('Restore Me');
      await deleteNote(note.id!);
      
      const restored = await undoDelete(note.id!);
      expect(restored).toBe(true);
      
      const found = await getNote(note.id!);
      expect(found?.deleted).toBe(false);
    });

    it('should return false for non-deleted note', async () => {
      const note = await createNote('Not Deleted');
      const restored = await undoDelete(note.id!);
      
      expect(restored).toBe(false);
    });
  });

  describe('searchNotes', () => {
    beforeEach(async () => {
      await createNote('JavaScript Tutorial', 'Learn JavaScript basics');
      await createNote('TypeScript Guide', 'Advanced types');
      await createNote('React Patterns', 'Component design', ['frontend']);
    });

    it('should find notes by title', async () => {
      const results = await searchNotes('JavaScript');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Tutorial');
    });

    it('should find notes by body content', async () => {
      const results = await searchNotes('Advanced');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('TypeScript Guide');
    });

    it('should find notes by tag', async () => {
      const results = await searchNotes('frontend');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React Patterns');
    });

    it('should be case-insensitive', async () => {
      const results = await searchNotes('TYPESCRIPT');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      const results = await searchNotes('python');
      expect(results).toEqual([]);
    });

    it('should exclude deleted notes from search', async () => {
      const note = await createNote('Python Basics', 'Learn Python');
      await deleteNote(note.id!);
      
      const results = await searchNotes('Python');
      expect(results).toEqual([]);
    });
  });

  describe('getAllTags', () => {
    it('should return empty array when no tags exist', async () => {
      await createNote('No Tags');
      const tags = await getAllTags();
      expect(tags).toEqual([]);
    });

    it('should return all unique tags with counts', async () => {
      await createNote('Note 1', '', ['work', 'important']);
      await createNote('Note 2', '', ['work', 'todo']);
      await createNote('Note 3', '', ['personal']);
      
      const tags = await getAllTags();
      
      expect(tags).toHaveLength(4);
      expect(tags.find(t => t.tag === 'work')?.count).toBe(2);
      expect(tags.find(t => t.tag === 'important')?.count).toBe(1);
    });

    it('should exclude tags from deleted notes', async () => {
      const note = await createNote('Deleted', '', ['hidden-tag']);
      await createNote('Active', '', ['visible-tag']);
      await deleteNote(note.id!);
      
      const tags = await getAllTags();
      
      expect(tags.find(t => t.tag === 'hidden-tag')).toBeUndefined();
      expect(tags.find(t => t.tag === 'visible-tag')).toBeDefined();
    });
  });

  describe('getNoteTitles', () => {
    it('should return all note titles with IDs', async () => {
      await createNote('First Note');
      await createNote('Second Note');
      
      const titles = await getNoteTitles();
      
      expect(titles).toHaveLength(2);
      expect(titles.map(t => t.title)).toContain('First Note');
      expect(titles.map(t => t.title)).toContain('Second Note');
    });

    it('should exclude deleted notes', async () => {
      await createNote('Visible');
      const deleted = await createNote('Hidden');
      await deleteNote(deleted.id!);
      
      const titles = await getNoteTitles();
      
      expect(titles).toHaveLength(1);
      expect(titles[0].title).toBe('Visible');
    });
  });
});
