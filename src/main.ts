import './styles/main.css'
import { Audio } from './engine/audio'
import { Renderer, suggestQuality } from './engine/renderer'
import { resolveLocale } from './engine/i18n'
import { SaveStore } from './engine/save'
import { Game, type GameMode } from './game/game'
import { Ui } from './ui/ui'

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const save = new SaveStore()
  const locale = resolveLocale(save.data.locale, navigator.languages)
  document.documentElement.lang = locale
  document.documentElement.dataset.locale = locale
  const audio = new Audio()
  audio.setVolumes(save.data.musicVolume, save.data.sfxVolume, save.data.muted)
  const renderer = new Renderer(canvas, save.data.quality || suggestQuality())

  let game: Game
  const ui = new Ui({
    start: (mode: GameMode) => {
      audio.unlock()
      audio.startMusic()
      if (!game.start(mode)) {
        ui.showDailyLocked()
        return
      }
      ui.show('hud')
      ui.focusAnswer()
    },
    pause: () => {
      if (game.mode === 'playing') {
        game.pause()
        ui.show('pause')
      }
    },
    resume: () => {
      if (game.mode === 'paused') {
        game.resume()
        ui.show('hud')
        ui.focusAnswer()
      }
    },
    title: () => {
      game.toTitle()
      ui.show('title')
    },
    submit: answer => game.submitAnswer(answer),
    flyOn: () => game.flyOn(),
  }, save, audio)

  game = new Game(renderer, audio, {
    term: term => ui.showTerm(term),
    correct: result => ui.showCorrect(result),
    wrong: result => ui.showWrong(result),
    reveal: reveal => ui.showReveal(reveal),
    tutorial: line => ui.showTutorial(line),
    encounter: line => ui.showEncounter(line),
    end: run => ui.showResults(run),
  })
  ui.attachGame(game)
  ui.show('title')

  ;(window as unknown as { __game: unknown }).__game = { game, ui, save }

  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    game.step(dt)
    if (game.mode === 'playing' || game.mode === 'paused' || game.mode === 'ended') ui.updateHud(game.run)
    game.render(dt)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (ui.screen === 'about') ui.show('title')
    }
  })
  window.addEventListener('game:pause', () => ui.actions.pause())
  let cheatBuffer = ''
  window.addEventListener('keydown', event => {
    if (event.key.length !== 1 && event.key !== ' ') return
    cheatBuffer = `${cheatBuffer}${event.key.toLowerCase()}`.slice(-32)
    if (cheatBuffer.includes('birdwidth daily')) {
      game.enableDailyReplay('birdwidth daily')
      cheatBuffer = ''
      ui.showDailyCheatNotice()
    }
  })
  window.setTimeout(() => ui.show('title'), 220)
}

boot().catch(error => {
  console.error(error)
  const ui = document.getElementById('ui')
  if (ui) ui.innerHTML = `<div class="fatal">BirdsSky could not take off: ${String((error as Error)?.message ?? error).replace(/[<>&]/g, '')}</div>`
})
