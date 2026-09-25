import { mkdir } from "node:fs/promises";
import { type Browser, chromium, type Page } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUTPUT_DIR = "docs";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const;

interface Shot {
  name: string;
  path: string;
  prepare?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  { name: "workspace", path: "/workspace" },
  {
    name: "feedback",
    path: "/feedback",
    prepare: async (page) => {
      await page.getByRole("button", { name: /^01/ }).click();
      await page.getByRole("table").waitFor();
    },
  },
  { name: "impact", path: "/impact" },
];

async function capture(browser: Browser, shot: Shot) {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "networkidle" });
    await shot.prepare?.(page);
    await page.screenshot({
      path: `${OUTPUT_DIR}/${shot.name}-${viewport.name}.png`,
      fullPage: viewport.name === "mobile",
    });
    await page.close();
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "chrome",
  });
  try {
    for (const shot of SHOTS) await capture(browser, shot);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Screenshot run failed: ${String(error)}\n`);
  process.exit(1);
});
