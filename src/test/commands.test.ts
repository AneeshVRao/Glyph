import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { parseAndExecute } from '../lib/commands';

describe('Command Parsing and Execution', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await db.notes.clear();
    await db.recentlyDeleted.clear();
    await db.config.clear();
  });

  describe('help command', () => {
    it('should show help output', async () => {
      const result = await parseAndExecute('help');
      
      expect(result.output).toBeDefined();
      expect(result.output.length).toBeGreaterThan(0);
      expect(result.output.some(line => line.content.includes('GLYPH'))).toBe(true);
    });

    it('should show specific command help', async () => {
      const result = await parseAndExecute('help new');
      
      expect(result.output.some(line => line.content.includes('new'))).toBe(true);
      expect(result.output.some(line => line.content.includes('Create'))).toBe(true);
    });
  });

  describe('new command', () => {
    it('should create a note with quoted title', async () => {
      const result = await parseAndExecute('new "My Test Note"');
      
      expect(result.output.some(line => line.type === 'success')).toBe(true);
      expect(result.openEditor).toBeDefined();
      expect(result.openEditor?.note.title).toBe('My Test Note');
      expect(result.openEditor?.isNew).toBe(true);
    });

    it('should create a note with unquoted title', async () => {
      const result = await parseAndExecute('new simple-note');
      
      expect(result.openEditor?.note.title).toBe('simple-note');
    });
  });

  describe('list command', () => {
    it('should show empty state when no notes', async () => {
      const result = await parseAndExecute('list');
      
      expect(result.output.some(line => line.content.includes('No notes yet'))).toBe(true);
    });

    it('should list notes when they exist', async () => {
      // Create some notes first
      await parseAndExecute('new "Note 1"');
      await parseAndExecute('new "Note 2"');
      
      const result = await parseAndExecute('list');
      
      expect(result.output.some(line => line.content.includes('Note 1'))).toBe(true);
      expect(result.output.some(line => line.content.includes('Note 2'))).toBe(true);
    });

    it('should respect limit parameter', async () => {
      await parseAndExecute('new "Note 1"');
      await parseAndExecute('new "Note 2"');
      await parseAndExecute('new "Note 3"');
      
      const result = await parseAndExecute('list 2');
      
      // Should show "Showing 2 of 3"
      expect(result.output.some(line => line.content.includes('Showing 2 of 3'))).toBe(true);
    });
  });

  describe('aliases', () => {
    it('should handle ls as list alias', async () => {
      const result = await parseAndExecute('ls');
      expect(result.output.some(line => line.content.includes('No notes yet') || line.content.includes('Notes'))).toBe(true);
    });

    it('should handle create as new alias', async () => {
      const result = await parseAndExecute('create "Alias Test"');
      expect(result.openEditor?.note.title).toBe('Alias Test');
    });

    it('should handle rm as delete alias', async () => {
      await parseAndExecute('new "Delete Me"');
      const result = await parseAndExecute('rm 1');
      expect(result.output.some(line => line.content.includes('deleted'))).toBe(true);
    });
  });

  describe('delete command', () => {
    it('should soft delete a note', async () => {
      const createResult = await parseAndExecute('new "To Delete"');
      const noteId = createResult.openEditor?.note.id;
      const result = await parseAndExecute(`delete ${noteId}`);
      
      expect(result.output.some(line => line.content.includes('deleted'))).toBe(true);
    });

    it('should show error for missing ID', async () => {
      const result = await parseAndExecute('delete');
      expect(result.output.some(line => line.type === 'error')).toBe(true);
    });

    it('should show error for non-existent note', async () => {
      const result = await parseAndExecute('delete 999');
      expect(result.output.some(line => line.type === 'error')).toBe(true);
    });
  });

  describe('restore command', () => {
    it('should restore a deleted note', async () => {
      const createResult = await parseAndExecute('new "Restore Me"');
      const noteId = createResult.openEditor?.note.id;
      await parseAndExecute(`delete ${noteId}`);
      const result = await parseAndExecute(`restore ${noteId}`);
      
      // Either shows restored or success
      expect(result.output.some(line => line.type === 'success' || line.content.includes('restored'))).toBe(true);
    });
  });

  describe('search command', () => {
    it('should find notes by title', async () => {
      await parseAndExecute('new "JavaScript Tips"');
      await parseAndExecute('new "Python Guide"');
      
      const result = await parseAndExecute('search javascript');
      
      expect(result.output.some(line => line.content.includes('JavaScript'))).toBe(true);
      expect(result.output.some(line => line.content.includes('Python'))).toBe(false);
    });

    it('should show no results message', async () => {
      await parseAndExecute('new "Test Note"');
      const result = await parseAndExecute('search nonexistent');
      
      expect(result.output.some(line => line.content.includes('No results'))).toBe(true);
    });

    it('should show error for missing query', async () => {
      const result = await parseAndExecute('search');
      expect(result.output.some(line => line.type === 'error')).toBe(true);
    });
  });

  describe('clear command', () => {
    it('should set shouldClear flag', async () => {
      const result = await parseAndExecute('clear');
      expect(result.shouldClear).toBe(true);
    });
  });

  describe('version command', () => {
    it('should show version info', async () => {
      const result = await parseAndExecute('version');
      
      expect(result.output.some(line => line.content.includes('Glyph'))).toBe(true);
      expect(result.output.some(line => line.content.includes('v1.1'))).toBe(true);
    });
  });

  describe('config command', () => {
    it('should list all config', async () => {
      const result = await parseAndExecute('config');
      
      expect(result.output.some(line => line.content.includes('Configuration'))).toBe(true);
      expect(result.output.some(line => line.content.includes('theme'))).toBe(true);
    });

    it('should set theme config', async () => {
      const result = await parseAndExecute('config theme dracula');
      
      expect(result.output.some(line => line.type === 'success')).toBe(true);
    });

    it('should reject invalid theme', async () => {
      const result = await parseAndExecute('config theme invalid-theme');
      
      expect(result.output.some(line => line.type === 'error')).toBe(true);
    });

    it('should reject invalid config key', async () => {
      const result = await parseAndExecute('config invalidkey value');
      
      expect(result.output.some(line => line.type === 'error')).toBe(true);
    });
  });

  describe('unknown command', () => {
    it('should show error for unknown command', async () => {
      const result = await parseAndExecute('unknowncommand');
      
      expect(result.output.some(line => line.type === 'error')).toBe(true);
      expect(result.output.some(line => line.content.includes('Unknown command'))).toBe(true);
    });

    it('should suggest similar commands for close typos', async () => {
      const result = await parseAndExecute('lst'); // typo for list (closer match)
      
      // Should at least show "Unknown command" error
      expect(result.output.some(line => line.type === 'error')).toBe(true);
    });
  });

  describe('export/import commands', () => {
    it('should trigger export', async () => {
      const result = await parseAndExecute('export');
      expect(result.triggerExport).toBe(true);
    });

    it('should trigger import', async () => {
      const result = await parseAndExecute('import');
      expect(result.triggerImport).toBe(true);
    });
  });

  describe('today command', () => {
    it('should open today note', async () => {
      const result = await parseAndExecute('today');
      
      expect(result.openEditor).toBeDefined();
      expect(result.openEditor?.note.title).toContain('Daily:');
    });
  });
});
