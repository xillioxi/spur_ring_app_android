import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CodexConnection, initialCodexState } from '../electron/codex';
import { CodexRpc } from '../electron/codex-rpc';

function harness() {
  const state = initialCodexState(); state.executable = process.execPath; state.project = process.cwd();
  const calls: { method: string; params: any }[] = [];
  const replies: { id: string | number; result: any; error?: boolean }[] = [];
  let receive!: (m: any) => void;
  let closed!: (m: string) => void;
  let handler = async (method: string, params: any): Promise<any> => {
    if (method === 'account/read') return { account: { type: 'chatgpt' } };
    if (method === 'thread/start') return { thread: { id: 'spur-thread' } };
    if (method === 'thread/resume') return { thread: { turns: [{ items: [{ type: 'agentMessage', id: 'history', text: 'Previous response' }] }] } };
    if (method === 'turn/start') { receive({ method: 'turn/started', params: { threadId: 'spur-thread', turn: { id: 'turn-1' } } }); return { turn: { id: 'turn-1' } }; }
    if (method === 'turn/interrupt') receive({ method: 'turn/completed', params: { threadId: 'spur-thread', turn: { id: 'turn-1', status: 'interrupted' } } });
    return {};
  };
  const client = new CodexConnection(state, () => {}, () => {}, (_exe, event, fail) => {
    receive = event; closed = fail;
    return { async request(method, params) { calls.push({ method, params }); return handler(method, params); }, reply(id, result, error) { replies.push({ id, result, error }); }, close() {} };
  });
  const emit = (method: string, params: any, id?: number) => receive({ method, params: { threadId: 'spur-thread', ...params }, ...(id === undefined ? {} : { id }) });
  return { state, client, calls, replies, emit, disconnect: () => closed('Lost connection'), handler: (next: typeof handler) => { handler = next; } };
}

test('Codex creates a scoped thread, streams messages, and resumes a Spur conversation', async () => {
  const h = harness(); await h.client.connect(); await h.client.send('Explain the code');
  const start = h.calls.find(c => c.method === 'thread/start')!;
  assert.equal(start.params.sandbox, 'workspace-write'); assert.equal(start.params.approvalPolicy, 'on-request');
  assert.equal(start.params.cwd, process.cwd()); assert.equal(start.params.approvalsReviewer, 'user');
  h.emit('item/started', { item: { id: 'answer', type: 'agentMessage', text: '' } });
  h.emit('item/agentMessage/delta', { itemId: 'answer', delta: 'Hello ' });
  h.emit('item/agentMessage/delta', { itemId: 'answer', delta: 'ring' });
  assert.equal(h.state.messages.at(-1)?.text, 'Hello ring');
  h.emit('item/agentMessage/delta', { threadId: 'other', itemId: 'answer', delta: 'wrong' });
  assert.equal(h.state.messages.at(-1)?.text, 'Hello ring');
  h.emit('turn/completed', { turn: { id: 'turn-1', status: 'completed' } });
  await h.client.resume('spur-thread'); assert.equal(h.state.messages[0].text, 'Previous response');
  await assert.rejects(h.client.resume('unrelated-chat'), /Spur conversation/);
});

test('approvals require explicit responses, reject stale requests, and cannot grant a session write root', async () => {
  const h = harness(); await h.client.connect(); await h.client.send('Task');
  h.emit('item/commandExecution/requestApproval', { command: 'git status', cwd: process.cwd() }, 9);
  assert.equal(h.replies.length, 0); assert.equal(h.state.approvals.length, 1);
  const id = h.state.approvals[0].id; h.client.answer({ id, allow: true });
  assert.deepEqual(h.replies[0], { id: 9, result: { decision: 'accept' }, error: undefined });
  assert.throws(() => h.client.answer({ id, allow: true }), /no longer pending/);
  h.emit('item/fileChange/requestApproval', { grantRoot: 'C:\\', reason: 'Broader writes' }, 10);
  assert.throws(() => h.client.answer({ id: h.state.approvals[0].id, allow: true }), /only be declined/);
  h.client.answer({ id: h.state.approvals[0].id, allow: false });
  assert.equal(h.replies[1].result.decision, 'decline');
  h.emit('unknown/request', {}, 11); assert.equal(h.replies[2].error, true);
});

test('stop completes the active turn and disconnection clears pending requests without replaying', async () => {
  const h = harness(); await h.client.connect(); await h.client.send('Task');
  await assert.rejects(h.client.send('duplicate'), /Wait for Codex/);
  assert.throws(() => h.client.newConversation(), /Wait for Codex/);
  await h.client.stop(); assert.equal(h.state.status, 'ready'); assert.equal(h.state.activity, 'Task stopped');
  await h.client.send('Next'); h.emit('item/commandExecution/requestApproval', { command: 'echo test' }, 1);
  h.disconnect(); assert.equal(h.state.status, 'disconnected'); assert.equal(h.state.approvals.length, 0);
  assert.equal(h.calls.filter(c => c.method === 'turn/start').length, 2);
});

test('question answers are validated and completed-turn races cannot leave Codex stuck running', async () => {
  const h = harness(); await h.client.connect(); await h.client.send('Task');
  h.emit('item/tool/requestUserInput', { questions: [{ id: 'choice', question: 'Which file?' }] }, 5);
  const id = h.state.questions[0].id;
  assert.throws(() => h.client.answer({ id, answers: {} }), /Answer each/);
  h.client.answer({ id, answers: { choice: 'README.md' } });
  assert.deepEqual(h.replies[0].result, { answers: { choice: { answers: ['README.md'] } } });
  await h.client.stop();
  h.handler(async method => { if (method === 'turn/start') { h.emit('turn/completed', { turn: { status: 'completed' } }); return { turn: { id: 'fast' } }; } return {}; });
  await h.client.send('Fast'); assert.equal(h.state.status, 'ready'); assert.equal(h.state.turnId, undefined);
});

test('JSON-RPC works across fragmented UTF-8 output and rejects outstanding calls on process exit', async () => {
  const script = `process.stdin.setEncoding('utf8'); let s=''; process.stdin.on('data', c=>{s+=c; let n; while((n=s.indexOf('\\n'))>=0){const m=JSON.parse(s.slice(0,n));s=s.slice(n+1); if(m.method==='exit'){process.exit(0);return;} const b=Buffer.from(JSON.stringify({id:m.id,result:{text:'你好'}})+'\\n');process.stdout.write(b.subarray(0,b.length-4));setTimeout(()=>process.stdout.write(b.subarray(b.length-4)),10);}});`;
  const rpc = new CodexRpc(process.execPath, () => {}, () => {}, ['-e', script]);
  try {
    assert.deepEqual(await rpc.request('hello'), { text: '你好' });
    await assert.rejects(rpc.request('exit'), /Codex stopped/);
  } finally { rpc.close(); }
});

test('current Codex paginated history is hydrated in chronological order', async () => {
  const h = harness(); await h.client.connect(); await h.client.send('Task'); await h.client.stop();
  h.handler(async method => {
    if (method === 'thread/resume') return { thread: { historyMode: 'paginated', turns: [] } };
    if (method === 'thread/turns/list') return { data: [
      { items: [{ id: 'new', type: 'agentMessage', text: 'Newest' }] },
      { items: [{ id: 'old', type: 'agentMessage', text: 'Older' }] },
    ] };
    return {};
  });
  await h.client.resume('spur-thread');
  assert.deepEqual(h.state.messages.map(m => m.text), ['Older', 'Newest']);
});
