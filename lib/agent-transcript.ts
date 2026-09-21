import { closeSync, openSync, readSync, statSync } from 'node:fs';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string | null;
}

// A transcript grows to megabytes over a long session. Only the tail is ever
// displayed, so only the tail is read: this is the difference between a
// session pane that stays responsive and one that parses 5MB on every poll.
export const TRANSCRIPT_TAIL_BYTES = 256 * 1024;

const DEFAULT_LIMIT = 50;

interface RawRecord {
  type?: string;
  timestamp?: string;
  message?: { role?: string; content?: unknown };
}

function readTailBytes(path: string): string | null {
  try {
    const { size } = statSync(path);
    const start = Math.max(0, size - TRANSCRIPT_TAIL_BYTES);
    const length = size - start;
    if (length === 0) return '';

    const fd = openSync(path, 'r');
    try {
      const buffer = Buffer.alloc(length);
      readSync(fd, buffer, 0, length, start);
      return buffer.toString('utf8');
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

function extractText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;

  const parts = content
    .filter((block): block is { type: string; text: string } => {
      return (
        typeof block === 'object' &&
        block !== null &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      );
    })
    .map((block) => block.text);

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * The most recent conversational turns from a Claude Code transcript.
 *
 * Reads the JSONL Claude Code already writes rather than capturing the
 * terminal: the terminal stream positions every word with an absolute cursor
 * escape and is unreadable without a full emulator, while this is clean text.
 */
export function readTranscriptTail(path: string, limit: number = DEFAULT_LIMIT): TranscriptEntry[] {
  const raw = readTailBytes(path);
  if (raw === null) return [];

  const entries: TranscriptEntry[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let record: RawRecord;
    try {
      // A tail read starts mid-line, and a live transcript is written to
      // while it is read, so both the first and last line can be partial.
      record = JSON.parse(trimmed) as RawRecord;
    } catch {
      continue;
    }

    if (record.type !== 'user' && record.type !== 'assistant') continue;

    const text = extractText(record.message?.content);
    if (text === null || text.trim() === '') continue;

    entries.push({ role: record.type, text, timestamp: record.timestamp ?? null });
  }

  return entries.slice(-limit);
}
