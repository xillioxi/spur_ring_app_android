'use strict'

const { createReadStream, statSync } = require('node:fs')
const { basename, join, resolve, sep } = require('node:path')
const { pathToFileURL } = require('node:url')

exports.name = 'spur-office-sandbox'
exports.inject = ['tools', 'webServer']

function plainText(value) {
  return String(value ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .trim()
}

function officeCopy(args) {
  return {
    title: plainText(args.title),
    body: plainText(args.body),
    bullets: Array.isArray(args.bullets) ? args.bullets.map(plainText).filter(Boolean) : [],
  }
}

function stemOf(args, fallback) {
  const fromStem = String(args.file_stem || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  if (fromStem) return fromStem
  return `${fallback}-${Date.now()}`
}

function publicUrl(fileName) {
  return `/spur-office/${encodeURIComponent(fileName)}`
}

function mimeFor(fileName) {
  if (fileName.endsWith('.pdf')) return 'application/pdf'
  if (fileName.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
  return 'application/octet-stream'
}

function mountOfficeFiles(ctx) {
  const webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : ctx.webServer
  if (!webServer || typeof webServer.register !== 'function') return

  const outputDir = resolve(join(__dirname, '..', 'output'))
  webServer.register({
    kind: 'prefix',
    path: '/spur-office',
    handler(req, res) {
      let name = ''
      try {
        name = basename(new URL(req.url ?? '/', 'http://x').pathname)
      } catch {
        res.writeHead(400)
        res.end()
        return
      }
      if (!name) {
        res.writeHead(404)
        res.end()
        return
      }
      const dest = resolve(outputDir, name)
      if (dest !== outputDir && !dest.startsWith(outputDir + sep)) {
        res.writeHead(403)
        res.end()
        return
      }
      try {
        statSync(dest)
      } catch {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, {
        'Content-Type': mimeFor(name),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      })
      createReadStream(dest).pipe(res)
    },
  })
}

const textFields = {
  title: { type: 'string', required: true, description: 'Plain-text title (no Markdown)' },
  body: { type: 'string', description: 'Optional plain-text paragraph (no Markdown)' },
  bullets: {
    type: 'array',
    description: 'Optional plain-text bullets (no **bold** Markdown)',
    items: { type: 'string' },
  },
}

const fileResult = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string' },
      bytes: { type: 'number' },
      url: { type: 'string' },
    },
    required: ['path', 'bytes', 'url'],
  },
}

exports.apply = function apply(ctx) {
  mountOfficeFiles(ctx)

  ctx.tools.register({
    name: 'create_pdf',
    description:
      'Create a real one-page PDF (binary %PDF header, preview-openable). '
      + 'Use this instead of Write/bash for .pdf. Chinese is supported. '
      + 'Pass plain text only: no Markdown (**bold**, headings, backticks). '
      + 'After success, tell the user the url field verbatim as a Markdown link '
      + 'like [打开文件](/spur-office/document-123.pdf). Never invent a Chinese filename.',
    parameters: { ...textFields, file_stem: { type: 'string', description: 'Output basename without .pdf' } },
    output: {
      ...fileResult,
      render: (_args, value) => [{
        type: 'text',
        text: `Open this file (copy this path exactly): ${value.url}`,
      }],
    },
    async execute(args) {
      const [{ writeOfficePdf }, { officeOutputPath }] = await Promise.all([
        import(pathToFileURL(join(__dirname, '../../pdf/src/write-pdf.mjs')).href),
        import(pathToFileURL(join(__dirname, 'output.mjs')).href),
      ])
      const fileName = `${stemOf(args, 'document')}.pdf`
      const dest = await officeOutputPath(fileName)
      await writeOfficePdf(officeCopy(args), dest)
      return { path: dest, bytes: statSync(dest).size, url: publicUrl(fileName) }
    },
  })

  ctx.tools.register({
    name: 'create_pptx',
    description:
      'Create a real PowerPoint file (.pptx OOXML). Use this instead of Write/bash for .pptx. '
      + 'Chinese is supported. One title slide with optional body and bullets. '
      + 'Pass plain text only: no Markdown (**bold**, headings, backticks). '
      + 'After success, tell the user the url field verbatim as a Markdown link. '
      + 'Never invent a Chinese filename.',
    parameters: { ...textFields, file_stem: { type: 'string', description: 'Output basename without .pptx' } },
    output: {
      ...fileResult,
      render: (_args, value) => [{
        type: 'text',
        text: `Open this file (copy this path exactly): ${value.url}`,
      }],
    },
    async execute(args) {
      const [{ writeOfficePptx }, { officeOutputPath }] = await Promise.all([
        import(pathToFileURL(join(__dirname, '../../pptx/src/write-pptx.mjs')).href),
        import(pathToFileURL(join(__dirname, 'output.mjs')).href),
      ])
      const fileName = `${stemOf(args, 'slides')}.pptx`
      const dest = await officeOutputPath(fileName)
      await writeOfficePptx(officeCopy(args), dest)
      return { path: dest, bytes: statSync(dest).size, url: publicUrl(fileName) }
    },
  })
}
