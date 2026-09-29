// Flicker meter: captures consecutive rendered frames and measures temporal instability.
// usage: node scripts/qa/flicker.mjs <url> <out-prefix> [w] [h] [frames] [scrollU] [actionsJSON]
//
// Each frame is reduced to 4×4-pixel block means (area average, so a sub-pixel star moving across
// the pixel grid is NOT counted as flicker by the capture itself). A block "spikes" when its
// luminance jumps and then reverses on the next frame by more than a threshold: real motion moves
// in one direction, flicker goes up-down-up. Reports:
//   spikeRate   spikes per block per frame (×1000)          hot%   blocks with ≥3 spikes
//   flashes     frames whose mean luminance jumps >20% and back (whole-frame flashes / black frames)
// and writes <out-prefix>-heat.png: the last frame, dimmed, with hot blocks painted red.
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const [, , url, out, w = '1440', h = '900', frames = '90', vh = '0', actions = '[]'] = process.argv
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: (process.env.GLARGS ?? '--use-angle=metal --enable-gpu --ignore-gpu-blocklist').split(' '),
})
const mobile = +w < 720
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)))
page.on('console', (m) => m.type() === 'error' && errors.push('error: ' + m.text().slice(0, 200)))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__mw?.useWorld.getState().booted, null, { timeout: 45000 }).catch(() => errors.push('boot timeout'))
await page.evaluate(async () => {
  for (let i = 0; i < 60; i++) {
    const b = document.querySelector('.intro__skip')
    if (b) { b.click(); break }
    if (window.__mw?.useWorld.getState().introDone) break
    await new Promise((r) => setTimeout(r, 150))
  }
})
await page.waitForFunction(() => window.__mw?.useWorld.getState().ready, null, { timeout: 30000 }).catch(() => errors.push('ready timeout'))
await page.waitForTimeout(1500)
if (+vh)
  await page.evaluate((v) => {
    const secs = [...document.querySelectorAll('[data-journey] > section[data-u]')]
    let y = 0
    for (const s of secs) {
      const u = +s.dataset.u
      const hh = +s.dataset.h
      if (v >= u) y = s.offsetTop + Math.min(1, (v - u) / hh) * s.offsetHeight
    }
    window.scrollTo(0, y)
  }, +vh)
for (const a of JSON.parse(actions)) {
  if (a.eval) await page.evaluate(a.eval)
  if (a.hover) await page.mouse.move(a.hover[0], a.hover[1], { steps: 8 })
  if (a.down) await page.keyboard.down(a.down)
  if (a.up) await page.keyboard.up(a.up)
  if (a.key) await page.keyboard.press(a.key)
  if (a.wait) await page.waitForTimeout(a.wait)
}
await page.waitForTimeout(+(process.env.SETTLE ?? 2500))
// motion during capture: SCROLL=<px per frame> scrolls the journey steadily; KEY=<code> holds a key
if (process.env.SCROLL)
  await page.evaluate((px) => {
    const loop = () => {
      window.scrollBy(0, px)
      window.__mwScroll = requestAnimationFrame(loop)
    }
    loop()
  }, +process.env.SCROLL)
if (process.env.KEY) {
  await page.keyboard.down(process.env.KEY)
  await page.waitForTimeout(900) // let the ship reach cruise before measuring
}

// mid-capture actions: ACT='js' (e.g. click a route link) or RESIZE=WxH, fired after ACT_AFTER ms
if (process.env.ACT || process.env.RESIZE)
  setTimeout(async () => {
    if (process.env.ACT) await page.evaluate(process.env.ACT).catch(() => {})
    if (process.env.RESIZE) {
      const [rw, rh] = process.env.RESIZE.split('x').map(Number)
      await page.setViewportSize({ width: rw, height: rh })
    }
  }, +(process.env.ACT_AFTER ?? 400))
const res = await page.evaluate(async ({ N, holdKey }) => {
  const src = document.querySelector('.world-canvas canvas') ?? document.querySelector('canvas')
  const W = src.width
  const H = src.height
  const B = 4
  const bw = Math.floor(W / B)
  const bh = Math.floor(H / B)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })
  const series = []
  const means = []
  const times = []
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
  for (let f = 0; f < N; f++) {
    await frame()
    g.drawImage(src, 0, 0, W, H)
    const d = g.getImageData(0, 0, W, H).data
    const y = new Float32Array(bw * bh)
    let sum = 0
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        let acc = 0
        for (let j = 0; j < B; j++) {
          let o = ((by * B + j) * W + bx * B) * 4
          for (let i = 0; i < B; i++, o += 4) acc += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]
        }
        const v = acc / (B * B)
        y[by * bw + bx] = v
        sum += v
      }
    series.push(y)
    means.push(sum / (bw * bh))
    times.push(performance.now())
  }
  const TH = 6
  const spikes = new Uint16Array(bw * bh)
  let total = 0
  for (let f = 1; f < N - 1; f++) {
    const a = series[f - 1]
    const b = series[f]
    const n = series[f + 1]
    for (let i = 0; i < a.length; i++) {
      const d1 = b[i] - a[i]
      const d2 = n[i] - b[i]
      if (d1 * d2 < 0 && Math.min(Math.abs(d1), Math.abs(d2)) > TH) {
        spikes[i]++
        total++
      }
    }
  }
  let hot = 0
  for (const s of spikes) if (s >= 3) hot++
  let flashes = 0
  for (let f = 1; f < N - 1; f++) {
    const m = (means[f - 1] + means[f + 1]) / 2
    if (m > 2 && Math.abs(means[f] - m) / m > 0.2) flashes++
  }
  // heatmap over the last frame
  const img = g.getImageData(0, 0, W, H)
  const px = img.data
  for (let i = 0; i < px.length; i += 4) {
    px[i] *= 0.45
    px[i + 1] *= 0.45
    px[i + 2] *= 0.45
  }
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      const s = spikes[by * bw + bx]
      if (!s) continue
      const k = Math.min(1, s / 8)
      for (let j = 0; j < B; j++)
        for (let i = 0; i < B; i++) {
          const o = ((by * B + j) * W + bx * B + i) * 4
          px[o] = 255 * (0.35 + 0.65 * k)
          px[o + 1] = px[o + 1] * (1 - k)
          px[o + 2] = px[o + 2] * (1 - k)
        }
    }
  g.putImageData(img, 0, 0)
  const st = window.__mw.useWorld.getState()
  const dt = (times[times.length - 1] - times[0]) / (N - 1)
  return {
    spikeRate: +((total / (bw * bh * (N - 2))) * 1000).toFixed(3),
    hotPct: +((hot / (bw * bh)) * 100).toFixed(2),
    flashes,
    meanLum: +(means.reduce((a, b) => a + b, 0) / N).toFixed(1),
    captureMs: +dt.toFixed(1),
    tier: st.tier,
    dpr: window.__mw.stats?.dpr,
    cam: window.__mw.live.camState + ' ' + window.__mw.live.camView,
    heat: c.toDataURL('image/png'),
  }
}, { N: +frames })
if (process.env.KEY) await page.keyboard.up(process.env.KEY)
writeFileSync(`${out}-heat.png`, Buffer.from(res.heat.split(',')[1], 'base64'))
delete res.heat
console.log(JSON.stringify({ out, ...res, errors: errors.filter((e) => !/DevTools|Context Lost/.test(e)).slice(0, 5) }))
await browser.close()
