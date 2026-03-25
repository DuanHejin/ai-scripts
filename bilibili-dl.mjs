#!/usr/bin/env node
/**
 * bilibili-dl - Download a public Bilibili video from a video page URL.
 *
 * Usage:
 *   bilibili-dl <bilibili-video-url> [filename]
 *
 * Output:
 *   ~/Pictures/openclaw/bilibili/<timestamp>_<name>.mp4
 */

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

const SAVE_DIR = join(homedir(), 'Pictures', 'openclaw', 'bilibili');
const url = process.argv[2];
const customName = process.argv[3];
const cookieHeader = process.env.BILIBILI_COOKIE || '';

if (!url) {
  console.error('Usage: bilibili-dl <bilibili-video-url> [filename]');
  process.exit(1);
}

function timestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function sanitizeName(input) {
  return (input || 'bilibili-video')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'bilibili-video';
}

function cleanTitle(input) {
  const raw = (input || '').trim();
  if (!raw) return '';

  return raw
    .replace(/\s*[_-]\s*哔哩哔哩\s*[_-]?\s*bilibili\s*$/iu, '')
    .replace(/\s*[_-]\s*bilibili\s*$/iu, '')
    .replace(/\s*[_-]\s*哔哩哔哩\s*$/u, '')
    .trim();
}

function resolvePlayInfo(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickStreams(playInfo) {
  const data = playInfo?.data || playInfo?.result || playInfo;
  if (!data) return {};

  if (Array.isArray(data.durl) && data.durl.length > 0) {
    return {
      videoUrl: data.durl[0].url,
      audioUrl: '',
      container: 'mp4',
      width: data.durl[0].width || 0,
      height: data.durl[0].height || 0,
      bandwidth: 0,
      codecs: ''
    };
  }

  const videoList = data.dash?.video || [];
  const audioList = data.dash?.audio || [];
  const bestVideo = [...videoList].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
  const bestAudio = [...audioList].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];

  return {
    videoUrl: bestVideo?.baseUrl || bestVideo?.base_url || '',
    audioUrl: bestAudio?.baseUrl || bestAudio?.base_url || '',
    container: 'dash',
    width: bestVideo?.width || 0,
    height: bestVideo?.height || 0,
    bandwidth: bestVideo?.bandwidth || 0,
    codecs: bestVideo?.codecs || ''
  };
}

function hasFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return result.status === 0;
}

function parseCookies(rawCookie, pageUrl) {
  if (!rawCookie.trim()) return [];

  const { hostname } = new URL(pageUrl);
  return rawCookie
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const index = item.indexOf('=');
      if (index <= 0) return null;
      const name = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();
      if (!name) return null;
      return {
        name,
        value,
        domain: hostname,
        path: '/'
      };
    })
    .filter(Boolean);
}

async function downloadBuffer(request, targetUrl, referer, rawCookie) {
  const response = await request.get(targetUrl, {
    headers: {
      referer,
      origin: 'https://www.bilibili.com',
      ...(rawCookie ? { cookie: rawCookie } : {})
    }
  });

  if (!response.ok()) {
    throw new Error(`Download failed with status ${response.status()} for ${targetUrl}`);
  }

  return response.body();
}

async function main() {
  mkdirSync(SAVE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  if (cookieHeader) {
    await context.addCookies(parseCookies(cookieHeader, url));
  }

  const page = await context.newPage();

  console.log(`Opening: ${url}`);
  if (cookieHeader) {
    console.log('Using Bilibili login cookie from BILIBILI_COOKIE');
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);

  const pageData = await page.evaluate(() => ({
    title:
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('title')?.textContent ||
      document.title ||
      '',
    playinfo: window.__playinfo__ || window.__INITIAL_STATE__?.videoData?.pages?.[0]?.playinfo || null
  }));

  let playInfo = resolvePlayInfo(pageData.playinfo);

  if (!playInfo) {
    const html = await page.content();
    const match = html.match(/<script>\s*window\.__playinfo__\s*=\s*([\s\S]*?)<\/script>/);
    if (match?.[1]) playInfo = resolvePlayInfo(match[1]);
  }

  if (!playInfo) {
    await browser.close();
    throw new Error('Failed to locate Bilibili play info on the page');
  }

  const { videoUrl, audioUrl, container, width, height, bandwidth, codecs } = pickStreams(playInfo);
  if (!videoUrl) {
    await browser.close();
    throw new Error('Failed to locate a downloadable video stream');
  }

  const outputBase = `${timestamp()}_${sanitizeName(customName || cleanTitle(pageData.title))}`;
  const finalPath = join(SAVE_DIR, `${outputBase}.mp4`);

  console.log(`Title: ${pageData.title}`);
  console.log(
    `Stream: ${container}${width && height ? ` ${width}x${height}` : ''}${
      bandwidth ? ` ${(bandwidth / 1000).toFixed(0)}kbps` : ''
    }${codecs ? ` ${codecs}` : ''}`
  );

  const videoBuffer = await downloadBuffer(context.request, videoUrl, page.url(), cookieHeader);

  if (!audioUrl) {
    writeFileSync(finalPath, videoBuffer);
    await browser.close();
    console.log(`Saved: ${finalPath}`);
    return;
  }

  const audioBuffer = await downloadBuffer(context.request, audioUrl, page.url(), cookieHeader);
  const tempVideoPath = join(SAVE_DIR, `${outputBase}.video.m4s`);
  const tempAudioPath = join(SAVE_DIR, `${outputBase}.audio.m4s`);
  writeFileSync(tempVideoPath, videoBuffer);
  writeFileSync(tempAudioPath, audioBuffer);

  if (!hasFfmpeg()) {
    await browser.close();
    console.log(`Saved video stream: ${tempVideoPath}`);
    console.log(`Saved audio stream: ${tempAudioPath}`);
    console.log('ffmpeg not found, so streams were not merged.');
    return;
  }

  const merge = spawnSync(
    'ffmpeg',
    ['-y', '-i', tempVideoPath, '-i', tempAudioPath, '-c', 'copy', finalPath],
    { stdio: 'ignore' }
  );

  await browser.close();

  if (merge.status !== 0 || !existsSync(finalPath)) {
    throw new Error('ffmpeg merge failed');
  }

  unlinkSync(tempVideoPath);
  unlinkSync(tempAudioPath);
  console.log(`Saved: ${finalPath}`);
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
