import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { AudioAgentConfig } from './config.js'

export type PdfReportResult = {
  filePath: string
  url: string
  htmlPath: string
}

export async function createPdfReport(input: {
  config: AudioAgentConfig
  id: string
  title: string
  content: string
}): Promise<PdfReportResult> {
  const reportsDir = join(input.config.appRoot, 'reports')
  await mkdir(reportsDir, { recursive: true })

  const htmlPath = join(reportsDir, `${input.id}.pdf-source.html`)
  const pdfPath = join(reportsDir, `${input.id}.pdf`)

  await writeFile(htmlPath, buildHtml(input))
  await convertHtmlToPdf(htmlPath, pdfPath)

  return {
    filePath: pdfPath,
    htmlPath,
    url: buildReportUrl(input.config, `${input.id}.pdf`),
  }
}

function buildReportUrl(config: AudioAgentConfig, fileName: string): string {
  const baseUrl =
    config.volcengine.publicBaseUrl || `http://localhost:${config.port}`

  return `${baseUrl.replace(/\/$/, '')}/reports/${encodeURIComponent(fileName)}`
}

async function convertHtmlToPdf(
  htmlPath: string,
  pdfPath: string,
): Promise<void> {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const process = Bun.spawn(
    [
      chromePath,
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  const [stderr, exitCode] = await Promise.all([
    new Response(process.stderr).text(),
    process.exited,
  ])

  if (exitCode !== 0) {
    throw new Error(`PDF generation failed: ${stderr}`)
  }
}

function buildHtml(input: { title: string; content: string }): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #202124;
        line-height: 1.65;
        margin: 36px;
      }
      h1, h2, h3 {
        line-height: 1.3;
      }
      h1 {
        font-size: 24px;
        margin-bottom: 24px;
      }
      h2 {
        font-size: 18px;
        margin-top: 24px;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 12px 0;
      }
      th, td {
        border: 1px solid #d0d7de;
        padding: 6px 8px;
      }
    </style>
  </head>
  <body>
    ${markdownToHtml(input.content)}
  </body>
</html>`
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const html: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      continue
    }

    if (trimmed.startsWith('# ')) {
      closeList()
      html.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`)
      continue
    }

    if (trimmed.startsWith('## ')) {
      closeList()
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`)
      continue
    }

    if (trimmed.startsWith('### ')) {
      closeList()
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`)
      continue
    }

    if (trimmed.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`)
      continue
    }

    closeList()
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`)
  }

  closeList()
  return html.join('\n')

  function closeList() {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
