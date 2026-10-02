// Screenshot each tab at a few widths: node scripts/shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4173'
const out = process.argv[3] ?? 'shots'
const widths = (process.env.WIDTHS ?? '390,1280').split(',').map(Number)
const tabs = (process.env.TABS ?? 'STAT,INV,DATA,MAP,RADIO').split(',')

const browser = await chromium.launch(
  process.env.CI ? {} : { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' },
)
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 700 ? 844 : 800 } })
  page.on('console', (m) => m.type() === 'error' && console.log(`[${w}] console:`, m.text()))
  page.on('pageerror', (e) => console.log(`[${w}] pageerror:`, e.message))
  await page.goto(base)
  await page.keyboard.press('Space') // skip boot
  await page.waitForSelector('.top-tabs')
  for (const t of tabs) {
    await page.click(`#tab-${t}`)
    if (process.env.SUB) await page.click(`.sub-tab:text-is("${process.env.SUB}")`)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${out}/${w}-${t}${process.env.SUB ? '-' + process.env.SUB : ''}.png` })
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  if (overflow) console.log(`[${w}] horizontal overflow!`)
  await page.close()
}
await browser.close()
