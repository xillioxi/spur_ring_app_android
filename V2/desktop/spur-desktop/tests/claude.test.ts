import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeConnection } from '../electron/claude';
import { initialCodexState } from '../electron/codex';

const model = { id: 'claude-test', name: 'Test model' };
const event = (value: unknown) => value as SDKMessage;
function fixture(run?: (prompt: string, options: Options) => AsyncIterable<SDKMessage>) {
  let saved = '';
  const state = initialCodexState();
  const client = new ClaudeConnection(state, {
    key: () => saved, saveKey: key => { saved = key; }, save() {}, changed() {},
    runtime: () => process.execPath,
    models: async key => {
      if (key !== 'test-key') throw new Error('Invalid fixture credential');
      return [model];
    },
    run,
  });
  return { client, state, saved: () => saved };
}

async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(5); }
  assert.fail('Claude state transition timed out');
}

test('Claude verifies credentials before saving them or enabling sends', async () => {
  const { client, state, saved } = fixture();
  await assert.rejects(client.connect(), /Enter an Anthropic API key/);
  await assert.rejects(client.connect('invalid'), /credential/);
  assert.equal(saved(), '');
  assert.throws(() => client.send('Hello'), /Connect Claude/);
  await client.connect('test-key');
  assert.equal(state.model, model.id);
  assert.equal(saved(), 'test-key');
  assert.ok(!JSON.stringify(state).includes('test-key'));
  assert.throws(() => client.send('Hello'), /project folder/);
  client.forget();
  assert.equal(saved(), '');
  assert.equal(state.authenticated, false);
});

test('Claude streams one reply, waits for approval and resumes its own session', async () => {
  const optionsSeen: Options[] = [];
  const decisions: string[] = [];
  const { client, state } = fixture(async function* (_, opts) {
    optionsSeen.push(opts);
    yield event({ type: 'system', subtype: 'init', session_id: opts.resume || opts.sessionId });
    yield event({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } } });
    const decision = await opts.canUseTool!('Write', { file_path: 'note.txt', content: 'Hello' }, { signal: opts.abortController!.signal, toolUseID: 'test-tool', requestId: 'fixture-request' });
    assert.ok(decision);
    decisions.push(decision.behavior);
    yield event({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello!' }] } });
    yield event({ type: 'result', subtype: 'success', is_error: false });
  });
  await client.connect('test-key');
  client.project(process.cwd());
  client.send('Write a note');
  await until(() => state.approvals.length === 1);
  assert.equal(state.messages.at(-1)?.text, 'Hello');
  assert.match(state.approvals[0].details, /note.txt/);
  const first = state.approvals[0].id;
  client.answer({ id: first, allow: true });
  await until(() => state.status === 'ready');
  assert.deepEqual(state.messages.map(m => m.text), ['Write a note', 'Hello!']);
  assert.throws(() => client.answer({ id: first, allow: true }), /no longer pending/);
  client.send('Follow up');
  await until(() => state.approvals.length === 1);
  client.stop();
  await until(() => state.status === 'ready');
  assert.deepEqual(decisions, ['allow', 'deny']);
  assert.equal(optionsSeen[1].resume, optionsSeen[0].sessionId);
  assert.equal(optionsSeen[0].cwd, process.cwd());
  assert.deepEqual(optionsSeen[0].settings, { permissions: { ask: ['Edit', 'Write', 'Bash'] } });
  assert.equal(state.activity, 'Task stopped');
  assert.equal(state.conversations.length, 1);
  client.newConversation();
  assert.equal(state.threadId, undefined);
});
