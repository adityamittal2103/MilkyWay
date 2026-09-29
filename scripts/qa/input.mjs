// Input QA: holds keys in explore mode and measures what the camera actually does, in its own frame.
// usage: node scripts/qa/input.mjs <base-url> [route]      e.g. http://localhost:3302 /explore?to=venue
import { chromium } from 'playwright-core'

const [, , base = 'http://localhost:3302', route = '/explore'] = process.argv
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const sep = route.includes('?') ? '&' : '?'
await page.goto(base + route + sep + 'qa', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__mw?.useWorld.getState().ready && window.__r3f, null, { timeout: 45000 })
const settle = () => page.waitForFunction(() => window.__mw.live.camState === 'user' && window.__mw.live.pilot.speed < 0.01, null, { timeout: 20000 })
await settle()
await page.mouse.move(720, 450)
await page.evaluate(() => document.body.focus())

const pose = () =>
  page.evaluate(() => {
    const c = window.__r3f.camera
    c.updateMatrixWorld()
    const e = c.matrixWorld.elements
    return { p: [c.position.x, c.position.y, c.position.z], right: [e[0], e[1], e[2]], fwd: [-e[8], -e[9], -e[10]], speed: window.__mw.live.pilot.speed, state: window.__mw.live.camState }
  })
const sub = (a, b) => a.map((v, i) => v - b[i])
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)
const len = (a) => Math.hypot(...a)
const flat = (v) => {
  const l = Math.hypot(v[0], v[2]) || 1
  return [v[0] / l, 0, v[2] / l]
}

const venueRoute = route.includes('venue') || route.includes('zone') || route.includes('event')
// the hall is ~430 × 150: short holds keep every measurement clear of its walls
const HOLD = venueRoute ? 650 : 1300
async function hold(keys, ms = HOLD) {
  const a = await pose()
  for (const k of keys) await page.keyboard.down(k)
  await page.waitForTimeout(ms)
  const b = await pose()
  for (const k of keys) await page.keyboard.up(k)
  await page.waitForTimeout(1600)
  const c = await pose()
  const d = sub(b.p, a.p)
  const coast = len(sub(c.p, b.p))
  return { d, dist: len(d), fwd: dot(d, flat(a.fwd)), fwd3: dot(d, a.fwd), right: dot(d, a.right), up: d[1], coast, speedAfter: c.speed }
}

