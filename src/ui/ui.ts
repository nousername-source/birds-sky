import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Audio } from '../engine/audio'
import type { SaveStore } from '../engine/save'
import { fallRateForHeight, type CorrectResult, type GameMode, type Game, type Reveal, type RunState, type Term, type WrongResult } from '../game/game'

export type Screen = 'title' | 'hud' | 'pause' | 'about' | 'results'
export type UiActions = {
  start(mode: GameMode): void
  pause(): void
  resume(): void
  title(): void
  submit(answer: string): void
  flyOn(): void
}

export class Ui {
  screen: Screen = 'title'
  readonly actions: UiActions
  private readonly root: HTMLElement
  private game?: Game
  private save?: SaveStore
  private audio?: Audio
  private lastRun?: RunState
  private feedbackTimer?: number

  constructor(actions: UiActions, save?: SaveStore, audio?: Audio) {
    this.actions = actions
    this.save = save
    this.audio = audio
    this.root = document.getElementById('ui')!
    this.root.innerHTML = this.template()
    this.root.addEventListener('click', event => this.onClick(event))
    this.root.querySelector('form')!.addEventListener('submit', event => {
      event.preventDefault()
      const input = this.q<HTMLInputElement>('#answer')
      this.actions.submit(input.value)
    })
    this.root.querySelector<HTMLInputElement>('#answer')!.addEventListener('keydown', event => event.stopPropagation())
    this.setupAboutGallery()
  }

