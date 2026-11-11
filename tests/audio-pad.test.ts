import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Audio } from '../src/engine/audio'

const contexts: MockAudioContext[] = []

class MockAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  createGain = vi.fn(() => ({
    gain: { setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(function (this: object) { return this }),
  }))
  createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    detune: { value: 0 },
    connect: vi.fn(function (this: object) { return this }),
    start: vi.fn(),
    stop: vi.fn(),
  }))
  resume = vi.fn(() => Promise.resolve())

  constructor() { contexts.push(this) }
}

describe('deployment ambient pad audio', () => {
  beforeEach(() => {
    contexts.length = 0
    vi.stubGlobal('AudioContext', MockAudioContext)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('does not start the continuous ambient pad', () => {
    const audio = new Audio()
    audio.startMusic()
    expect(contexts[0].createOscillator).not.toHaveBeenCalled()
  })

  it('keeps short sound effects available', () => {
    const audio = new Audio()
    audio.play('ui')
    expect(contexts[0].createOscillator).toHaveBeenCalledOnce()
  })
})
