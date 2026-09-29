// Combine screenshots into one contact sheet (uses Chrome to composite; no image deps)
// usage: node scripts/qa/sheet.mjs out.png cols img1 img2 ...
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const [, , out, cols, ...imgs] = process.argv
const b64 = imgs.map((p) => 'data:image/png;base64,' + readFileSync(p).toString('base64'))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">${b64.map((s, i) => `<figure style="margin:0;position:relative"><img src="${s}" style="width:100%;display:block"><figcaption style="position:absolute;left:6px;top:4px;color:#ff7a1a;font:600 14px monospace">${imgs[i].split('/').pop()}</figcaption></figure>`).join('')}</body>`)
await page.waitForTimeout(300)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
