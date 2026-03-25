#!/usr/bin/env node
/**
 * wechat-dl - 微信公众号图片下载脚本
 * 用法: wechat-dl <url> [关键词]
 *
 * 若不传关键词，自动从文章标题提取
 * 图片保存到 ~/Pictures/openclaw/wechat/
 * 命名格式: YYYYMMDDHHmm_关键词_01.jpg
 */

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_SAVE_DIR = join(homedir(), 'Pictures', 'openclaw', 'wechat');
const ICLOUD_ROOT = join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs');

function parseArgs(argv) {
  const positional = [];
  let useICloud = false;
  let icloudSubdir = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-o-icloud') {
      useICloud = true;
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        icloudSubdir = nextArg;
        i += 1;
      }
      continue;
    }
    positional.push(arg);
  }

  return {
    url: positional[0],
    customKeyword: positional[1],
    saveDir: useICloud ? resolveICloudDir(icloudSubdir) : DEFAULT_SAVE_DIR
  };
}

function resolveICloudDir(input) {
  const cleaned = (input || '')
    .trim()
    .replace(/^icloud\/+/i, '')
    .replace(/^\/+/, '');
  if (!cleaned) {
    return join(ICLOUD_ROOT, 'wechat');
  }
  return join(ICLOUD_ROOT, cleaned);
}

const { url, customKeyword, saveDir } = parseArgs(process.argv.slice(2));

if (!url) {
  console.error('用法: wechat-dl <微信公众号URL> [关键词] [-o-icloud 子目录]');
  process.exit(1);
}

function timestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function extractKeyword(title) {
  const stopWords = ['喜欢','自己','今天','分享','一下','出门','好看','超级','特别','真的','大家','我的','你的','他的'];
  const stopChars = '的了和与或是在有我你他她它们这那也都很最更就还要会能可被把让从对为以到着过来去大小多少一二三个种些之其而但如若不没无非啦呀哦嗯吧呢哈嘿哎';
  let cleaned = title.replace(/[~～！!？?。，,、《》【】「」\s\-_]/g, '');
  stopWords.forEach(w => { cleaned = cleaned.split(w).join(''); });
  const chars = [...cleaned].filter(c => !stopChars.includes(c));
  return chars.slice(0, 6).join('') || cleaned.slice(0, 4) || '未知';
}

async function main() {
  mkdirSync(saveDir, { recursive: true });

  console.log(`🔍 正在打开页面: ${url}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // 滚动到底部，触发懒加载
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  await page.waitForTimeout(1000);

  // 优先取文章标题，而不是浏览器 tab 标题
  const title = await page.$eval('#activity-name', el => el.innerText.trim()).catch(() => '')
    || await page.$eval('.rich_media_title', el => el.innerText.trim()).catch(() => '')
    || await page.$eval('meta[property="og:title"]', el => el.content).catch(() => '')
    || await page.title();
  const keyword = customKeyword || extractKeyword(title);
  console.log(`📰 标题: ${title}`);
  console.log(`🏷  关键词: ${keyword}`);

  // 只抓正文图片：img 标签无 class，优先取 data-src（原始URL，无水印）
  const imgUrls = await page.evaluate(() => {
    // const imgs = document.querySelectorAll('img:not([class]):not(#img_item_placeholder)');
    const imgs = document.querySelectorAll(
      'img:not(#img_item_placeholder):is(:not([class]), [class=""], [class="rich_pages wxw-img"])'
    );
    const all = [];
    imgs.forEach(img => {
      const dataSrc = img.getAttribute('data-src') || '';
      const src = img.src || '';
      // 优先用 data-src，没有再用 src
      const url = dataSrc.includes('mmbiz.qpic.cn') ? dataSrc
                : src.includes('mmbiz.qpic.cn') ? src : '';
      if (url) all.push(url);
    });
    // 按基础路径去重
    const seen = new Set();
    return all.filter(u => {
      const base = u.split('?')[0];
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    });
  });

  if (imgUrls.length === 0) {
    console.log('⚠️  没有找到正文图片');
    await browser.close();
    process.exit(0);
  }

  console.log(`🖼  找到 ${imgUrls.length} 张图片，开始下载...\n`);

  const ts = timestamp();

  for (let i = 0; i < imgUrls.length; i++) {
    const idx = String(i + 1).padStart(2, '0');
    const filename = `${ts}_${keyword}_${idx}.jpg`;
    const savePath = join(saveDir, filename);
    process.stdout.write(`  下载 [${idx}/${imgUrls.length}] ${filename} ... `);
    try {
      // 用 playwright 内置 fetch 下载，自动带 cookie
      const response = await context.request.get(imgUrls[i]);
      const buffer = await response.body();
      writeFileSync(savePath, buffer);
      console.log('✅');
    } catch (e) {
      console.log(`❌ 失败: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n📁 保存目录: ${saveDir}`);
}

main().catch(e => { console.error('❌ 出错:', e.message); process.exit(1); });
