import type { TranscribeInput } from './index.js'

export async function transcribeWithMock(
  input: TranscribeInput,
): Promise<string> {
  return [
    '这是 mock 语音转写结果。',
    `音频文件已保存到：${input.filePath}`,
    '请总结这段音频，并直接输出一份简短的 Markdown 记录，不需要写入文件。',
  ].join('\n')
}
