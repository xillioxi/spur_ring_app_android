import { readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { officeOutputDir, officeOutputPath } from '../tools/sandbox/src/output.mjs'
import { writeOfficePdf } from '../tools/pdf/src/write-pdf.mjs'
import { writeOfficePptx } from '../tools/pptx/src/write-pptx.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.SPUR_OFFICE_PORT || 3081)
const PUBLIC_BASE = (process.env.SPUR_OFFICE_PUBLIC_BASE || 'https://api.hispurring.com').replace(/\/$/, '')
const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/$/, '')
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-V3'
const OUTPUT_DIR = resolve(officeOutputDir())

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
const CHARS_PER_PAGE = 800
const DEFAULT_PAGES = 3
const MAX_DRAFT_ROUNDS = 15

function cnNum(raw) {
  const value = String(raw || '').trim()
  if (/^\d+$/.test(value)) return Number(value)
  return CN_NUM[value] || 0
}

function inferQuota(prompt) {
  const text = String(prompt || '')
  let pages = 0
  let chars = 0

  let hit = text.match(/(\d+)\s*万\s*(?:个)?\s*(?:字|汉字|字符)?/)
  if (hit) chars = Number(hit[1]) * 10_000
  if (!chars) {
    hit = text.match(/([一二三四五六七八九十两])\s*万/)
    if (hit) chars = cnNum(hit[1]) * 10_000
  }
  if (!chars) {
    hit = text.match(/(\d+)\s*千\s*(?:个)?\s*(?:字|汉字|字符)?/)
    if (hit) chars = Number(hit[1]) * 1_000
  }
  if (!chars) {
    hit = text.match(/([一二三四五六七八九十两])\s*千/)
    if (hit) chars = cnNum(hit[1]) * 1_000
  }
  if (!chars) {
    hit = text.match(/(\d+)\s*(?:个)?\s*(字|汉字|字符)/)
    if (hit) chars = Number(hit[1])
  }
  if (!chars) {
    hit = text.match(/(\d+)\s*(words?)/i)
    if (hit) chars = Number(hit[1])
  }

  hit = text.match(/(\d+)\s*(页|page|pages)/i)
  if (hit) pages = Number(hit[1])
  if (!pages) {
    hit = text.match(/([一二三四五六七八九十两])\s*页/)
    if (hit) pages = cnNum(hit[1])
  }

  const explicitPages = pages > 0
  const explicitChars = chars > 0
  if (!pages && chars) pages = Math.max(1, Math.ceil(chars / CHARS_PER_PAGE))
  if (!chars && pages) chars = pages * CHARS_PER_PAGE
  if (!pages && !chars) {
    pages = DEFAULT_PAGES
    chars = DEFAULT_PAGES * CHARS_PER_PAGE
  }
  return { pages, chars, explicitPages, explicitChars }
}

function parseJsonObject(raw) {
  const trimmed = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('model did not return JSON')
  }
}

function asStringList(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

async function chatText(messages, maxTokens) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      max_tokens: maxTokens,
      messages,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || `LLM HTTP ${response.status}`)
  }
  return payload?.choices?.[0]?.message?.content
}

function extractQuotedStrings(text) {
  const out = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '"') continue
    let buf = ''
    let j = i + 1
    let ok = true
    while (j < text.length) {
      const ch = text[j]
      if (ch === '\\' && j + 1 < text.length) {
        const next = text[j + 1]
        buf += next === 'n' ? '\n' : next === 't' ? '\t' : next === '"' ? '"' : next
        j += 2
        continue
      }
      if (ch === '"') break
      if (ch === '\n') {
        ok = false
        break
      }
      buf += ch
      j += 1
    }
    if (ok && buf.trim()) out.push(buf.trim())
    i = j
  }
  return out
}