const out = []
const report = (name, ok, detail) => {
  out.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} ${detail}`)
}
const f = (n) => n.toFixed(1)

const venue = venueRoute || route.includes('venue') || route.includes('zone') || route.includes('event')
const home = async () => {
  await page.keyboard.press('KeyR')
  await page.waitForTimeout(2200)
}
for (const [k, axis, sign] of [['KeyW', 'fwd', 1], ['KeyS', 'fwd', -1], ['KeyA', 'right', -1], ['KeyD', 'right', 1], ['KeyE', 'up', 1], ['KeyQ', 'up', -1], ['ArrowUp', 'fwd', 1], ['ArrowDown', 'fwd', -1], ['ArrowLeft', 'right', -1], ['ArrowRight', 'right', 1]]) {
  await home()
  if (k === 'KeyQ') await hold(['KeyE']) // climb first: Q cannot descend through the deck
  const r = await hold([k])
  // in the hall forward follows the floor; in space it is the true 3D look direction
  const along = (axis === 'fwd' && !venue ? r.fwd3 : r[axis]) * sign
  const ok = along > r.dist * 0.9 && r.dist > 1 && r.speedAfter < 0.02
  report(`${k} → ${sign > 0 ? '+' : '−'}${axis}`, ok, `moved ${f(r.dist)} (along ${f(along)}, fwd ${f(r.fwd)} right ${f(r.right)} up ${f(r.up)}), coast ${f(r.coast)}, speed after ${r.speedAfter.toFixed(3)}`)
}

// diagonals never exceed the single-axis speed
await home()
const w = await hold(['KeyW'])
for (const combo of [['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']]) {
  await home()
  const r = await hold(combo)
  report(`${combo.join('+')} speed ≤ single axis`, r.dist <= w.dist * 1.06 && r.dist > w.dist * 0.8, `${f(r.dist)} vs W ${f(w.dist)} (ratio ${(r.dist / w.dist).toFixed(3)})`)
}

// key repeat: auto-repeat keydowns must not accelerate or stack (speed stays at the normal cruise)
{
  await home()
  await page.keyboard.down('KeyW')
  let peak = 0
  for (let i = 0; i < 40; i++) {
    await page.keyboard.down('KeyW') // repeat events
    await page.waitForTimeout(40)
    peak = Math.max(peak, (await pose()).speed)
  }
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(1800)
  const c = await pose()
  report('key repeat does not stack', peak <= 1.02 && peak > 0.9 && c.speed < 0.02, `peak speed ${peak.toFixed(3)} (cruise = 1.0), speed after ${c.speed.toFixed(3)}`)
}

// release: the ship decelerates smoothly (not instantly, not forever)
{
  await home()
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(HOLD)
  await page.keyboard.up('KeyD')
  const s0 = (await pose()).speed
  await page.waitForTimeout(250)
  const s1 = (await pose()).speed
  await page.waitForTimeout(1500)
  const s2 = (await pose()).speed
  report('release decelerates smoothly', s1 < s0 && s1 > 0.02 && s2 < 0.02, `speed ${s0.toFixed(2)} → ${s1.toFixed(2)} (250 ms) → ${s2.toFixed(3)} (1.75 s)`)
}

// stuck keys: blur, hidden tab, focus in a field, ⌘ held
for (const [name, act] of [
  ['window blur releases keys', () => page.evaluate(() => window.dispatchEvent(new Event('blur')))],
  [
    'hidden tab releases keys',
    () =>
      page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
        Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      }),
  ],
  [
    'focus into a form field releases keys',
    () =>
      page.evaluate(() => {
        const i = document.createElement('input')
        i.id = 'qa-field'
        document.body.appendChild(i)
        i.focus()
      }),
  ],
  ['⌘ keyup releases keys (macOS)', async () => {
    await page.keyboard.down('Meta')
    await page.keyboard.up('Meta')
  }],
]) {
  await page.evaluate(() => document.getElementById('qa-field')?.remove())
  await page.evaluate(() => document.body.focus())
  await home()
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(700)
  await act()
  await page.waitForTimeout(1800)
  const s = (await pose()).speed
  await page.keyboard.up('KeyD')
  report(name, s < 0.02, `speed ${s.toFixed(3)} after 1.8 s`)
}

// typing in a field never flies the ship
{
  await settle()
  await page.evaluate(() => {
    const i = document.createElement('input')
    i.id = 'qa-type'
    document.body.appendChild(i)
    i.focus()
  })
  const a = await pose()
  await page.keyboard.type('wasdqe', { delay: 60 })
  await page.waitForTimeout(600)
  const b = await pose()
  const typed = await page.evaluate(() => document.getElementById('qa-type').value)
  await page.evaluate(() => document.getElementById('qa-type').remove())
  report('typing in a field does not move', len(sub(b.p, a.p)) < 0.5 && typed === 'wasdqe', `moved ${f(len(sub(b.p, a.p)))}, field got "${typed}"`)
}

// mouse + keyboard together (from the start position: earlier tests may have parked us at a wall)
{
  await page.evaluate(() => document.body.focus())
  await page.keyboard.press('KeyR')
  await page.waitForTimeout(2500)
  const a = await pose()
  await page.keyboard.down('KeyW')
  for (let i = 0; i < 12; i++) await page.mouse.move(700 + i * 8, 440 + i * 3, { steps: 2 })
  await page.waitForTimeout(600)
  const b = await pose()
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(1600)
  report('mouse + keyboard simultaneously', dot(sub(b.p, a.p), venue ? flat(a.fwd) : a.fwd) > 1, `moved ${f(len(sub(b.p, a.p)))}`)
}

// R returns to the exploration orientation
{
  await hold(['KeyD'], 1500)
  await page.keyboard.press('KeyR')
  await page.waitForTimeout(2600)
  const off = await page.evaluate(() => window.__mw.live.pilot.speed)
  report('R glides back', off < 0.02, `speed ${off.toFixed(3)}`)
}

const failed = out.filter((o) => !o.ok).length
console.log(`\n${out.length - failed}/${out.length} passed${venue ? ' (venue level)' : ''}`)
await browser.close()
process.exit(failed ? 1 : 0)
