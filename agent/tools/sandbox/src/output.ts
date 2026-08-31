import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** 生成文件落在 tools/sandbox/output/ */
export function officeOutputDir(): string {
  return join(here, '..', 'output')
}

export async function officeOutputPath(fileName: string): Promise<string> {
  const dir = officeOutputDir()
  await mkdir(dir, { recursive: true })
  return join(dir, fileName)
}
