import { statSync } from 'node:fs';
import path from 'node:path';
import type { CodexState, CodexMessage } from '../src/types';
import { CodexRpc, findCodex, type Rpc } from './codex-rpc';

export const initialCodexState = (): CodexState => ({ model: '', models: [], status: 'disconnected', project: '', executable: '', authenticated: false,
  account: '', activity: '', messages: [], conversations: [], approvals: [], questions: [] });

export class CodexConnection {
  private rpc?: Rpc;
  private requests = new Map<string, { id: string | number; method: string; params: any }>();
  private sequence = 0;
  private busy = false;
  constructor(readonly state: CodexState, private changed: () => void, private save: () => void,
    private launch = (exe: string, receive: (message: any) => void, closed: (message: string) => void): Rpc => new CodexRpc(exe, receive, closed)) {}

  private idle(): void {
    if (this.busy || this.state.status === 'running' || this.state.status === 'connecting') throw new Error('Wait for Codex or stop the current task first.');
  }
  private ready(): Rpc {
    if (!this.rpc || this.state.status === 'disconnected') throw new Error('Connect Codex first.');
    return this.rpc;
  }
  private failed(message: string): void {
    this.rpc?.close(); this.rpc = undefined;
    Object.assign(this.state, { status: 'disconnected', authenticated: false, error: message, turnId: undefined, approvals: [], questions: [], activity: '' });
    this.requests.clear(); this.changed();
  }
  private persist(): void {
    try { this.save(); } catch { this.state.error = 'Could not save Codex conversation settings on this computer.'; }
  }
  async connect(): Promise<void> {
    this.idle(); this.rpc?.close(); this.requests.clear();
    this.state.executable ||= findCodex();
    if (!this.state.executable) throw new Error('Install Codex CLI, or choose its executable. Then connect again.');
    Object.assign(this.state, { status: 'connecting', error: undefined, threadId: undefined, turnId: undefined, messages: [], approvals: [], questions: [] }); this.changed();
    try {
      const rpc = this.rpc = this.launch(this.state.executable, m => this.receive(m), m => this.failed(m));
      await rpc.request('initialize', { clientInfo: { name: 'spur_desktop', title: 'Spur Desktop', version: '0.3.6' } });
      if (rpc instanceof CodexRpc) rpc.notify('initialized');
      await this.account();
      const models = await rpc.request('model/list', {});
      this.state.models = (models.data || []).map((m: any) => ({ id: m.model || m.id, name: m.displayName || m.id }));
      if (!this.state.models.some(m => m.id === this.state.model)) this.state.model = models.data?.find((m: any) => m.isDefault)?.model || this.state.models[0]?.id || '';
      this.state.status = 'ready'; this.persist(); this.changed();
    } catch (error) { this.failed(error instanceof Error ? error.message : 'Codex connection failed.'); throw error; }
  }
  async account(): Promise<void> {
    const result = await this.ready().request('account/read', { refreshToken: false });
    this.state.authenticated = Boolean(result.account) || result.requiresOpenaiAuth === false;
    this.state.account = result.account?.type === 'chatgpt' ? 'ChatGPT account connected' : result.account ? 'API account connected' : this.state.authenticated ? 'Configured provider' : 'Sign in to Codex';
    this.changed();
  }
  async login(): Promise<string> {
    this.idle();
    const result = await this.ready().request('account/login/start', { type: 'chatgpt' });
    if (result.type !== 'chatgpt' || typeof result.authUrl !== 'string') throw new Error('Use codex login in a terminal, then reconnect.');
    const url = new URL(result.authUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'auth.openai.com' || url.username || url.password) throw new Error('Codex returned an unexpected sign-in address.');
    this.state.activity = 'Complete sign-in in your browser.'; this.changed();
    return url.href;
  }
  project(directory: string): void {
    this.idle();
    if (!path.isAbsolute(directory) || !statSync(directory).isDirectory()) throw new Error('Choose an existing project folder.');
    this.state.project = path.resolve(directory); this.newConversation(); this.persist();
  }
  executable(file: string): void {
    this.idle();
    if (!path.isAbsolute(file) || !statSync(file).isFile() || /\.(cmd|bat|ps1)$/i.test(file)) throw new Error('Choose the native Codex executable, not a shell script.');
    this.close(); this.state.executable = file; this.persist(); this.changed();
  }
  newConversation(): void {
    this.idle(); Object.assign(this.state, { threadId: undefined, turnId: undefined, messages: [], error: undefined, activity: '', approvals: [], questions: [] }); this.changed();
  }
  model(value: unknown): void {
    this.idle();
    if (typeof value !== 'string' || !this.state.models.some(m => m.id === value)) throw new Error('Choose an available Codex model.');
    this.state.model = value; this.persist(); this.changed();
  }
  private policy() { return { model: this.state.model || undefined, cwd: this.state.project, approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write' }; }
  async resume(id: unknown): Promise<void> {
    this.idle();
    const conversation = this.state.conversations.find(c => c.id === id && c.project === this.state.project);
    if (!conversation) throw new Error('Choose a Spur conversation for this project.');
    this.busy = true;
    try {
      const result = await this.ready().request('thread/resume', { threadId: conversation.id, ...this.policy() });
      this.state.threadId = conversation.id; this.state.messages = [];
      let turns = result.thread.turns || [];
      if (result.thread.historyMode === 'paginated') {
        const page = await this.ready().request('thread/turns/list', { threadId: conversation.id, limit: 50, sortDirection: 'desc', itemsView: 'full' });
        turns = [...page.data].reverse();
      }
      for (const turn of turns) for (const item of turn.items || []) this.item(item);
      this.state.error = undefined; this.state.activity = 'Conversation resumed'; this.changed();
    } finally { this.busy = false; }
  }
  async send(value: unknown): Promise<void> {
    this.idle();
    if (typeof value !== 'string' || !value.trim() || value.length > 64000) throw new Error('Enter an instruction of up to 64,000 characters.');
    if (!this.state.authenticated) throw new Error('Sign in to Codex first.');
    if (!this.state.project || !statSync(this.state.project).isDirectory()) throw new Error('Choose an existing project folder.');
    const rpc = this.ready(); this.busy = true;
    Object.assign(this.state, { status: 'running', error: undefined, activity: 'Starting task…', turnId: undefined }); this.changed();
    try {
      if (!this.state.threadId) {
        const result = await rpc.request('thread/start', { ...this.policy(), threadSource: 'spur', ephemeral: false });
        this.state.threadId = result.thread.id;
        this.state.conversations = [{ id: result.thread.id, title: value.trim().slice(0, 100), project: this.state.project }, ...this.state.conversations].slice(0, 100);
        this.persist();
      }
      const result = await rpc.request('turn/start', { threadId: this.state.threadId, model: this.state.model || undefined, input: [{ type: 'text', text: value.trim(), text_elements: [] }] });
      if (this.state.status === 'running' && !this.state.turnId) this.state.turnId = result.turn.id;
      this.changed();
    } catch (error) {
      // A timed-out turn/start may have run. Never retry a prompt automatically.
      this.failed(error instanceof Error ? error.message : 'Codex could not start the task.'); throw error;
    } finally { this.busy = false; }
  }
  async stop(): Promise<void> {
    if (this.state.status !== 'running') return;
    if (!this.state.turnId) throw new Error('Codex is starting. Wait for the task to start, then stop it.');
    await this.ready().request('turn/interrupt', { threadId: this.state.threadId, turnId: this.state.turnId });
  }
  answer(value: unknown): void {
    if (!value || typeof value !== 'object') throw new Error('Invalid Codex response.');
    const input = value as { id?: unknown; allow?: unknown; answers?: Record<string, unknown> };
    const key = String(input.id); const request = this.requests.get(key);
    if (!request) throw new Error('This request is no longer pending.');
    if (request.method === 'item/tool/requestUserInput') {
      const answers: Record<string, { answers: string[] }> = {};
      for (const question of request.params.questions) {
        const answer = input.answers?.[question.id];
        if (typeof answer !== 'string' || !answer.trim() || answer.length > 8000) throw new Error('Answer each question before continuing.');
        answers[question.id] = { answers: [answer] };
      }
      this.ready().reply(request.id, { answers });
    } else {
      const approval = this.state.approvals.find(a => a.id === key);
      if (typeof input.allow !== 'boolean' || (input.allow && !approval?.canApprove)) throw new Error('This request can only be declined in Spur.');
      this.ready().reply(request.id, { decision: input.allow ? 'accept' : 'decline' });
    }
    this.requests.delete(key);
    this.state.approvals = this.state.approvals.filter(a => a.id !== key);
    this.state.questions = this.state.questions.filter(a => a.id !== key); this.changed();
  }
  private put(message: CodexMessage): void {
    message.text = message.text.slice(-100000);
    const index = this.state.messages.findIndex(m => m.id === message.id);
    if (index >= 0) this.state.messages[index] = message;
    else this.state.messages.push(message);
    this.state.messages = this.state.messages.slice(-300);
  }
  private item(item: any): void {
    if (!item?.id) return;
    if (item.type === 'agentMessage') this.put({ id: item.id, role: 'assistant', text: item.text || '' });
    else if (item.type === 'userMessage') this.put({ id: item.id, role: 'user', text: (item.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') });
    else if (item.type === 'commandExecution') this.put({ id: item.id, role: 'activity', text: `${item.command}\n${item.cwd || ''}\n${item.aggregatedOutput || ''}` });
    else if (item.type === 'fileChange') this.put({ id: item.id, role: 'activity', text: (item.changes || []).map((c: any) => `${c.path}\n${c.diff || ''}`).join('\n') });
    else if (item.type === 'plan') this.put({ id: item.id, role: 'assistant', text: item.text || '' });
  }
  receive(message: any): void {
    const p = message.params || {};
    const method = message.method;
    if (method === 'account/login/completed') {
      this.state.activity = p.success ? 'Signed in' : 'Sign-in failed';
      if (!p.success) this.state.error = p.error || 'Sign-in failed.';
      void this.account().catch(e => this.failed(String(e))); this.changed(); return;
    }
    if (message.id !== undefined) {
      if (p.threadId !== this.state.threadId || !this.state.threadId) { this.rpc?.reply(message.id, 'Request is not for the selected Spur conversation.', true); return; }
      const key = String(++this.sequence);
      if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
        const item = this.state.messages.find(m => m.id === p.itemId);
        const details = [p.reason, p.command, p.cwd, p.grantRoot && `Requested write root: ${p.grantRoot}`, item?.text].filter(Boolean).join('\n');
        this.requests.set(key, { id: message.id, method, params: p });
        this.state.approvals.push({ id: key, title: method.includes('commandExecution') ? 'Allow this command once?' : 'Allow these file changes?', details: details || 'No action details supplied. Decline and ask Codex to explain.', canApprove: Boolean(p.command || item?.text) && !p.grantRoot });
      } else if (method === 'item/tool/requestUserInput' && Array.isArray(p.questions)) {
        this.requests.set(key, { id: message.id, method, params: p });
        this.state.questions.push({ id: key, questions: p.questions });
      } else {
        this.rpc?.reply(message.id, 'This tool request is not supported by Spur. Ask the user for an alternative.', true);
        this.state.error = `Codex requested an unsupported interaction: ${method}`;
      }
      this.changed(); return;
    }
    if (p.threadId !== this.state.threadId || !this.state.threadId) return;
    if (method === 'turn/started') { this.state.status = 'running'; this.state.turnId = p.turn.id; this.state.activity = 'Codex is working…'; }
    else if (method === 'turn/completed') {
      this.state.status = 'ready'; this.state.turnId = undefined;
      this.state.activity = p.turn.status === 'completed' ? 'Task complete' : p.turn.status === 'interrupted' ? 'Task stopped' : 'Task failed';
      this.state.error = p.turn.error?.message;
      this.state.approvals = []; this.state.questions = []; this.requests.clear();
    } else if (method === 'item/started' || method === 'item/completed') {
      this.item(p.item);
      if (method === 'item/started') this.state.activity = p.item.type === 'commandExecution' ? 'Running a command…' : p.item.type === 'fileChange' ? 'Updating files…' : 'Codex is working…';
    } else if (method === 'item/agentMessage/delta') {
      const previous = this.state.messages.find(m => m.id === p.itemId)?.text || '';
      this.put({ id: p.itemId, role: 'assistant', text: previous + p.delta });
    } else if (method === 'error') this.state.error = p.error?.message || 'Codex reported an error.';
    else if (method === 'serverRequest/resolved') {
      for (const [key, value] of this.requests) if (value.id === p.requestId) {
        this.requests.delete(key); this.state.approvals = this.state.approvals.filter(a => a.id !== key); this.state.questions = this.state.questions.filter(a => a.id !== key);
      }
    }
    this.changed();
  }
  close(): void { this.rpc?.close(); this.rpc = undefined; this.failed(''); }
}
