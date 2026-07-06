// captura genérica BO: node cap-ab.tmp.mjs <base> <hash> <outfile> [w] [selector-scroll]
import puppeteer from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
const [,, base, hash, out, wRaw, sel] = process.argv;
const W = Number(wRaw || 390);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prisma = new PrismaClient();
const token = 'cap-' + crypto.randomBytes(12).toString('hex');
await prisma.authSession.create({ data: { merchantId: 1, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
await prisma.$disconnect();
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--disable-gpu', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: W < 700 ? 844 : 950, deviceScaleFactor: W < 700 ? 2 : 1 });
await page.goto(`${base}/auth/verify?token=${token}`, { waitUntil: 'networkidle2', timeout: 45000 });
await page.goto(`${base}/dashboard/#${hash}`, { waitUntil: 'networkidle2', timeout: 45000 });
const ready = process.env.CAP_READY || '';
if (ready) {
  for (let i = 0; i < 50; i++) {
    const ok = await page.evaluate((r) => !!document.querySelector(r), ready);
    if (ok) break;
    await sleep(400);
  }
  await sleep(600);
} else { await sleep(3200); }
if (sel) { await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel); await sleep(400); }
await page.screenshot({ path: out, fullPage: W < 700 });
await browser.close();
console.log('shot', out);
