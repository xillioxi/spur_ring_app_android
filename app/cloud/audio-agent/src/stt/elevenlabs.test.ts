import { describe, expect, test } from 'bun:test'
import { segmentsFromElevenLabsWords } from './elevenlabs.js'

describe('segmentsFromElevenLabsWords', () => {
  test('groups adjacent words and spacing by speaker', () => {
    expect(
      segmentsFromElevenLabsWords([
        { type: 'word', text: 'Hello', start: 0, end: 0.4, speaker_id: 'speaker_0' },
        { type: 'spacing', text: ' ', start: 0.4, end: 0.41, speaker_id: 'speaker_0' },
        { type: 'word', text: 'Kevin', start: 0.41, end: 0.8, speaker_id: 'speaker_0' },
        { type: 'word', text: 'Hi', start: 1, end: 1.2, speaker_id: 'speaker_1' },
      ]),
    ).toEqual([
      {
        speakerId: 'speaker_0',
        speakerName: 'Speaker 1',
        start: 0,
        end: 0.8,
        text: 'Hello Kevin',
      },
      {
        speakerId: 'speaker_1',
        speakerName: 'Speaker 2',
        start: 1,
        end: 1.2,
        text: 'Hi',
      },
    ])
  })

  test('preserves speaker-library names', () => {
    expect(
      segmentsFromElevenLabsWords([
        { type: 'word', text: 'Done', start: 2, end: 2.3, speaker_id: 'Kevin' },
      ])[0]?.speakerName,
    ).toBe('Kevin')
  })
})
