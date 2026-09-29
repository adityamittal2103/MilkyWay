// Visual QA with the locally installed Chrome (no browser download).
// usage: node scripts/qa/shoot.mjs <url> <out.png> [w] [h] [scrollVH] [waitMs] [actionsJSON]
// actions: [{"eval": "js"}, {"click": "css"}, {"hover": [x,y]}, {"wait": ms}, {"key": "KeyW"}]
import { chromium } from 'playwright-core'
const [, , url, out, w = '1440', h = '900', vh = '0', wait = '3500', actions = '[]'] = process.argv
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: (process.env.GLARGS ?? '--use-angle=metal --enable-gpu --ignore-gpu-blocklist').split(' '),
})
const mobile = +w < 720
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 300)))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, +(process.env.ERRLEN ?? 300)))
})
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__mw?.useWorld.getState().booted, null, { timeout: 45000 }).catch(() => errors.push('boot timeout'))
if (!process.env.NOSKIP) await page.evaluate(async () => {
  for (let i = 0; i < 60; i++) {
    const b = document.querySelector('.intro__skip')
    if (b) { b.click(); break }
    if (window.__mw?.useWorld.getState().introDone) break
    await new Promise((r) => setTimeout(r, 150))
  }
})
await page.waitForTimeout(1200)
if (+vh)
  await page.evaluate((v) => {
    // on the journey, scroll by chapter units (matches the director); elsewhere by screens
    const secs = [...document.querySelectorAll('[data-journey] > section[data-u]')]
    if (!secs.length) return window.scrollTo(0, innerHeight * v)
    let y = 0
    for (const s of secs) {
      const u = +s.dataset.u
      const h = +s.dataset.h
      if (v >= u) y = s.offsetTop + Math.min(1, (v - u) / h) * s.offsetHeight
    }
    window.scrollTo(0, y)
  }, +vh)
for (const a of JSON.parse(actions)) {
  if (a.eval) await page.evaluate(a.eval)
  if (a.click) await page.click(a.click)
  if (a.hover) await page.mouse.move(a.hover[0], a.hover[1], { steps: 8 })
  if (a.key) await page.keyboard.press(a.key)
  if (a.wait) await page.waitForTimeout(a.wait)
}
await page.waitForTimeout(+wait)
await page.screenshot({ path: out })
const info = await page.evaluate(() => {
  const s = window.__mw?.useWorld.getState()
  return { tier: s?.tier, mode: s?.mode, nav: s?.nav, journey: +(window.__mw?.live.journey ?? 0).toFixed(3), fps: window.__fps }
})
console.log(JSON.stringify({ out, ...info, errors: errors.filter((e) => !/Download the React DevTools|THREE.WebGLRenderer: Context Lost/.test(e)).slice(0, 8) }))
await browser.close()
