import { describe, it, expect } from 'vitest';
import { KEYMAP, isTypingTarget } from './keymap';

describe('KEYMAP', () => {
  it('has no duplicate key bindings', () => {
    const seen = new Set<string>();
    for (const binding of KEYMAP) {
      expect(seen.has(binding.keys)).toBe(false);
      seen.add(binding.keys);
    }
  });

  it('gives every binding non-empty help text', () => {
    for (const binding of KEYMAP) {
      expect(binding.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('declares the row-scoped complete binding wired up in ItemRow', () => {
    const complete = KEYMAP.find((binding) => binding.keys === 'c');
    expect(complete).toEqual({ keys: 'c', description: 'Complete the focused item', scope: 'row' });
  });

  it('declares every binding with a row or global scope', () => {
    for (const binding of KEYMAP) {
      expect(['row', 'global']).toContain(binding.scope);
    }
  });
});

describe('isTypingTarget', () => {
  it('is true for an input element', () => {
    expect(isTypingTarget({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
  });

  it('is true for a textarea element', () => {
    expect(isTypingTarget({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
  });

  it('is true for a contenteditable element', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('is false for a plain element', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
  });

  it('is false for null or undefined', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });
});

describe('KEYMAP priority and capture bindings', () => {
  it('declares the row-scoped priority cycle wired up in ItemRow', () => {
    expect(KEYMAP.find((b) => b.keys === 'f')).toEqual({
      keys: 'f',
      description: 'Cycle priority (ad-hoc only)',
      scope: 'row',
    });
  });

  it('declares the global capture binding wired up in GlobalKeymapProvider', () => {
    expect(KEYMAP.find((b) => b.keys === 'a')).toEqual({
      keys: 'a',
      description: 'Add an ad-hoc item',
      scope: 'global',
    });
  });

  // GlobalKeymapProvider matches `/ ? r w p g` case-insensitively and does
  // not bail when a row has focus, so a row binding on any of those letters
  // would fire two handlers at once.
  it('never puts a row binding on a letter the global switch also matches', () => {
    const globallyMatched = new Set(['/', '?', 'r', 'w', 'p', 'g']);
    const rowKeys = KEYMAP.filter((b) => b.scope === 'row').map((b) => b.keys);
    for (const keys of rowKeys) {
      expect(globallyMatched.has(keys.toLowerCase())).toBe(false);
    }
  });
});
