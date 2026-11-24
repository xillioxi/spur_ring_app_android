import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import type { CanUseTool, Options, PermissionResult, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { CodexMessage, CodexState } from '../src/types';

type ClaudePorts = {
  key(): string;
  saveKey(key: string): void;
  save(): void;
  changed(): void;
  runtime(): string;
  models?(key: string): Promise<{ id: string; name: string }[]>;
  run?(prompt: string, options: Options): AsyncIterable<SDKMessage>;
};

async function availableModels(key: string) {
  const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new Error('Anthropic rejected this key. Check its API access and reconnect.');
    throw new Error(`Could not load Claude models (HTTP ${response.status}).`);
  }
  const body = await response.json() as { data: { id: string; display_name: string }[] };
  return body.data.filter(m => typeof m.id === 'string' && m.id.startsWith('claude-')).map(m => ({ id: m.id, name: m.display_name || m.id }));
}

function visibleText(message: unknown): string {
  if (!message || typeof message !== 'object' || !('content' in message)) return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n');
}

// Only pass environment values needed by the native client and its local tools.
function runtimeEnvironment(key: string) {
  const env: Record<string, string> = { ANTHROPIC_API_KEY: key, ANTHROPIC_BASE_URL: 'https://api.anthropic.com', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
  const names = /^(path|home|userprofile|homedrive|homepath|systemroot|windir|comspec|pathext|programfiles(?:\(x86\))?|programdata|appdata|localappdata|tmp|temp|tmpdir|lang|shell|username|user|claude_config_dir|claude_code_git_bash_path)$/i;
  for (const [name, value] of Object.entries(process.env)) if (value && names.test(name)) env[name] = value;
  return env;
}

export class ClaudeConnection {
  private runController?: AbortController;
  private resumePending = false;
  private requests = new Map<string, (allow: boolean) => void>();

  constructor(readonly state: CodexState, private ports: ClaudePorts) {}

  private idle() {
    if (this.runController || this.resumePending || this.state.status === 'connecting') throw new Error('Finish the current Claude operation first.');
  }

  async connect(candidate?: unknown) {
    this.idle();
    if (candidate !== undefined && (typeof candidate !== 'string' || !candidate.trim() || /\s/.test(candidate.trim()) || candidate.length > 2048)) throw new Error('Enter a valid Anthropic API key.');
    const key = typeof candidate === 'string' ? candidate.trim() : this.ports.key();
    if (!key) throw new Error('Enter an Anthropic API key or set ANTHROPIC_API_KEY before opening Spur.');
    this.state.status = 'connecting'; this.state.error = undefined; this.ports.changed();
    try {
      if (!existsSync(this.ports.runtime())) throw new Error('The Claude runtime is missing. Reinstall the complete Spur build.');
      const models = await (this.ports.models || availableModels)(key);
      if (!models.length) throw new Error('No Claude models are available to this API key.');
      if (candidate !== undefined) this.ports.saveKey(key);
      this.state.models = models;
      if (!models.some(m => m.id === this.state.model)) this.state.model = (models.find(m => m.id.includes('sonnet')) || models[0]).id;
      this.state.authenticated = true; this.state.account = 'Anthropic API connected'; this.state.status = 'ready'; this.ports.save();
    } catch (error) {
      this.state.status = 'disconnected'; this.state.authenticated = false; this.state.account = ''; throw error;
    } finally { this.ports.changed(); }
  }

  forget() {
    this.idle(); this.ports.saveKey(''); this.state.authenticated = false;
    this.state.account = ''; this.state.status = 'disconnected'; this.ports.changed();
  }

  project(dir: string) {
    this.idle();
    if (!path.isAbsolute(dir) || !statSync(dir).isDirectory()) throw new Error('Choose an existing project folder.');
    this.state.project = dir; this.newConversation(); this.ports.save();
  }
  model(id: unknown) {
    this.idle();
    if (typeof id !== 'string' || !this.state.models.some(m => m.id === id)) throw new Error('Select an available Claude model.');
    this.state.model = id; this.ports.save(); this.ports.changed();
  }
  newConversation() {
    this.idle();
    Object.assign(this.state, { threadId: undefined, messages: [], error: undefined, activity: '' }); this.ports.changed();
  }
  async resume(id: unknown) {
    this.idle();
    const ref = this.state.conversations.find(c => c.id === id && c.project === this.state.project);
    if (!ref) throw new Error('Select a Claude conversation from this project.');
    this.resumePending = true;
    try {
      const { getSessionMessages } = await import('@anthropic-ai/claude-agent-sdk');
      const history = await getSessionMessages(ref.id, { dir: ref.project });
      if (!history.length) throw new Error('Claude could not find this conversation on this computer.');
      this.state.messages = history.filter(m => !m.parent_tool_use_id && (m.type === 'user' || m.type === 'assistant'))
        .map(m => ({ id: m.uuid, role: m.type as 'user' | 'assistant', text: visibleText(m.message).slice(-100000) })).filter(m => m.text).slice(-300);
      this.state.threadId = ref.id; this.state.activity = 'Conversation resumed'; this.state.error = undefined; this.ports.changed();
    } finally { this.resumePending = false; }
  }

  private permission: CanUseTool = async (tool, input, { signal }) => {
    const id = randomUUID();
    const details = JSON.stringify(input, null, 2);
    // Never authorize a request whose full arguments could not be displayed.
    if (details.length > 100000 || signal.aborted || !this.runController || this.runController.signal.aborted) return { behavior: 'deny', message: 'Request expired or is too large to review.' };
    return new Promise<PermissionResult>(resolve => {
      const cancel = () => complete(false);
      const complete = (allow: boolean) => {
        this.requests.delete(id); signal.removeEventListener('abort', cancel);
        this.state.approvals = this.state.approvals.filter(a => a.id !== id);
        resolve(allow ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'User declined this action.' }); this.ports.changed();
      };
      this.requests.set(id, complete); signal.addEventListener('abort', cancel, { once: true });
      this.state.approvals.push({ id, title: `Allow Claude to use ${tool}?`, details, canApprove: true }); this.ports.changed();
    });
  };
  answer(value: unknown) {
    if (!value || typeof value !== 'object' || !('id' in value) || !('allow' in value) || typeof value.id !== 'string' || typeof value.allow !== 'boolean') throw new Error('Invalid approval.');
    const complete = this.requests.get(value.id);
    if (!complete) throw new Error('This approval is no longer pending.');
    complete(value.allow);
  }
  stop() {
    this.runController?.abort();
    for (const finish of this.requests.values()) finish(false);
  }
  send(value: unknown) {
    this.idle();
    if (typeof value !== 'string' || !value.trim() || value.length > 64000) throw new Error('Enter an instruction of up to 64,000 characters.');
    const key = this.ports.key();
    if (!this.state.authenticated || !key) throw new Error('Connect Claude first.');
    if (!this.state.project || !statSync(this.state.project).isDirectory()) throw new Error('Choose a project folder.');
    const controller = this.runController = new AbortController();
    const prior = this.state.threadId;
    const sessionId = prior || randomUUID();
    const instruction = value.trim();
    this.state.messages.push({ id: randomUUID(), role: 'user', text: instruction });
    Object.assign(this.state, { status: 'running', activity: 'Claude is working…', error: undefined, turnId: randomUUID() });
    this.ports.changed();
    void this.run(instruction, key, sessionId, prior, controller);
  }

  private async run(instruction: string, key: string, id: string, prior: string | undefined, controller: AbortController) {
    let partial: CodexMessage | undefined;
    let completed = false;
    const options: Options = {
      cwd: this.state.project, env: runtimeEnvironment(key), model: this.state.model, abortController: controller,
      pathToClaudeCodeExecutable: this.ports.runtime(), ...(prior ? { resume: prior } : { sessionId: id }),
      persistSession: true, includePartialMessages: true, permissionMode: 'default', canUseTool: this.permission,
      settingSources: [], strictMcpConfig: true, mcpServers: {}, tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'],
      settings: { permissions: { ask: ['Edit', 'Write', 'Bash'] } },
    };
    try {
      const stream = this.ports.run ? this.ports.run(instruction, options) : (await import('@anthropic-ai/claude-agent-sdk')).query({ prompt: instruction, options });
      for await (const message of stream) {
        if (controller.signal.aborted) break;
        if (message.type === 'system' && message.subtype === 'init' && !prior && !this.state.threadId) {
          this.state.threadId = message.session_id;
          this.state.conversations = [{ id: message.session_id, project: this.state.project, title: instruction.slice(0, 100) }, ...this.state.conversations].slice(0,100);
          this.ports.save();
        }
        if (message.type === 'stream_event' && message.event.type === 'content_block_delta' && message.event.delta.type === 'text_delta') {
          if (!partial) { partial = { id: randomUUID(), role: 'assistant', text: '' }; this.state.messages.push(partial); }
          partial.text = (partial.text + message.event.delta.text).slice(-100000);
        } else if (message.type === 'assistant') {
          const full = visibleText(message.message);
          if (partial && full) partial.text = full.slice(-100000);
          else if (full) this.state.messages.push({ id: message.uuid, role: 'assistant', text: full.slice(-100000) });
          partial = undefined;
          for (const block of message.message.content) if (block.type === 'tool_use') this.state.activity = `Claude · ${block.name}`;
        } else if (message.type === 'result') {
          if (message.subtype !== 'success' || message.is_error) throw new Error(message.subtype === 'success' ? message.result : message.errors.join('\n'));
          completed = true;
        }
        this.state.messages = this.state.messages.slice(-300); this.ports.changed();
      }
      if (!completed && !controller.signal.aborted) throw new Error('Claude disconnected before completing this instruction.');
    } catch (error) {
      if (!controller.signal.aborted) this.state.error = (error instanceof Error ? error.message : 'Claude could not complete this instruction.').replaceAll(key, '[redacted]').slice(0,1500);
    } finally {
      for (const finish of this.requests.values()) finish(false);
      this.state.activity = controller.signal.aborted ? 'Task stopped' : this.state.error ? 'Task failed' : 'Task complete';
      this.runController = undefined; this.state.status = 'ready'; this.state.turnId = undefined; this.ports.changed();
    }
  }
}
