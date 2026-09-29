// Touch QA (phone emulation): one-finger drag orbits, two-finger drag moves, pinch zooms.
import { chromium } from 'playwright-core'
const base = process.argv[2] ?? 'http://localhost:3302'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await page.goto(base + '/explore?to=venue&qa', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__mw?.useWorld.getState().ready && window.__r3f && window.__mw.live.camState === 'user', null, { timeout: 45000 })
await page.waitForTimeout(1200)
const cam = () => page.evaluate(() => { const c = window.__r3f.camera; return { p: [c.position.x, c.position.y, c.position.z], d: c.getWorldDirection(new c.position.constructor()).toArray() } })
const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
async function gesture(from, to, steps = 14) {
  await touch('touchStart', from)
  for (let i = 1; i <= steps; i++) await touch('touchMove', from.map(([x, y], k) => [x + (to[k][0] - x) * (i / steps), y + (to[k][1] - y) * (i / steps)]))
  await touch('touchEnd', [])
  await page.waitForTimeout(900)
}
const len = (v) => Math.hypot(...v)
const sub = (a, b) => a.map((x, i) => x - b[i])
let ok = 0
const report = (name, pass, detail) => { if (pass) ok++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} ${detail}`) }
// the venue HUD covers part of the screen: gestures start over open world
let a = await cam()
await gesture([[200, 560]], [[320, 560]])
let b = await cam()
const az = await page.evaluate(() => window.__mw.live.orbit.az)
report('one finger drags: orbit', Math.abs(az) > 0.3 && len(sub(b.d, a.d)) > 0.02, `orbit az ${az.toFixed(2)} rad, view turned ${len(sub(b.d, a.d)).toFixed(3)}`)
a = b
await gesture([[160, 520], [240, 600]], [[160, 420], [240, 500]])
b = await cam()
report('two fingers drag: move', len(sub(b.p, a.p)) > 5 && len(sub(b.d, a.d)) < 0.05, `moved ${len(sub(b.p, a.p)).toFixed(1)}, turn ${len(sub(b.d, a.d)).toFixed(3)}`)
a = b
await gesture([[195, 470], [195, 610]], [[195, 380], [195, 700]])
b = await cam()
const z = await page.evaluate(() => window.__mw.live.orbit.zoom)
report('pinch: zoom', z < 0.95, `zoom ${z.toFixed(2)}`)
console.log(`\n${ok}/3 passed`)
await browser.close()
process.exit(ok === 3 ? 0 : 1)