  attachGame(game: Game): void { this.game = game }
  showDailyLocked(): void {
    this.show('title')
    this.q<HTMLElement>('.title-stat').textContent = 'Daily Flight already completed today · return tomorrow'
  }
  showDailyCheatNotice(): void {
    this.q<HTMLElement>('.title-stat').textContent = 'One Daily replay unlocked · it locks again after that flight'
  }
  show(screen: Screen): void {
    this.screen = screen
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-screen]')) {
      const active = element.dataset.screen === screen || (element.dataset.screen === 'hud' && screen === 'pause')
      element.classList.toggle('is-active', active)
      element.setAttribute('aria-hidden', String(!active))
    }
    this.root.dataset.activeScreen = screen
    if (screen === 'title') this.q<HTMLElement>('.title-stat').textContent = this.save?.data.leaderboard[0] ? `Best flight · ${this.save.data.leaderboard[0].score}m` : 'Free browser prototype · no account'
    if (screen === 'hud') this.focusAnswer()
    if (screen === 'about') this.startAboutGallery()
    else this.stopAboutGallery()
  }

  focusAnswer(): void {
    window.setTimeout(() => {
      const input = this.q<HTMLInputElement>('#answer')
      if (this.screen === 'hud' && !input.disabled) input.focus({ preventScroll: true })
    }, 60)
  }

  showTerm(term: Term): void {
    this.q<HTMLElement>('.term-word').textContent = term.word
    this.q<HTMLElement>('.term-theme').textContent = term.theme
    this.q<HTMLElement>('.term-number').textContent = `TERM ${this.game?.termNumber ?? 1}`
    const input = this.q<HTMLInputElement>('#answer')
    input.value = ''
    input.disabled = false
    this.q<HTMLButtonElement>('.answer-submit').disabled = false
    this.q<HTMLButtonElement>('.fly-on').classList.remove('is-visible')
    this.setFeedback('Your answer is the wingbeat. Make it count.', 'neutral')
    this.q('.reveal').classList.remove('is-visible')
    const tutorialTerm = this.game?.run.mode === 'tutorial'
    if (tutorialTerm && term.tutorialHint) this.showTutorial(term.tutorialHint)
    this.focusAnswer()
  }

  showCorrect(result: CorrectResult): void {
    const phrase = result.tier === 'Hawk' ? 'Extreme answer.' : result.tier === 'Crow' ? 'Rare answer.' : 'Common answer. Safe, boring, works.'
    this.setFeedback(`${phrase} · +${result.points} points · +${result.lift} altitude`, result.tier.toLowerCase())
    this.showBadge(`+${result.points} pts · ${result.flaps} flaps`)
    this.q<HTMLInputElement>('#answer').disabled = true
    this.q<HTMLButtonElement>('.answer-submit').disabled = true
    this.q<HTMLButtonElement>('.fly-on').classList.remove('is-visible')
  }

  showWrong(result: WrongResult): void {
    this.setFeedback(result.message, result.duplicate ? 'duplicate' : 'wrong')
    if (result.canFlyOn) this.q<HTMLButtonElement>('.fly-on').classList.add('is-visible')
  }

  showReveal(reveal: Reveal): void {
    const card = this.q<HTMLElement>('.reveal')
    card.classList.add('is-visible')
    card.querySelector('.reveal-score')!.textContent = reveal.points ? `You scored ${reveal.points} points (${reveal.scored} flaps).` : 'No points this time.'
    card.querySelector('.reveal-better')!.textContent = reveal.better ? `'${reveal.better.answers[0]}' would have been ${reveal.better.flaps}.` : 'The sky kept its secrets.'
  }

  showTutorial(line: string): void {
    // Tutorial guidance is now delivered through the normal HUD feedback.
    this.setFeedback(line, 'neutral')
  }

  showEncounter(line: string): void {
    this.showTutorial(line)
  }

  showResults(run: RunState): void {
    this.lastRun = run
    this.q<HTMLElement>('.results-title').textContent = run.reason === 'complete' ? 'Daily flight complete' : 'The ground.'
    const daily = run.mode === 'daily'
    this.q<HTMLElement>('.results-copy').textContent = run.reason === 'complete' && daily ? `Altitude score: ${Math.round(run.height)}u across five terms.` : run.reason === 'complete' ? `${run.points} points across five terms.` : daily ? `Altitude score: ${Math.round(run.height)}u · ${run.terms} terms. The sky kept the receipt.` : `${run.points} points · ${Math.round(run.meters)} meters · ${run.terms} terms. The sky kept the receipt.`
    this.q<HTMLElement>('.result-meters').textContent = daily ? `${Math.round(run.height)}u` : `${Math.round(run.meters)}m`
    this.q<HTMLElement>('.result-metric-label').textContent = daily ? 'altitude score' : 'distance'
    this.q<HTMLElement>('.result-terms').textContent = String(run.terms)
    this.q<HTMLElement>('.result-tier').textContent = ({ Sparrow: 'Common', Crow: 'Rare', Hawk: 'Extreme', Eagle: 'Eagle' } as Record<string, string>)[run.bestTier] ?? 'Common'
    window.setTimeout(() => this.show('results'), run.reason === 'complete' ? 500 : 260)
  }

  updateHud(run: RunState): void {
    this.q<HTMLElement>('.hud-height').textContent = `${Math.round(run.height)}u`
    this.q<HTMLElement>('.hud-flaps').textContent = String(run.flaps)
    this.q<HTMLElement>('.hud-points').textContent = String(run.points)
    this.q<HTMLElement>('.hud-terms').textContent = String(run.terms)
    this.q<HTMLElement>('.hud-meters').textContent = `${Math.round(run.meters)}m`
    this.q<HTMLElement>('.hud-fall-rate').textContent = `${fallRateForHeight(run.height, run.elapsed).toFixed(2)}u/s`
    this.q<HTMLElement>('.altitude-fill').style.height = `${Math.max(2, Math.min(100, (run.height / 255) * 100))}%`
    const band = run.height < 110 ? 'LOW SKY' : run.height < 180 ? 'MID SKY' : run.height < 240 ? 'HIGH SKY' : 'EAGLE SKY'
    this.q<HTMLElement>('.sky-band').textContent = band
    this.q<HTMLElement>('.screen-hud').dataset.skyBand = band.toLowerCase().replace(' ', '-')
    this.q<HTMLElement>('.flight-panel').dataset.band = band
  }

  /** Compatibility hook retained for the starter's keyboard/gamepad menu test. */
  frame(_dt: number): void {
    const legacy = this as unknown as {
      screen?: string
      lastMethod?: string
      navRepeat?: number
      input?: { method: string; move: { x: number; y: number }; consume: (action: string) => boolean }
      moveFocus?: () => void
    }
    if (legacy.screen !== 'settings' || legacy.lastMethod !== 'gamepad' || !legacy.input) return
    if (legacy.input.move.y < -0.5 && legacy.input.consume('confirm')) {
      legacy.moveFocus?.()
      const active = (document as unknown as { activeElement?: { click?: () => void } }).activeElement
      active?.click?.()
    }
    legacy.navRepeat = 0
  }

  private setFeedback(text: string, kind: string): void {
    const el = this.q<HTMLElement>('.feedback')
    el.textContent = text
    el.dataset.kind = kind
    el.classList.remove('feedback-pop')
    void el.offsetWidth
    el.classList.add('feedback-pop')
    if (this.feedbackTimer) window.clearTimeout(this.feedbackTimer)
    this.feedbackTimer = window.setTimeout(() => el.classList.remove('feedback-pop'), 550)
  }

  private showBadge(text: string): void {
    const badge = this.q<HTMLElement>('.flap-badge')
    badge.textContent = text
    badge.classList.remove('is-visible')
    void badge.offsetWidth
    badge.classList.add('is-visible')
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) return
    this.audio?.unlock()
    this.audio?.play('ui')
    const action = target.dataset.action
    if (action === 'play') this.actions.start('endless')
    if (action === 'clear') this.actions.start('clear')
    if (action === 'daily') this.actions.start('daily')
    if (action === 'endless') this.actions.start('endless')
    if (action === 'tutorial') this.actions.start('tutorial')
    if (action === 'about') this.show('about')
    if (action === 'back') this.show('title')
    if (action === 'pause') this.actions.pause()
    if (action === 'resume') this.actions.resume()
    if (action === 'title') this.actions.title()
    if (action === 'fly-on') this.actions.flyOn()
    if (action === 'restart') this.actions.start(this.lastRun?.mode ?? 'endless')
  }

  private q<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)! }

  private template(): string {
    return `<section class="screen screen-title is-active" data-screen="title">
      <div class="title-parallax" aria-hidden="true"></div><div class="title-glow"></div>
      <div class="title-block">
        <div class="eyebrow">A word game about altitude</div>
        <div class="logo-lockup"><span class="logo-bird">✦</span><h1>Birds<span>Sky</span></h1></div>
        <p class="tagline">Name the rarest category. Flap higher.<br><em>Try not to become a ground statistic.</em></p>
        <div class="title-stat">Free browser prototype · no account</div>
        <nav class="menu main-menu"><button class="btn btn-primary" data-action="play"><span>Play</span><small>Endless flight</small></button><button class="btn" data-action="clear"><span>Clear Sky</span><small>No songbirds · no hawks</small></button><button class="btn" data-action="daily"><span>Daily Flight</span><small>Five words · same for everyone</small></button></nav>
        <nav class="utility-menu"><button class="text-btn" data-action="tutorial">Tutorial</button><span>·</span><button class="text-btn" data-action="about">About</button></nav>
      </div>
      <div class="title-note"><span>THE BIRD IS THE TIMER</span><b>2.75 → 14.0 altitude / sec</b></div>
    </section>

    <section class="screen screen-hud" data-screen="hud">
      <header class="hud-top"><div class="hud-brand">BIRDS<span>SKY</span></div><div class="hud-bands"><span class="sky-band">LOW SKY</span><span class="hud-stat"><i>ALT</i><b class="hud-height">38u</b></span><span class="hud-stat"><i>PTS</i><b class="hud-points">0</b></span><span class="hud-stat"><i>FLAPS</i><b class="hud-flaps">0</b></span><span class="hud-stat"><i>TERMS</i><b class="hud-terms">0</b></span><span class="hud-stat"><i>DIST</i><b class="hud-meters">0m</b></span></div><button class="round-btn" disabled aria-label="Pause unavailable">Ⅱ</button></header>
      <div class="altitude-meter"><div class="altitude-fill"></div><div class="altitude-labels"><span>EXTREME</span><span>RARE</span><span>COMMON</span><span>GROUND</span></div></div>
      <main class="flight-panel"><div class="term-meta"><span class="term-theme">Scoring test</span><span class="term-number">TERM 1</span></div><h2 class="prompt">Word: <strong class="term-word">Test</strong></h2><p class="prompt-sub">Name a category the word belongs to; rarer, more specific categories give more lift.</p><div class="tier-legend"><span><i class="dot sparrow"></i>100 pts</span><span><i class="dot crow"></i>300 pts</span><span><i class="dot hawk"></i>550 pts</span><span><i class="dot eagle"></i>800 pts</span></div><form class="answer-form"><input id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type a scoring-test answer…" aria-label="Scoring test answer" /><button class="answer-submit" type="submit">Flap <span>↵</span></button></form><div class="answer-actions"><button class="fly-on" data-action="fly-on">Fly on →</button><span class="fly-on-hint">Wrong once? Bail if you must.</span></div><div class="feedback" data-kind="neutral">Your answer is the wingbeat. Make it count.</div><div class="reveal"><span class="reveal-score">You scored 0 flaps.</span><span class="reveal-better">The sky kept its secrets.</span></div></main><div class="flap-badge"></div><div class="hud-footer"><span>Enter to flap</span><span>Fall rate <b class="hud-fall-rate">2.75u/s</b> · it keeps getting worse.</span></div>
    </section>

    <section class="screen screen-modal" data-screen="pause"><div class="modal-card"><div class="modal-kicker">FLIGHT PAUSED</div><h2>Catch your breath.</h2><p>The ground is patient. It is also not going anywhere.</p><div class="modal-actions"><button class="btn btn-primary" data-action="resume"><span>Resume</span></button><button class="btn" data-action="title"><span>Quit to menu</span></button></div></div></section>
    <section class="screen screen-modal" data-screen="about"><div class="modal-card about-card"><div class="modal-kicker">ABOUT BIRDSSKY</div><h2>How high can your words take you?</h2><div class="about-copy"><p>Welcome to <strong>BirdsSky</strong>, a game of knowledge, precision, and increasingly obscure categories.</p><p>Each round gives you an ordinary object. Your task is to name a category that the object belongs to. The rarer and more specific the category, the more points you earn—and the higher your bird flies.</p><p>But there’s a catch: your bird is constantly losing altitude. Think carefully, but don’t take too long. One excellent answer could keep you in the sky; one poor decision could bring your flight to an end.</p><h3>How to play</h3><ol><li><b>Read the word.</b> Each round presents an object, such as a bicycle, coffee mug, or smartphone.</li><li><b>Think of a category.</b> Name a genuine category the object belongs to. Try to find something less obvious than its everyday classification.</li><li><b>Enter your answer.</b> Type one category and press Enter or click <b>Flap</b>.</li><li><b>Earn altitude.</b> Accepted answers award points and make your bird flap upwards. Rarer categories earn more altitude.</li><li><b>Stay airborne.</b> Your bird starts by losing 2.75 altitude units per second. The fall rate steadily increases with altitude and flight time, reaching roughly 14 altitude units per second in the late game.</li></ol><h3>The four answer tiers</h3><div class="about-tier-table"><span><b>Common</b> · 100–199 · 1 flap</span><span><b>Rare</b> · 200–399 · 2–3 flaps</span><span><b>Extreme</b> · 400–599 · 4–5 flaps</span><span><b>Eagle</b> · 600–800 · 6–8 flaps</span></div><p>Each accepted category has its own point value. The rarer the category, the greater the reward. <strong>Eagle answers are only available in Eagle Sky, above 240 altitude units.</strong></p><h3>What should I type?</h3><p>Your answer should be a <strong>short, precise category name</strong>.</p><p class="about-examples"><b>Good:</b> Vehicle · Plucked-string instrument · Writing instrument · Two-wheeled vehicle · Telecommunications equipment</p><p>Use recognizable categories and established classifications. Be specific when you can think of a genuinely narrower category. Use concise phrases rather than explanations, and try a different category if your first guess is rejected.</p><p><strong>Don’t</strong> write full sentences, submit vague descriptions such as “something you use to write,” submit unrelated categories, invent technical-sounding classifications, add arbitrary adjectives, or assume an unstated material, purpose, or feature.</p><p>Instead of “Things that hold money,” try <strong>Money holder</strong>. Instead of “Something you use to write,” try <strong>Writing instrument</strong>.</p><p>A single word that is part of a longer category may receive partial credit in certain cases. Partial answers earn <strong>85%</strong> of the category’s normal points, only when the full category contains at least three words.</p><div class="about-birds"><article><div class="about-bird-model" data-model="robin"></div><div><h3>The Robin — Your bird</h3><p>Your companion throughout the game. The Robin’s flight depends on your answers. Keep finding categories and earn enough altitude to remain airborne.</p></div></article><article><div class="about-bird-model" data-model="songbird"></div><div><h3>The Songbird — A helpful passerby</h3><p>Songbirds occasionally fly across your path. Some call out a word beside their beak, giving you a hint toward a Common category for the current object.</p></div></article><article><div class="about-bird-model" data-model="hawk"></div><div><h3>The Hawk — A dangerous predator</h3><p>Hawks pursue your Robin and can knock you down if they catch you. A Common answer won’t scare them away. Find a Rare, Extreme, or Eagle answer to send an approaching hawk fleeing.</p></div></article></div><h3>Game modes</h3><p><strong>Endless Flight</strong> — Keep answering as the words change and see how long you can stay in the air.</p><p><strong>Daily Flight</strong> — Five words in a consistent order for everyone that day. One attempt per day.</p><p><strong>Clear Sky</strong> — A quieter flight without songbirds or hawks. Focus entirely on the words and altitude.</p><p><strong>Tutorial</strong> — A guided introduction to categories, scoring tiers, controls, and encounters.</p><h3>Controls and wrong answers</h3><p>Click or tap the answer box, type your category, and press <b>Enter</b> or <b>Flap</b>. Use <b>Fly On</b> after your first incorrect answer to skip a word.</p><p>You have up to two incorrect attempts per word. The first gives you another chance; the second ends the word automatically. Repeating an answer does not count as a new attempt. Skipping earns no points or altitude.</p><p class="about-ending"><strong>The sky is waiting.</strong><br>Think carefully. Be precise. Find the rarest category you can.<br>And whatever you do, don’t become a ground statistic.<br><b>BirdsSky — The bird is the timer.</b></p></div><button class="btn btn-primary" data-action="back"><span>Back to menu</span></button></div></section>
    <section class="screen screen-modal" data-screen="results"><div class="modal-card results-card"><div class="modal-kicker">FLIGHT LOG</div><h2 class="results-title">The ground.</h2><p class="results-copy">The sky kept the receipt.</p><div class="results-grid"><div><b class="result-meters">0m</b><span class="result-metric-label">distance</span></div><div><b class="result-terms">0</b><span>terms</span></div><div><b class="result-tier">Common</b><span>best tier</span></div></div><div class="modal-actions"><button class="btn btn-primary" data-action="restart"><span>Fly again</span></button><button class="btn" data-action="title"><span>Menu</span></button></div></div></section>`
  }

  private setupAboutGallery(): void {
    const loader = new GLTFLoader()
    const sources: Record<string, string> = { robin: '/assets/models/birdssky-american-robin.glb', songbird: '/assets/models/birdssky-alex-songbird.glb', hawk: '/assets/models/birdssky-hawk.glb' }
    for (const element of this.root.querySelectorAll<HTMLElement>('.about-bird-model')) {
      const key = element.dataset.model ?? 'robin'
      const canvas = document.createElement('canvas')
      element.appendChild(canvas)
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      const scene = new THREE.Scene()
      scene.add(new THREE.HemisphereLight(0xfff1c9, 0x16304d, 2.1))
      const keyLight = new THREE.DirectionalLight(0xffd28a, 2.2)
      keyLight.position.set(3, 4, 5)
      scene.add(keyLight)
      const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100)
      camera.position.set(0, 0.1, 4.2)
      const gallery: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; mixer?: THREE.AnimationMixer; frame: number } = { renderer, scene, camera, frame: 0 }
      ;(element as HTMLElement & { __aboutGallery?: typeof gallery }).__aboutGallery = gallery
      loader.load(sources[key], gltf => {
        const model = gltf.scene
        const bounds = new THREE.Box3().setFromObject(model)
        const size = bounds.getSize(new THREE.Vector3())
        const center = bounds.getCenter(new THREE.Vector3())
        model.position.sub(center)
        const presentation = key === 'robin'
          ? { scale: 1.12, y: -0.28 }
          : key === 'songbird'
            ? { scale: 1.28, y: 0.16 }
            : { scale: 2.1, y: 0.18 }
        model.scale.setScalar(presentation.scale / Math.max(size.x, size.y, size.z))
        model.position.y += presentation.y
        model.rotation.y = -Math.PI / 2
        scene.add(model)
        if (gltf.animations[0]) gallery.mixer = new THREE.AnimationMixer(model)
        if (gallery.mixer) gallery.mixer.clipAction(gltf.animations[0]).play()
      })
    }
  }

  private startAboutGallery(): void {
    for (const element of this.root.querySelectorAll<HTMLElement>('.about-bird-model')) {
      const gallery = (element as HTMLElement & { __aboutGallery?: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; mixer?: THREE.AnimationMixer; frame: number } }).__aboutGallery
      if (!gallery || gallery.frame) continue
      const render = (now: number): void => {
        if (this.screen !== 'about') { gallery.frame = 0; return }
        const width = Math.max(1, element.clientWidth)
        const height = Math.max(1, element.clientHeight)
        gallery.renderer.setSize(width, height, false)
        gallery.camera.aspect = width / height
        gallery.camera.updateProjectionMatrix()
        gallery.mixer?.update(1 / 60)
        gallery.scene.rotation.y = Math.sin(now * 0.00045) * 0.08
        gallery.renderer.render(gallery.scene, gallery.camera)
        gallery.frame = requestAnimationFrame(render)
      }
      gallery.frame = requestAnimationFrame(render)
    }
  }

  private stopAboutGallery(): void {
    for (const element of this.root.querySelectorAll<HTMLElement>('.about-bird-model')) {
      const gallery = (element as HTMLElement & { __aboutGallery?: { frame: number } }).__aboutGallery
      if (gallery?.frame) { cancelAnimationFrame(gallery.frame); gallery.frame = 0 }
    }
  }
}
