import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '..', 'package.json'))
const PptxGenJS = require('pptxgenjs')

const FONT = 'PingFang SC'

export async function writeOfficePptx(input, destPath) {
  const title = String(input.title || '').trim() || 'Untitled'
  const pages = Array.isArray(input.pages) && input.pages.length > 0
    ? input.pages
    : [{
        heading: title,
        paragraphs: String(input.body || '').trim() ? [String(input.body).trim()] : [],
        bullets: (input.bullets ?? []).map((item) => String(item).trim()).filter(Boolean),
      }]

  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'A4', width: 11.69, height: 8.27 })
  pres.layout = 'A4'
  pres.author = 'Spur'
  pres.title = title

  pages.forEach((page, index) => {
    const slide = pres.addSlide()
    const heading = String(page.heading || '').trim() || (index === 0 ? title : `第${index + 1}页`)
    slide.addText(index === 0 ? title : heading, {
      x: 0.5,
      y: 0.28,
      w: 10.6,
      h: 0.55,
      fontSize: index === 0 ? 26 : 20,
      fontFace: FONT,
      bold: true,
      color: '1A1A1A',
    })
    const paras = (page.paragraphs ?? []).map((item) => String(item).trim()).filter(Boolean)
    const body = paras.join('\n\n') || String(page.body || '').trim()
    let y = 0.95
    if (body) {
      slide.addText(body, {
        x: 0.5,
        y,
        w: 10.6,
        h: 4.4,
        fontSize: 14,
        fontFace: FONT,
        color: '333333',
        valign: 'top',
      })
      y = 5.5
    }
    const bullets = (page.bullets ?? []).map((item) => String(item).trim()).filter(Boolean)
    if (bullets.length > 0) {
      slide.addText(
        bullets.map((text) => ({ text, options: { fontFace: FONT, fontSize: 14, color: '333333', breakLine: true } })),
        {
          x: 0.6,
          y,
          w: 10.4,
          h: 2.2,
          fontFace: FONT,
          fontSize: 14,
          color: '333333',
          valign: 'top',
          paraSpaceAfter: 6,
        },
      )
    }
  })

  await pres.writeFile({ fileName: destPath })
  return destPath
}