function parseDraft(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let title = ''
  let lines = []

  const delim = text.match(/===TITLE===\s*([\s\S]*?)\s*===PARAS===\s*([\s\S]*)/i)
    || text.match(/===PARAS===\s*([\s\S]*)/i)
  if (delim && delim.length === 3) {
    title = delim[1].replace(/\n+/g, ' ').trim()
    lines = delim[2].split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  } else if (delim && delim.length === 2) {
    lines = delim[1].split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  }

  if (!lines.length) {
    try {
      const parsed = parseJsonObject(text)
      title = title || String(parsed.title || '').trim()
      lines = asStringList(parsed.paragraphs)
      if (!lines.length && parsed.body) {
        lines = String(parsed.body).split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
      }
    } catch {
      const titleHit = text.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/)
      if (titleHit) {
        try {
          title = JSON.parse(`"${titleHit[1]}"`)
        } catch {
          title = titleHit[1]
        }
      }
      const from = text.search(/"paragraphs"\s*:\s*\[/)
      const quoted = extractQuotedStrings(from >= 0 ? text.slice(from) : text)
      lines = quoted.filter((item) => item !== title && hanCount(item) >= 8)
    }
  }

  if (!lines.length) {
    const cleaned = text
      .replace(/===TITLE===[\s\S]*?===PARAS===/i, '')
      .replace(/"title"\s*:\s*"[^"]*"/i, '')
      .replace(/[{}\[\]]/g, '\n')
    lines = cleaned.split(/\n+/).map((item) => item.replace(/^"+|"+$/g, '').trim()).filter((item) => hanCount(item) >= 12)
  }
  if (!lines.length && hanCount(text) > 20) {
    lines = [text.replace(/[{}\[\]"]/g, ' ').replace(/\s+/g, ' ').trim()]
  }

  return {
    title: title || 'Untitled',
    pages: [{ heading: '', paragraphs: lines, bullets: [] }],
    body: lines.join('\n\n'),
    bullets: [],
  }
}

function hanCount(text) {
  return String(text || '').replace(/\s+/g, '').length
}

function splitParagraphs(lines, pageCount) {
  const n = Math.max(1, pageCount)
  const source = lines.length > 0 ? lines : ['']
  const size = Math.ceil(source.length / n)
  return Array.from({ length: n }, (_, index) => {
    const slice = source.slice(index * size, (index + 1) * size)
    return {
      heading: index === 0 ? '' : `第${index + 1}页`,
      paragraphs: slice.length > 0 ? slice : ['\u00a0'],
      bullets: [],
    }
  })
}

function packSlides(lines, pageCount) {
  if (pageCount > 0) return splitParagraphs(lines, pageCount)
  const slides = []
  let bucket = []
  let count = 0
  for (const line of lines.length > 0 ? lines : ['']) {
    const next = hanCount(line)
    if (bucket.length > 0 && count + next > CHARS_PER_PAGE) {
      slides.push({ heading: slides.length === 0 ? '' : `第${slides.length + 1}页`, paragraphs: bucket, bullets: [] })
      bucket = []
      count = 0
    }
    bucket.push(line)
    count += next
  }
  if (bucket.length > 0) {
    slides.push({ heading: slides.length === 0 ? '' : `第${slides.length + 1}页`, paragraphs: bucket, bullets: [] })
  }
  return slides
}

async function draftCopy(prompt, kind) {
  if (!API_KEY) throw new Error('DEEPSEEK_API_KEY is missing')
  const quota = inferQuota(prompt)
  let title = ''
  const paragraphs = []
  const written = () => hanCount(paragraphs.join(''))

  for (let round = 0; round < MAX_DRAFT_ROUNDS && written() < quota.chars; round += 1) {
    const remain = quota.chars - written()
    const chunk = Math.min(1800, Math.max(700, remain))
    const system = round === 0
      ? `Output exactly this format, no JSON:\n===TITLE===\n标题\n===PARAS===\n段落\n\n段落\n`
        + `Chinese article. This round about ${chunk} 汉字. Need ${quota.chars} 汉字 total (~${quota.pages} A4 pages). No Markdown.`
      : `Output exactly this format, no JSON:\n===PARAS===\n段落\n\n段落\nContinue the same article, do not repeat. About ${chunk} more 汉字.`
    const user = round === 0
      ? prompt
      : `Continue. Already ${written()} 汉字, target ${quota.chars}. Last paragraph:\n${paragraphs.at(-1) || ''}`
    const raw = await chatText(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      4096,
    )
    const draft = parseDraft(raw)
    if (!title) title = draft.title
    const next = draft.pages[0]?.paragraphs ?? []
    if (next.length === 0) break
    paragraphs.push(...next)
  }

  const pages = kind === 'pptx'
    ? packSlides(paragraphs, quota.explicitPages ? quota.pages : 0)
    : quota.explicitPages
      ? splitParagraphs(paragraphs, quota.pages)
      : [{ heading: '', paragraphs, bullets: [] }]
  return {
    title: title || 'Untitled',
    pages,
    pageCount: quota.explicitPages ? quota.pages : 0,
    body: paragraphs.join('\n\n'),
    bullets: [],
    prompt,
  }
}

function publicFileUrl(fileName) {
  return `${PUBLIC_BASE}/office-files/${encodeURIComponent(fileName)}`
}

function mimeFor(fileName) {
  if (fileName.endsWith('.pdf')) return 'application/pdf'
  if (fileName.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
  return 'application/octet-stream'
}

async function createOffice(prompt, kind) {
  const copy = await draftCopy(prompt, kind)
  const fileName = `${kind}-${Date.now()}.${kind === 'pptx' ? 'pptx' : 'pdf'}`
  const dest = await officeOutputPath(fileName)
  if (kind === 'pptx') await writeOfficePptx(copy, dest)
  else await writeOfficePdf(copy, dest)
  return {
    ok: true,
    kind,
    fileName,
    bytes: statSync(dest).size,
    url: publicFileUrl(fileName),
  }
}

function serveFile(res, name) {
  if (!name || name === '.' || name === '..') {
    json(res, 404, { error: 'not found' })
    return
  }
  const dest = resolve(OUTPUT_DIR, name)
  if (dest !== OUTPUT_DIR && !dest.startsWith(OUTPUT_DIR + sep)) {
    json(res, 403, { error: 'forbidden' })
    return
  }
  let st
  try {
    st = statSync(dest)
  } catch {
    json(res, 404, { error: 'not found' })
    return
  }
  if (!st.isFile()) {
    json(res, 404, { error: 'not found' })
    return
  }
  const body = readFileSync(dest)
  res.writeHead(200, {
    'Content-Type': mimeFor(name),
    'Content-Length': body.length,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
  })
  res.end(body)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  try {
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/office/health')) {
      json(res, 200, { ok: true, service: 'spur-office-gateway' })
      return
    }
    if (req.method === 'GET' && url.pathname.startsWith('/office-files/')) {
      serveFile(res, basename(decodeURIComponent(url.pathname.slice('/office-files/'.length))))
      return
    }
    if (req.method === 'POST' && (url.pathname === '/api/office' || url.pathname === '/v1/office')) {
      const body = JSON.parse((await readBody(req)) || '{}')
      const prompt = String(body.prompt || '').trim()
      const kind = body.kind === 'pptx' ? 'pptx' : 'pdf'
      if (!prompt) {
        json(res, 400, { error: 'prompt required' })
        return
      }
      json(res, 200, await createOffice(prompt, kind))
      return
    }
    json(res, 404, { error: 'not found' })
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`spur-office-gateway http://127.0.0.1:${PORT}  (${here})`)
})
