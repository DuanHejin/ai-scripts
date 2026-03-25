# ai-scripts

Small personal automation scripts.

## Included

### `douyin-dl.mjs`

Download a public Douyin video from a video page URL.

Features:

- Opens the video page in a browser context
- Extracts the playable video URL from page data or network traffic
- Downloads the video to `~/Pictures/openclaw/douyin/`
- Supports an optional custom output name
- Cleans page titles to avoid hashtags and overly long filenames

### `wechat-dl.mjs`

Download article images from a WeChat Official Account post.

Features:

- Opens the article with a mobile user agent
- Scrolls the page to trigger lazy-loaded images
- Extracts image URLs from article content
- Downloads images to `~/Pictures/openclaw/wechat/`
- Auto-generates filenames like `YYYYMMDDHHmm_keyword_01.jpg`

## Requirements

- Node.js
- `npm install`

## Install

```bash
npm install
npm link
```

After `npm link`, you can run the commands directly from anywhere:

```bash
douyin-dl "<douyin-video-url>"
wechat-dl "<wechat-article-url>"
```

## Usage

```bash
douyin-dl "<douyin-video-url>"
douyin-dl "<douyin-video-url>" "<filename>"
wechat-dl "<wechat-article-url>"
wechat-dl "<wechat-article-url>" "<keyword>"
```

Example:

```bash
douyin-dl "https://www.douyin.com/video/7583932066951204145"
douyin-dl "https://www.douyin.com/video/7583932066951204145" "altay-trip"
wechat-dl "https://mp.weixin.qq.com/s/xxxxxx"
wechat-dl "https://mp.weixin.qq.com/s/xxxxxx" "flowers"
```

## Output

Douyin videos are saved to:

```bash
~/Pictures/openclaw/douyin/
```

Images are saved to:

```bash
~/Pictures/openclaw/wechat/
```

## Notes

- The script uses `playwright-core`
- It currently targets WeChat article pages only
- The project does not include automated tests yet
