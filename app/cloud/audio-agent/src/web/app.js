const startButton = document.querySelector('#start')
const stopButton = document.querySelector('#stop')
const statusText = document.querySelector('#status')
const transcriptText = document.querySelector('#transcript')
const agentOutputText = document.querySelector('#agent-output')
const audioFileInput = document.querySelector('#audio-file')
const uploadFileButton = document.querySelector('#upload-file')

let recorder = null
let chunks = []

startButton.addEventListener('click', async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  chunks = []
  recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })

  recorder.addEventListener('dataavailable', event => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  })

  recorder.addEventListener('stop', async () => {
    stream.getTracks().forEach(track => track.stop())
    await submitAudio(new Blob(chunks, { type: 'audio/webm' }))
  })

  recorder.start()
  setStatus('录音中')
  startButton.disabled = true
  stopButton.disabled = false
})

stopButton.addEventListener('click', () => {
  if (!recorder) return
  setStatus('上传中，随后会进行转写和 agent 执行')
  stopButton.disabled = true
  recorder.stop()
})

uploadFileButton.addEventListener('click', async () => {
  const file = audioFileInput.files?.[0]
  if (!file) {
    setStatus('请先选择一个本地音频文件')
    return
  }

  setStatus(`上传本地文件：${file.name}`)
  uploadFileButton.disabled = true
  await submitAudio(file)
})

async function submitAudio(blob) {
  const formData = new FormData()
  const fileName = blob instanceof File ? blob.name : 'recording.webm'
  formData.append('audio', blob, fileName)

  transcriptText.textContent = ''
  agentOutputText.textContent = ''

  try {
    setStatus('服务端处理中：保存音频、转码、真实转写、调用 agent')
    const response = await fetch('/api/audio-task', {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Audio task failed')
    }

    transcriptText.textContent = data.transcript || ''
    agentOutputText.textContent =
      [data.report?.url ? `报告链接：${data.report.url}\n` : '', data.agent?.output || '']
        .join('') ||
      `Agent exited with code ${data.agent?.exitCode ?? 'unknown'} and no output.`
    const emailStatus = getEmailStatus(data.email)
    setStatus(`完成：${data.id}，agent exitCode=${data.agent?.exitCode}${emailStatus}`)
  } catch (error) {
    setStatus(`失败：${error.message}`)
  } finally {
    startButton.disabled = false
    uploadFileButton.disabled = false
    recorder = null
  }
}

function setStatus(value) {
  statusText.textContent = value
}

function getEmailStatus(email) {
  if (!email?.enabled) return ''
  if (email.sent) return `，邮件已发送到 ${email.to}`
  return `，邮件发送失败：${email.error || 'unknown error'}`
}
