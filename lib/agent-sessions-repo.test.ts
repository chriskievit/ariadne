import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './db';
import { createAdhocItem } from './items-repo';
import {
  createAgentSession,
  dismissAgentSession,
  getActiveAgentSessionForItem,
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

describe('getActiveAgentSessionForItem', () => {
  it('finds the session currently occupying a ticket', () => {
    const session = createAgentSession(db, {
      itemId,
      agent: 'claude',
      launchToken: 'tok-active',
      tabTitle: 't',
      tabColor: 'yellow',
    });
    applyAgentSessionPatch(db, session.id, { state: 'working', registeredAt: new Date().toISOString() });

    expect(getActiveAgentSessionForItem(db, itemId)?.id).toBe(session.id);
  });

  it('ignores a session that has ended, so the ticket can be handed over again', () => {
    const session = createAgentSession(db, {
      itemId,
      agent: 'claude',
      launchToken: 'tok-ended',
      tabTitle: 't',
      tabColor: 'yellow',
    });
    applyAgentSessionPatch(db, session.id, {
      state: 'stopped',
      endedAt: new Date().toISOString(),
      endReason: 'closed',
    });

    expect(getActiveAgentSessionForItem(db, itemId)).toBeUndefined();
  });

  it('ignores a failed session even though it never ended', () => {
    // The reconciler marks a never-registered session failed while leaving
    // ended_at null so a late SessionStart can revive it. If that row
    // counted as occupying the ticket, an unanswered folder-trust prompt
    // would lock the ticket out of ever being handed over again.
    const session = createAgentSession(db, {
      itemId,
      agent: 'claude',
      launchToken: 'tok-never',
      tabTitle: 't',
      tabColor: 'yellow',
    });
    applyAgentSessionPatch(db, session.id, { state: 'failed', endReason: 'never_registered' });

    expect(getAgentSessionById(db, session.id)?.endedAt).toBeNull();
    expect(getActiveAgentSessionForItem(db, itemId)).toBeUndefined();
  });

  it('does not leak a session belonging to another ticket', () => {
    const other = createAdhocItem(db, { title: 'Another ticket' }).id;
    createAgentSession(db, {
      itemId: other,
      agent: 'claude',
      launchToken: 'tok-other',
      tabTitle: 't',
      tabColor: 'yellow',
    });

    expect(getActiveAgentSessionForItem(db, itemId)).toBeUndefined();
  });
});

describe('dismissAgentSession', () => {
  it('ends a live session so it leaves the rail', () => {
    const session = createAgentSession(db, {
      itemId, agent: 'claude', launchToken: 'tok-live', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(db, session.id, { state: 'working', registeredAt: new Date().toISOString() });

    const now = new Date('2026-09-22T12:00:00.000Z');
    const dismissed = dismissAgentSession(db, session.id, now);

    expect(dismissed?.endedAt).toBe(now.toISOString());
    expect(dismissed?.endReason).toBe('dismissed');
  });

  it('ends a never-registered session, which is the case with no other way out', () => {
    // The reconciler marks this failed but leaves ended_at null on purpose,
    // so a late SessionStart can still revive it. Dismissing is the only
    // other way this row ever leaves the rail.
    const session = createAgentSession(db, {
      itemId, agent: 'claude', launchToken: 'tok-never', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(db, session.id, { state: 'failed', endReason: 'never_registered' });
    expect(getAgentSessionById(db, session.id)?.endedAt).toBeNull();

    const dismissed = dismissAgentSession(db, session.id, new Date('2026-09-22T12:00:00.000Z'));

    expect(dismissed?.state).toBe('failed');
    expect(dismissed?.endedAt).toBe('2026-09-22T12:00:00.000Z');
    expect(dismissed?.endReason).toBe('dismissed');
  });

  it('ends a hookless agent still sitting in launching', () => {
    // codex has no hook support, so it can never fire SessionEnd and would
    // otherwise sit in 'launching' for ever.
    const session = createAgentSession(db, {
      itemId, agent: 'codex', launchToken: 'tok-codex', tabTitle: 't', tabColor: 'yellow',
    });

    const dismissed = dismissAgentSession(db, session.id, new Date('2026-09-22T12:00:00.000Z'));

    expect(dismissed?.state).toBe('launching');
    expect(dismissed?.endedAt).toBe('2026-09-22T12:00:00.000Z');
    expect(dismissed?.endReason).toBe('dismissed');
  });

  it('leaves an already-ended session exactly as it was', () => {
    const session = createAgentSession(db, {
      itemId, agent: 'claude', launchToken: 'tok-ended', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(db, session.id, {
      state: 'stopped',
      endedAt: '2026-09-20T09:00:00.000Z',
      endReason: 'closed',
    });

    const dismissed = dismissAgentSession(db, session.id, new Date('2026-09-22T12:00:00.000Z'));

    expect(dismissed?.endedAt).toBe('2026-09-20T09:00:00.000Z');
    expect(dismissed?.endReason).toBe('closed');
  });

  it('returns undefined for a session that does not exist', () => {
    expect(() => dismissAgentSession(db, 99999, new Date())).not.toThrow();
    expect(dismissAgentSession(db, 99999, new Date())).toBeUndefined();
  });

  it('does not touch a sibling session on the same item', () => {
    // A fresh per-test db hands out id 1 to both the first item and the
    // first session, so `id` and `item_id` are numerically indistinguishable
    // by the time an assertion runs -- a WHERE id -> WHERE item_id mistake
    // in applyAgentSessionPatch would be invisible here otherwise. Burning a
    // couple of item ids first pushes this test's shared item away from the
    // low session ids below, so the two columns can never coincidentally
    // agree and this test is actually exercising the column it claims to.
    createAdhocItem(db, { title: 'throwaway 1' });
    createAdhocItem(db, { title: 'throwaway 2' });
    const sharedItemId = createAdhocItem(db, { title: 'Shared ticket' }).id;

    const a = createAgentSession(db, {
      itemId: sharedItemId, agent: 'claude', launchToken: 'tok-sib-a', tabTitle: 'a', tabColor: 'yellow',
    });
    const b = createAgentSession(db, {
      itemId: sharedItemId, agent: 'claude', launchToken: 'tok-sib-b', tabTitle: 'b', tabColor: 'yellow',
    });
    applyAgentSessionPatch(db, b.id, { state: 'working', registeredAt: new Date().toISOString() });

    const dismissed = dismissAgentSession(db, a.id, new Date('2026-09-22T12:00:00.000Z'));

    expect(dismissed?.endedAt).not.toBeNull();
    const sibling = getAgentSessionById(db, b.id);
    expect(sibling?.endedAt).toBeNull();
    expect(sibling?.endReason).toBeNull();
  });
});
