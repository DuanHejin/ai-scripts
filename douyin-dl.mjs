#!/usr/bin/env node
/**
 * douyin-dl - Download a Douyin video from a public video URL.
 *
 * Usage:
 *   node douyin-dl.mjs <douyin-video-url> [filename]
 *
 * Output:
 *   ~/Pictures/openclaw/douyin/<timestamp>_<name>.mp4
 */

import { chromium } from 'playwright-core';
import { homedir } from 'os';
import { basename, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const SAVE_DIR = join(homedir(), 'Pictures', 'openclaw', 'douyin');
const url = process.argv[2];
const customName = process.argv[3];

if (!url) {
  console.error('Usage: node douyin-dl.mjs <douyin-video-url> [filename]');
  process.exit(1);
}

function timestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function sanitizeName(input) {
  return (input || 'douyin-video')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'douyin-video';
}

function cleanTitle(input) {
  const raw = (input || '').trim();
  if (!raw) return '';

  const withoutSite = raw
    .replace(/\s*-\s*抖音$/u, '')
    .replace(/\s*-\s*抖音精选$/u, '')
    .replace(/\s*-\s*Douyin$/u, '');

  const noHashtags = withoutSite
    .replace(/#[^\s#]+/gu, ' ')
    .replace(/（话题）/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const segments = noHashtags
    .split(/\s*[-|｜]\s*/u)
    .map(item => item.trim())
    .filter(Boolean);

  return segments[0] || noHashtags;
}

function pickBestVideoUrl(data) {
  const urls = [];

  function addUrl(value) {
    if (typeof value !== 'string' || !value) return;
    if (!/^https?:\/\//.test(value)) return;
    if (!value.includes('.mp4') && !value.includes('/play/')) return;
    urls.push(value);
  }

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'url' || key === 'src' || key === 'playAddr' || key === 'playApi') {
        addUrl(value);
      }

      if (key === 'url_list' || key === 'urlList') {
        if (Array.isArray(value)) value.forEach(addUrl);
      }

      walk(value);
    }
  }

  walk(data);

  return urls.find(item => item.includes('play')) || urls[0] || '';
}

function filenameFromUrl(videoUrl) {
  try {
    const path = new URL(videoUrl).pathname;
    const name = basename(path).replace(/\.[^.]+$/, '');
    return sanitizeName(name);
  } catch {
    return 'douyin-video';
  }
}

function absoluteUrl(value, base) {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

async function extractFromJson(page) {
  return page.evaluate(() => {
    const candidates = [
      document.querySelector('#RENDER_DATA')?.textContent,
      document.querySelector('#SIGI_STATE')?.textContent,
      document.querySelector('#__NEXT_DATA__')?.textContent
    ].filter(Boolean);

    const decoded = [];
    for (const raw of candidates) {
      try {
        decoded.push(JSON.parse(decodeURIComponent(raw)));
        continue;
      } catch {}

      try {
        decoded.push(JSON.parse(raw));
      } catch {}
    }

    return decoded;
  });
}

async function main() {
  mkdirSync(SAVE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  const networkUrls = new Set();
  page.on('response', response => {
    const responseUrl = response.url();
    if (responseUrl.includes('.mp4') || responseUrl.includes('/play/')) {
      networkUrls.add(responseUrl);
    }
  });

  console.log(`Opening: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(5000);

  const title =
    (await page.title().catch(() => '')) ||
    (await page.locator('title').textContent().catch(() => '')) ||
    'douyin-video';

  const decodedJsonBlocks = await extractFromJson(page);

  let videoUrl = '';
  for (const block of decodedJsonBlocks) {
    videoUrl = pickBestVideoUrl(block);
    if (videoUrl) break;
  }

  if (!videoUrl) {
    const videoSrc = await page.locator('video').first().getAttribute('src').catch(() => '');
    if (videoSrc) videoUrl = videoSrc;
  }

  if (!videoUrl && networkUrls.size > 0) {
    videoUrl = [...networkUrls][0];
  }

  if (!videoUrl) {
    await browser.close();
    throw new Error('Failed to locate a downloadable video URL on the page');
  }

  videoUrl = absoluteUrl(videoUrl, page.url());

  const outputName = sanitizeName(customName || cleanTitle(title) || filenameFromUrl(videoUrl));
  const savePath = join(SAVE_DIR, `${timestamp()}_${outputName}.mp4`);

  console.log(`Video URL found: ${videoUrl}`);
  console.log(`Saving to: ${savePath}`);

  const response = await context.request.get(videoUrl, {
    headers: {
      referer: page.url()
    }
  });

  if (!response.ok()) {
    await browser.close();
    throw new Error(`Download failed with status ${response.status()}`);
  }

  writeFileSync(savePath, await response.body());
  await browser.close();

  console.log(`Saved: ${savePath}`);
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
