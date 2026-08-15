import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { getSetting, setSetting, getAllSettings, getRedactedSettings } from './settings-repo';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('settings-repo', () => {
  it('returns null for an unset key', () => {
    expect(getSetting(db, 'github.pat')).toBeNull();
  });

  it('sets and reads a value back', () => {
    setSetting(db, 'github.pat', 'abc123');
    expect(getSetting(db, 'github.pat')).toBe('abc123');
  });

  it('overwrites an existing value', () => {
    setSetting(db, 'github.pat', 'first');
    setSetting(db, 'github.pat', 'second');
    expect(getSetting(db, 'github.pat')).toBe('second');
  });

  it('returns all settings as a record', () => {
    setSetting(db, 'github.pat', 'abc123');
    setSetting(db, 'ado.org', 'myorg');
    expect(getAllSettings(db)).toEqual({ 'github.pat': 'abc123', 'ado.org': 'myorg' });
  });

  describe('getRedactedSettings', () => {
    it('blanks out PAT values and flags them as set', () => {
      setSetting(db, 'github.pat', 'abc123');
      setSetting(db, 'ado.pat', 'def456');
      setSetting(db, 'ado.org', 'myorg');

      expect(getRedactedSettings(db)).toEqual({
        'github.pat': '',
        'github.pat.isSet': 'true',
        'ado.pat': '',
        'ado.pat.isSet': 'true',
        'ado.org': 'myorg',
      });
    });

    it('flags unset PATs as not set', () => {
      setSetting(db, 'ado.org', 'myorg');
      const redacted = getRedactedSettings(db);
      expect(redacted['github.pat.isSet']).toBe('false');
      expect(redacted['ado.pat.isSet']).toBe('false');
    });

    it('does not mutate the underlying stored value', () => {
      setSetting(db, 'github.pat', 'abc123');
      getRedactedSettings(db);
      expect(getSetting(db, 'github.pat')).toBe('abc123');
    });
  });
});
