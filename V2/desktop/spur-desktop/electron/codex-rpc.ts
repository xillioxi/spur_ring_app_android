import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Use a native executable: never interpolate prompts or paths into a shell command.
export function findCodex(): string {
  const paths = (process.env.PATH || '').split(path.delimiter);
  if (process.platform !== 'win32') {
    paths.push('/opt/homebrew/bin', '/usr/local/bin');
    return paths.map(p => path.join(p, 'codex')).find(existsSync) || '';
  }
  if (process.env.APPDATA) paths.push(path.join(process.env.APPDATA, 'npm'));
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const triple = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  for (const p of paths) {
    const base = path.join(p, 'node_modules', '@openai', 'codex');
    for (const candidate of [path.join(p, 'codex.exe'),
      path.join(base, '..', `codex-win32-${arch}`, 'vendor', triple, 'bin', 'codex.exe'),
      path.join(base, 'node_modules', '@openai', `codex-win32-${arch}`, 'vendor', triple, 'bin', 'codex.exe'),
      path.join(base, 'vendor', triple, 'codex', 'codex.exe')]) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return '';
}

export interface Rpc {
  request(method: string, params?: unknown): Promise<any>;
  reply(id: string | number, result: unknown, error?: boolean): void;
  close(): void;
}

export class CodexRpc implements Rpc {
  private child: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private buffer = '';
  private stopped = false;
  private pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  constructor(executable: string, receive: (message: any) => void, closed: (message: string) => void, args = ['app-server', '--listen', 'stdio://']) {
    this.child = spawn(executable, args, { windowsHide: true, stdio: 'pipe' });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      if (Buffer.byteLength(this.buffer) > 16 * 1024 * 1024) { this.fail('Codex returned an oversized response.', closed); return; }
      let end: number;
      while ((end = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message.method) receive(message);
          else {
            const pending = this.pending.get(message.id);
            if (pending) {
              clearTimeout(pending.timer); this.pending.delete(message.id);
              if (message.error) pending.reject(new Error(message.error.message || 'Codex request failed.'));
              else pending.resolve(message.result);
            }
          }
        } catch { this.fail('Codex returned an invalid protocol message.', closed); return; }
      }
    });
    this.child.stderr.on('data', () => {}); // Do not forward logs or credentials to the renderer.
    this.child.stdin.on('error', () => this.fail('The Codex connection closed.', closed));
    this.child.on('error', () => this.fail('Could not start Codex. Select an installed Codex executable.', closed));
    this.child.on('exit', () => this.fail('Codex stopped. Reconnect to continue; unsent text is retained.', closed));
  }
  private write(value: unknown): void {
    if (this.stopped) throw new Error('Codex is disconnected.');
    this.child.stdin.write(JSON.stringify(value) + '\n');
  }
  request(method: string, params: unknown = {}): Promise<any> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex ${method} timed out. Reconnect before retrying.`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.write({ id, method, params }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  notify(method: string): void { this.write({ method, params: {} }); }
  reply(id: string | number, result: unknown, error = false): void {
    this.write(error ? { id, error: { code: -32601, message: String(result) } } : { id, result });
  }
  private fail(message: string, closed?: (message: string) => void): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
    this.pending.clear(); this.child.stdin.end(); this.child.kill(); closed?.(message);
  }
  close(): void { this.fail('Codex disconnected.'); }
}
