import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTranscriptTail } from './agent-transcript';

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function writeTranscript(lines: unknown[]): string {
  dir = mkdtempSync(join(tmpdir(), 'ariadne-transcript-test-'));
  const path = join(dir, 'session.jsonl');
  writeFileSync(path, lines.map((line) => JSON.stringify(line)).join('\n') + '\n', 'utf8');
  return path;
}

describe('readTranscriptTail', () => {
  it('returns user and assistant turns as plain text, oldest first', () => {
    const path = writeTranscript([
      { type: 'user', timestamp: '2026-09-21T10:00:00.000Z', message: { role: 'user', content: 'fix the build' } },
      {
        type: 'assistant',
        timestamp: '2026-09-21T10:00:05.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Looking at the build now.' }] },
      },
    ]);

    expect(readTranscriptTail(path)).toEqual([
      { role: 'user', text: 'fix the build', timestamp: '2026-09-21T10:00:00.000Z' },
      { role: 'assistant', text: 'Looking at the build now.', timestamp: '2026-09-21T10:00:05.000Z' },
    ]);
  });

  it('joins several text blocks in one assistant turn', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        timestamp: '2026-09-21T10:00:05.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'One.' }, { type: 'text', text: 'Two.' }] },
      },
    ]);

    expect(readTranscriptTail(path)[0].text).toBe('One.\nTwo.');
  });

  it('skips tool-use blocks and non-conversational record types', () => {
    const path = writeTranscript([
      { type: 'system', timestamp: '2026-09-21T10:00:00.000Z' },
      { type: 'file-history-snapshot', snapshot: {} },
      {
        type: 'assistant',
        timestamp: '2026-09-21T10:00:05.000Z',
        message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: {} }] },
      },
      {
        type: 'assistant',
        timestamp: '2026-09-21T10:00:06.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Kept.' }] },
      },
    ]);

    expect(readTranscriptTail(path)).toEqual([
      { role: 'assistant', text: 'Kept.', timestamp: '2026-09-21T10:00:06.000Z' },
    ]);
  });

  it('keeps only the most recent entries up to the limit', () => {
    const path = writeTranscript(
      Array.from({ length: 10 }, (_, i) => ({
        type: 'assistant',
        timestamp: `2026-09-21T10:00:0${i}.000Z`,
        message: { role: 'assistant', content: [{ type: 'text', text: `msg ${i}` }] },
      }))
    );

    const entries = readTranscriptTail(path, 3);
    expect(entries.map((e) => e.text)).toEqual(['msg 7', 'msg 8', 'msg 9']);
  });

  it('tolerates a truncated final line, which a live transcript always has', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-transcript-test-'));
    const path = join(dir, 'session.jsonl');
    writeFileSync(
      path,
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-09-21T10:00:00.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Complete.' }] },
      }) + '\n{"type":"assist',
      'utf8'
    );

    expect(readTranscriptTail(path).map((e) => e.text)).toEqual(['Complete.']);
  });

  it('returns nothing for a missing file rather than throwing', () => {
    expect(readTranscriptTail('/no/such/transcript.jsonl')).toEqual([]);
  });
});
