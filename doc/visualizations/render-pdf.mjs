import { chromium } from '/Users/mz/研究自動化Multi-agent/paperclip/node_modules/.pnpm/playwright-core@1.58.2/node_modules/playwright-core/index.mjs';
import { execSync } from 'node:child_process';

const url = process.argv[2] ?? 'http://localhost:8765/dl-research-overview.html';
const out = process.argv[3] ?? '/Users/mz/研究自動化Multi-agent/paperclip/doc/visualizations/dl-research-overview.pdf';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
// give web fonts time to settle
await page.waitForTimeout(800);

// Measure full content height of .poster (the "1-page" canvas)
const { width, height } = await page.evaluate(() => {
  const el = document.querySelector('.poster');
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
});
console.log(`measured poster: ${Math.round(width)} x ${Math.round(height)} px`);

// Add a small margin around the poster in the PDF, then size paper exactly to fit
const PAD = 24; // px, equal to body padding intent
const paperWidthPx = Math.ceil(width + PAD * 2);
const paperHeightPx = Math.ceil(height + PAD * 2);

// Convert px (CSS) to inches: 96px = 1in
const inW = paperWidthPx / 96;
const inH = paperHeightPx / 96;

await page.pdf({
  path: out,
  printBackground: true,
  preferCSSPageSize: false,
  width: `${inW}in`,
  height: `${inH}in`,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
  pageRanges: '1',
});

console.log(`PDF: ${out} @ ${inW.toFixed(2)}in x ${inH.toFixed(2)}in`);
await browser.close();

try {
  const meta = execSync(`mdls -name kMDItemNumberOfPages -name kMDItemPageHeight -name kMDItemPageWidth "${out}"`).toString();
  console.log(meta.trim());
} catch {}
