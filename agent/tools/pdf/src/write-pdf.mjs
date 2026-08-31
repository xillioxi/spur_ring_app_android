import { existsSync } from 'node:fs'
import { mkdtemp, unlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const CHROME_CANDIDATES = [
  process.env.SPUR_CHROME,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/opt/google/chrome/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/lib64/chromium-browser/chromium-browser',
].filter(Boolean)

function findChrome() {
  for (const path of CHROME_CANDIDATES) {
    if (existsSync(path)) return path
  }
  throw new Error(
    'Chrome/Chromium not found. Install google-chrome-stable, or set SPUR_CHROME.',
  )
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraphsOf(page) {
  const listed = (page.paragraphs ?? []).map((item) => String(item).trim()).filter(Boolean)
  if (listed.length > 0) return listed
  const body = String(page.body || '').trim()
  return body ? [body] : []
}

function pagesFromInput(input) {
  if (Array.isArray(input.pages) && input.pages.length > 0) {
    return input.pages.map((page, index) => ({
      heading: String(page.heading || page.title || '').trim() || (index === 0 ? '' : `第${index + 1}页`),
      paragraphs: paragraphsOf(page),
      bullets: (page.bullets ?? []).map((item) => String(item).trim()).filter(Boolean),
    }))
  }
  return [{
    heading: '',
    paragraphs: String(input.body || '').trim() ? [String(input.body).trim()] : [],
    bullets: (input.bullets ?? []).map((item) => String(item).trim()).filter(Boolean),
  }]
}

const THEMES = {
  navy: { bg: '#ffffff', navy: '#002D58', accent: '#0070C0', text: '#1a1a1f', muted: '#6b7280', line: '#e5e7eb' },
  yellow: { bg: '#FFF8E7', navy: '#7A5200', accent: '#D4A017', text: '#1a1a1f', muted: '#7A6840', line: '#ead9a8' },
  red: { bg: '#ffffff', navy: '#6B1220', accent: '#C41E3A', text: '#1a1a1f', muted: '#6b7280', line: '#e5e7eb' },
  dark: { bg: '#0B1220', navy: '#020617', accent: '#38BDF8', text: '#E5E7EB', muted: '#94a3b8', line: '#1e293b' },
}

function inferTheme(input) {
  const text = `${input.theme || ''} ${input.prompt || ''} ${input.title || ''}`
  if (/黄底|黄色背景|暖黄/.test(text)) return 'yellow'
  if (/酒红|红色商务|红底/.test(text)) return 'red'
  if (/深色|暗色|黑色背景|\bdark\b/i.test(text)) return 'dark'
  return 'navy'
}

function isHeading(text) {
  const value = String(text || '').trim()
  if (!value || value.length > 36) return false
  return /^(第[一二三四五六七八九十\d]+[章节部分篇]?|[IVXLCDM]+[\.、．]|[一二三四五六七八九十]+、|\d+[\.、．])/.test(value)
}

function isTimeline(text) {
  return /^(\d{4}|[一二三四五六七八九十\d]+年)/.test(String(text || '').trim())
}

function metricParts(text) {
  const hit = String(text || '').match(/^(.{1,16})[:：]\s*(.{1,24})$/)
  if (!hit) return null
  const label = hit[1].trim()
  const value = hit[2].trim()
  if (!value || !/[0-9A-Za-z%\.\-亿万千百]+/.test(value)) return null
  return { label, value }
}

function renderBlocks(paragraphs, bullets, theme) {
  const metrics = bullets.map(metricParts).filter(Boolean)
  const leftoverBullets = bullets.filter((item) => !metricParts(item))
  const parts = []
  if (metrics.length > 0) {
    parts.push(
      `<div class="metrics">${metrics.map((item) => (
        `<div class="metric"><div class="metric-value">${escapeHtml(item.value)}</div><div class="metric-label">${escapeHtml(item.label)}</div></div>`
      )).join('')}</div>`,
    )
  }
  for (const para of paragraphs) {
    if (isHeading(para)) {
      parts.push(`<h2><span class="bar"></span><span>${escapeHtml(para)}</span></h2>`)
      continue
    }
    if (isTimeline(para)) {
      const split = para.match(/^(\S{2,16})\s+([\s\S]+)$/)
      if (split) {
        parts.push(`<div class="time"><span class="time-k">${escapeHtml(split[1])}</span><span class="time-v">${escapeHtml(split[2])}</span></div>`)
        continue
      }
    }
    parts.push(`<p>${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
  }
  if (leftoverBullets.length > 0) {
    parts.push(`<ul>${leftoverBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)
  }
  return parts.join('\n')
}

function buildHtml(input) {
  const title = String(input.title || '').trim() || 'Untitled'
  const theme = THEMES[inferTheme(input)]
  const wanted = Number(input.pageCount) || 0
  let pages = pagesFromInput(input)
  if (wanted > 1) {
    const paragraphs = pages.flatMap((page) => page.paragraphs)
    const bullets = pages.flatMap((page) => page.bullets)
    const size = Math.max(1, Math.ceil(Math.max(paragraphs.length, 1) / wanted))
    pages = Array.from({ length: wanted }, (_, index) => {
      const slice = paragraphs.slice(index * size, (index + 1) * size)
      return {
        heading: index === 0 ? '' : `第${index + 1}页`,
        paragraphs: slice.length > 0 ? slice : ['\u00a0'],
        bullets: index === wanted - 1 ? bullets : [],
      }
    })
  }
  const allParas = pages.flatMap((page) => page.paragraphs)
  const allBullets = pages.flatMap((page) => page.bullets)
  const sub = allParas[0] && !isHeading(allParas[0]) && allParas[0].length <= 80 ? allParas[0] : ''
  const bodyParas = sub ? allParas.slice(1) : allParas
  const inner = renderBlocks(bodyParas, allBullets, theme)
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: ${theme.bg};
      --navy: ${theme.navy};
      --accent: ${theme.accent};
      --text: ${theme.text};
      --muted: ${theme.muted};
      --line: ${theme.line};
    }
    @page { size: A4; margin: 14mm 16mm 16mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 11pt;
      line-height: 1.65;
      font-family: "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC",
        "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }
    .hero {
      background: var(--navy);
      color: #fff;
      padding: 18pt 18pt 16pt;
      margin: 0 0 16pt;
    }
    .hero h1 { font-size: 20pt; font-weight: 700; margin: 0; line-height: 1.35; color: #fff; }
    .hero .sub { margin: 8pt 0 0; font-size: 10.5pt; opacity: 0.88; line-height: 1.5; }
    h2 {
      display: flex;
      align-items: center;
      gap: 8pt;
      font-size: 13.5pt;
      font-weight: 700;
      margin: 16pt 0 10pt;
      color: var(--text);
      break-after: avoid;
    }
    .bar { width: 4pt; height: 14pt; background: var(--accent); flex: none; }
    p { margin: 0 0 10pt; text-align: justify; }
    ul { margin: 0 0 10pt; padding-left: 1.2em; }
    li { margin: 0 0 6pt; }
    .metrics { display: flex; flex-wrap: wrap; gap: 8pt; margin: 0 0 14pt; }
    .metric {
      flex: 1 1 22%;
      min-width: 90pt;
      border: 1pt solid var(--line);
      padding: 8pt 10pt;
    }
    .metric-value { color: var(--navy); font-size: 14pt; font-weight: 700; }
    .metric-label { color: var(--accent); font-size: 8.5pt; margin-top: 4pt; font-weight: 650; }
    .time { display: flex; gap: 10pt; margin: 0 0 8pt; }
    .time-k { color: var(--accent); font-weight: 700; min-width: 72pt; flex: none; }
    .time-v { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 12pt; font-size: 10pt; }
    th { background: var(--navy); color: #fff; text-align: left; padding: 6pt 8pt; }
    td { border-bottom: 1pt solid var(--line); padding: 6pt 8pt; }
  </style>
</head>
<body>
  <header class="hero">
    <h1>${escapeHtml(title)}</h1>
    ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ''}
  </header>
  ${inner}
</body>
</html>`
}

const LINUX_BASE_FLAGS = [
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--use-gl=disabled',
  '--disable-features=Vulkan',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--no-zygote',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-background-networking',
  '--no-first-run',
  '--no-pdf-header-footer',
  '--hide-scrollbars',
  '--mute-audio',
]

function chromeEnv() {
  const home = process.env.HOME || homedir() || tmpdir()
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_CACHE_HOME: join(tmpdir(), 'spur-chrome-cache'),
    XDG_RUNTIME_DIR: join(tmpdir(), 'spur-chrome-run'),
    CHROME_HEADLESS: '1',
  }
}

function runChromeOnce(chromePath, destPath, htmlPath, extraFlags, profileDir) {
  const args = [
    ...extraFlags,
    ...LINUX_BASE_FLAGS,
    `--crash-dumps-dir=${join(profileDir, 'crash')}`,
    `--user-data-dir=${profileDir}`,
    `--print-to-pdf=${destPath}`,
    pathToFileURL(htmlPath).href,
  ]
  return new Promise((resolvePromise, reject) => {
    const child = spawn(chromePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: chromeEnv(),
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Chrome PDF timed out'))
    }, 25_000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      if (existsSync(destPath)) {
        resolvePromise()
        return
      }
      const hint = stderr.includes('libGLESv2')
        ? ' Distro Chromium cannot load GPU libs on this host. Install Google Chrome or chmod a+rX /usr/lib64/chromium-browser.'
        : ''
      reject(
        new Error(
          `Chrome PDF failed (code=${code} signal=${signal}): ${stderr.trim() || 'no stderr'}.${hint}`,
        ),
      )
    })
  })
}

async function runChrome(chromePath, htmlPath, destPath) {
  const attempts = [
    ['--headless=new'],
    ['--headless', '--single-process'],
  ]
  let lastError
  for (const extra of attempts) {
    const profileDir = await mkdtemp(join(tmpdir(), 'spur-chrome-profile-'))
    try {
      await runChromeOnce(chromePath, destPath, htmlPath, extra, profileDir)
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export async function writeOfficePdf(input, destPath) {
  const chromePath = findChrome()
  const out = resolve(destPath)
  const dir = await mkdtemp(join(tmpdir(), 'spur-pdf-'))
  const htmlPath = join(dir, 'page.html')
  await writeFile(htmlPath, buildHtml(input), 'utf8')
  try {
    await runChrome(chromePath, htmlPath, out)
  } finally {
    await unlink(htmlPath).catch(() => {})
  }
  return out
}
