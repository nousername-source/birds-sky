import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
let browser
const guard = setTimeout(() => fail('timed out'), 120_000)
function cleanup() { clearTimeout(guard); try { server.kill('SIGTERM') } catch {} }
async function fail(msg) { console.error(`smoke: FAIL — ${msg}`); await browser?.close().catch(() => {}); cleanup(); process.exit(1) }
async function waitForServer() { for (let i = 0; i < 60; i += 1) { try { if ((await fetch(url)).ok) return } catch {} await new Promise(r => setTimeout(r, 250)) } throw new Error('preview server did not start') }
async function openGame(context, errors) {
  const page = await context.newPage()
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(String(e)))
  page.on('response', r => r.status() >= 400 && !r.url().includes('.glb') && errors.push(`HTTP ${r.status()} ${r.url()}`))
  await page.goto(url)
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 30_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const expected = document.documentElement.lang === 'zh-CN' ? 'ManusCC0 Sans CJK SC' : 'ManusCC0'
    for (const selector of ['.logo-lockup h1', '.tagline']) {
      const family = getComputedStyle(document.querySelector(selector)).fontFamily
      if (!family.startsWith(`"${expected}"`) && !family.startsWith(expected + ',')) throw new Error(`Unexpected game font: ${family}`)
    }
    if (![...document.fonts].some(face => face.family.replaceAll('"', '').replaceAll("'", '') === expected && face.status === 'loaded')) throw new Error(`Bundled font did not load: ${expected}`)
  })
  await page.waitForTimeout(450)
  return page
}
try {
  await waitForServer()
  browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ args: ['--ignore-gpu-blocklist'], channel: 'chrome' }))
  const errors = []
  const en = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })
  const page = await openGame(en, errors)
  await page.screenshot({ path: `${out}/01-title-en.png` })
  await page.click('[data-action="endless"]')
  await page.waitForSelector('[data-screen="hud"].is-active')
  const before = await page.evaluate(() => ({ mode: window.__game.game.mode, height: window.__game.game.run.height }))
  await page.fill('#answer', 'food')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(350)
  const after = await page.evaluate(() => ({ mode: window.__game.game.mode, height: window.__game.game.run.height, flaps: window.__game.game.run.flaps }))
  if (after.mode !== 'playing') throw new Error(`expected playing, got ${after.mode}`)
  if (after.flaps !== 1 || after.height <= before.height) throw new Error('correct answer did not register lift')
  await page.screenshot({ path: `${out}/02-correct-answer.png` })
  await page.waitForTimeout(1600)
  await page.fill('#answer', 'nonsense category')
  await page.keyboard.press('Enter')
  await page.waitForSelector('.fly-on.is-visible')
  await page.screenshot({ path: `${out}/03-wrong-try.png` })
  await page.click('[data-action="pause"]')
  await page.waitForSelector('[data-screen="pause"].is-active')
  await page.screenshot({ path: `${out}/04-pause.png` })
  await page.click('[data-action="resume"]')
  await page.waitForSelector('[data-screen="hud"].is-active')
  await page.evaluate(() => { const game = window.__game.game; game.run.height = 0; game.step(0.01) })
  await page.waitForSelector('[data-screen="results"].is-active', { timeout: 5000 })
  await page.screenshot({ path: `${out}/05-results.png` })
  await en.close()
  const zh = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' })
  const zhPage = await openGame(zh, errors)
  await zhPage.screenshot({ path: `${out}/06-title-zh.png` })
  await zh.close()
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US' })
  const phonePage = await openGame(phone, errors)
  await phonePage.tap('[data-action="play"]')
  await phonePage.waitForSelector('[data-screen="hud"].is-active')
  await phonePage.waitForTimeout(900)
  await phonePage.screenshot({ path: `${out}/07-phone-hud.png` })
  await phone.close()
  if (errors.length) throw new Error(`console errors:\n  ${errors.join('\n  ')}`)
  await browser.close(); cleanup(); console.log(`smoke: OK — screenshots in ${out}/`)
} catch (err) { await fail(err?.message ?? String(err)) }
