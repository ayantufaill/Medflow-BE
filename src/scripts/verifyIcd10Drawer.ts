import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { prisma } from '../config/db';
import { icd10CodeService } from '../services/icd10-code.service';

async function main() {
  if (!process.argv[2]) throw new Error('Pass the browser driver module exporting puppeteer as the first argument');
  const { puppeteer } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  const errors: string[] = [];
  const searches: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setRequestInterception(true);
  page.on('request', async (request: any) => {
    if (!request.url().includes('/api/icd10-codes')) { await request.continue(); return; }
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') { await request.respond({ status: 200, headers, body: '{}' }); return; }
    try {
      const url = new URL(request.url());
      const search = url.searchParams.get('search') || '';
      searches.push(search);
      const result = await icd10CodeService.list({ search, code: url.searchParams.get('code') || undefined });
      await request.respond({ status: 200, headers, body: JSON.stringify(result) });
    } catch (error: any) { await request.respond({ status: 500, headers, body: JSON.stringify({ message: error.message }) }); }
  });
  try {
    const url = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/scripts/icd10-drawer-smoke.html';
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    const selector = 'input[placeholder="Search ICD code or description"]';
    await page.waitForFunction((selector: string) => (document.querySelector(selector) as HTMLInputElement)?.value.includes('Dependence on other enabling'), {}, selector);
    const input = await page.$(selector);
    await input.click({ clickCount: 3 });
    await input.press('Backspace');
    await input.type('K029');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="option"]')].some(option => option.textContent?.includes('Dental caries, unspecified')));
    await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].find(option => option.textContent?.includes('Dental caries, unspecified'))?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForFunction((selector: string) => (document.querySelector(selector) as HTMLInputElement)?.value.startsWith('K02.9'), {}, selector);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Save')?.click());
    await page.waitForFunction(() => document.querySelector('[data-testid="saved-icd"]')?.textContent === 'K02.9');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction((selector: string) => (document.querySelector(selector) as HTMLInputElement)?.value.includes('Dental caries, unspecified'), {}, selector);
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/icd10-drawer.png', fullPage: true });
    const clear = await page.$('button[title="Clear"]');
    if (!clear) throw new Error('ICD clear action missing');
    await clear.click();
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Save')?.click());
    await page.waitForFunction(() => document.querySelector('[data-testid="saved-icd"]')?.textContent === 'cleared');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction((selector: string) => (document.querySelector(selector) as HTMLInputElement)?.value === '', {}, selector);
    if (errors.length) throw new Error(errors.join('; '));
    if (!searches.includes('K029')) throw new Error('Server search was not requested');
    console.log(JSON.stringify({ result: 'passed', catalogue: 'live local database', checks: ['saved selection outside first page', 'undotted code search', 'select', 'fixture save and reload', 'clear and reload', 'no browser errors'], screenshot: 'artifacts/icd10-drawer.png' }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
