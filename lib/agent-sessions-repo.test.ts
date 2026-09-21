import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './db';
import { createAdhocItem } from './items-repo';
import {
  createAgentSession,
  getAgentSessionByToken,
  getAgentSessionById,
  listAgentSessions,
  listOpenAgentSessions,
  applyAgentSessionPatch,
} from './agent-sessions-repo';
import type Database from 'better-sqlite3';

let db: Database.Database;
let itemId: number;

beforeEach(() => {
  db = openDb(':memory:');
  itemId = createAdhocItem(db, { title: 'Fix the pipeline' }).id;
});

describe('createAgentSession', () => {
  it('starts a session in the launching state with no agent session id yet', () => {
    const session = createAgentSession(db, {
      itemId,
      agent: 'claude',
      launchToken: 'tok-abc',
      tabTitle: '#4318 pipelines',
      tabColor: 'yellow',
    });

    expect(session.itemId).toBe(itemId);
    expect(session.agent).toBe('claude');
    expect(session.state).toBe('launching');
    expect(session.launchToken).toBe('tok-abc');
    expect(session.agentSessionId).toBeNull();
    expect(session.registeredAt).toBeNull();
    expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects a duplicate launch token', () => {
    createAgentSession(db, { itemId, agent: 'claude', launchToken: 'dup', tabTitle: 't', tabColor: 'yellow' });
    expect(() =>
      createAgentSession(db, { itemId, agent: 'claude', launchToken: 'dup', tabTitle: 't', tabColor: 'yellow' })
    ).toThrow();
  });
});

describe('getAgentSessionByToken', () => {
  it('finds a session by its launch token', () => {
    const created = createAgentSession(db, {
      itemId, agent: 'claude', launchToken: 'tok-find', tabTitle: 't', tabColor: 'yellow',
    });
    expect(getAgentSessionByToken(db, 'tok-find')?.id).toBe(created.id);
  });

  it('returns undefined for an unknown token', () => {
    expect(getAgentSessionByToken(db, 'nope')).toBeUndefined();
  });
});

describe('applyAgentSessionPatch', () => {
  it('writes only the fields present in the patch', () => {
    const created = createAgentSession(db, {
      itemId, agent: 'claude', launchToken: 'tok-patch', tabTitle: 't', tabColor: 'yellow',
    });

    applyAgentSessionPatch(db, created.id, {
      state: 'working',
      agentSessionId: 'sess-1',
      transcriptPath: '/tmp/sess-1.jsonl',
      registeredAt: '2026-09-21T10:00:00.000Z',
      lastEventAt: '2026-09-21T10:00:00.000Z',
    });

    const after = getAgentSessionById(db, created.id);
    expect(after?.state).toBe('working');
    expect(after?.agentSessionId).toBe('sess-1');
    expect(after?.transcriptPath).toBe('/tmp/sess-1.jsonl');
    expect(after?.tabTitle).toBe('t');
    expect(after?.endedAt).toBeNull();
  });

  it('is a no-op for an empty patch', () => {
    const created = createAgentSession(db, {
      itemId, agent: 'claude', launchToken: 'tok-empty', tabTitle: 't', tabColor: 'yellow',
    });
    expect(() => applyAgentSessionPatch(db, created.id, {})).not.toThrow();
    expect(getAgentSessionById(db, created.id)?.state).toBe('launching');
  });
});

describe('listOpenAgentSessions', () => {
  it('excludes sessions that have ended, and lists newest first', () => {
    const a = createAgentSession(db, { itemId, agent: 'claude', launchToken: 'a', tabTitle: 'a', tabColor: 'yellow' });
    const b = createAgentSession(db, { itemId, agent: 'claude', launchToken: 'b', tabTitle: 'b', tabColor: 'yellow' });
    applyAgentSessionPatch(db, a.id, { state: 'stopped', endedAt: '2026-09-21T11:00:00.000Z' });

    expect(listOpenAgentSessions(db).map((s) => s.id)).toEqual([b.id]);
    expect(listAgentSessions(db).map((s) => s.id)).toEqual([b.id, a.id]);
  });
});
