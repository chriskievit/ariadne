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
