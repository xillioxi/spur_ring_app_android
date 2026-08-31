import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export function officeOutputDir() {
  return join(here, '..', 'output')
}

export async function officeOutputPath(fileName) {
  const dir = officeOutputDir()
  await mkdir(dir, { recursive: true })
  return join(dir, fileName)
}
