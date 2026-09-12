const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  let card = { id: 'test', updatedAt: 0 };
  const requests = [];
  const module = { exports: {} };
  const mocks = {
    'react-native': { DeviceEventEmitter: { emit() {} } },
    '@/services/localAgentCards': {
      getLocalAgentCard: async () => structuredClone(card),
      saveAgentCard: async (value) => { card = structuredClone(value); }
    },
    '@/services/officeApi': {
      createOfficeDocument: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
      saveOfficeDocument: async () => 'file:///test.pdf',
      openLocalOfficeFile: async () => {}
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/services/officeJob.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => {
    assert.ok(mocks[name], `Unexpected import: ${name}`);
    return mocks[name];
  }, Map, Date, Error });
  return { api: module.exports, requests, card: () => card };
}
const tick = () => new Promise(setImmediate);

test('document job saves a successful result', async () => {
  const h = setup();
  await h.api.startOfficeJob(h.card(), 'pdf', 'Test PDF');
  await tick();
  h.requests[0].resolve({ fileName: 'test.pdf', url: 'https://example.test/test.pdf' });
  await tick();
  assert.equal(h.card().office.status, 'ready');
  assert.equal(h.card().office.localUri, 'file:///test.pdf');
  assert.equal(h.api.isOfficeJobRunning('test'), false);
});

test('document failures remain retryable', async () => {
  const h = setup();
  await h.api.startOfficeJob(h.card(), 'pdf', 'Test PDF');
  await tick();
  h.requests[0].reject(new Error('Network failed'));
  await tick();
  assert.equal(h.card().office.status, 'failed');
  assert.equal(h.card().office.error, 'Network failed');
  assert.equal(h.api.isOfficeJobRunning('test'), false);
});

test('a cancelled request cannot remove its replacement job', async () => {
  const h = setup();
  await h.api.startOfficeJob(h.card(), 'pdf', 'First');
  await tick();
  await h.api.cancelOfficeJob('test');
  assert.equal(h.card().office.status, 'cancelled');
  await h.api.startOfficeJob(h.card(), 'pdf', 'Retry');
  await tick();
  h.requests[0].reject(new Error('cancelled'));
  await tick();
  assert.equal(h.api.isOfficeJobRunning('test'), true);
  const cards = await h.api.markStaleOfficeJobs([h.card()]);
  assert.equal(cards[0].office.status, 'generating');
  h.requests[1].resolve({ fileName: 'test.pdf', url: 'https://example.test/test.pdf' });
  await tick();
  assert.equal(h.card().office.status, 'ready');
});
