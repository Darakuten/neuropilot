import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, "neuropilot-demo.html");
const outMp4 = path.join(__dirname, "neuropilot-demo.mp4");
const outGif = path.join(__dirname, "neuropilot-demo.gif");
const framesDir = path.join(__dirname, "frames");

const FPS = 20;
const DURATION_MS = 25000;
const FRAME_COUNT = Math.ceil((DURATION_MS / 1000) * FPS);
const VIEWPORT = { width: 1280, height: 720 };

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

rmrf(framesDir);
fs.mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

console.log(`Capturing ${FRAME_COUNT} frames @ ${FPS}fps (${DURATION_MS}ms)...`);

for (let i = 0; i < FRAME_COUNT; i++) {
  const ms = Math.round((i / FRAME_COUNT) * DURATION_MS);
  await page.evaluate((t) => window.__seek(t), ms);
  const framePath = path.join(framesDir, `frame_${String(i).padStart(5, "0")}.png`);
  await page.screenshot({ path: framePath, type: "png" });
  if (i % 50 === 0) console.log(`  frame ${i}/${FRAME_COUNT} (${ms}ms)`);
}

await browser.close();

const framePattern = path.join(framesDir, "frame_%05d.png");

console.log("Encoding MP4...");
execSync(
  `ffmpeg -y -framerate ${FPS} -i "${framePattern}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${outMp4}"`,
  { stdio: "inherit" },
);

console.log("Encoding GIF (960px, palette optimized)...");
const palettePath = path.join(framesDir, "palette.png");
execSync(
  `ffmpeg -y -framerate ${FPS} -i "${framePattern}" -vf "fps=${FPS},scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" "${palettePath}"`,
  { stdio: "inherit" },
);
execSync(
  `ffmpeg -y -framerate ${FPS} -i "${framePattern}" -i "${palettePath}" -lavfi "fps=${FPS},scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" "${outGif}"`,
  { stdio: "inherit" },
);

rmrf(framesDir);

const mp4Size = (fs.statSync(outMp4).size / 1024 / 1024).toFixed(2);
const gifSize = (fs.statSync(outGif).size / 1024 / 1024).toFixed(2);
console.log(`Done.\n  MP4: ${outMp4} (${mp4Size} MB)\n  GIF: ${outGif} (${gifSize} MB)`);
