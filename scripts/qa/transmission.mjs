// Transmission QA: captures one artist reveal at chosen moments of its timeline (+ a contact sheet).
// usage: node scripts/qa/transmission.mjs <base> <id> <out-prefix> [w] [h] [signalMode] [times…]
import { chromium } from 'playwright-core'
const [, , base = 'http://localhost:3302', id = 'tx-001', out = '.qa/tx', w = '1440', h = '900', mode = 'normal', ...times] = process.argv
const T = times.length ? times.map(Number) : [0.6, 1.7, 2.9, 4.1, 5.3, 6.5, 9.5]
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const mobile = +w < 720
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
await page.goto(`${base}/artists/${id}?qa&signal=${mode}`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__mw?.useWorld.getState().ready && window.__mwtx?.ready, null, { timeout: 45000 }).catch(() => errors.push('not ready'))
await page.waitForFunction(() => window.__mw.live.camState !== 'flight', null, { timeout: 15000 }).catch(() => {})
await page.waitForFunction(() => window.__mw.useWorld.getState().booted && !document.querySelector('.loader:not(.is-done)'), null, { timeout: 20000 }).catch(() => errors.push('loader stayed'))
await page.waitForTimeout(1000)
const files = []
for (const t of T) {
  await page.evaluate((t) => (window.__mwtx.t = t), t)
  await page.waitForTimeout(t >= 7.2 ? 2600 : 120) // the information fades in over ~1.2 s once stable
  const f = `${out}-${String(t).replace('.', '_')}.png`
  await page.screenshot({ path: f })
  files.push(f)
}
console.log(JSON.stringify({ files, errors }))
await browser.close()
