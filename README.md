# ai-scripts

Small personal automation scripts.

## Included

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
```

## Usage

```bash
node wechat-dl.mjs "<wechat-article-url>"
node wechat-dl.mjs "<wechat-article-url>" "<keyword>"
```

Example:

```bash
node wechat-dl.mjs "https://mp.weixin.qq.com/s/xxxxxx"
node wechat-dl.mjs "https://mp.weixin.qq.com/s/xxxxxx" "flowers"
```

## Output

Images are saved to:

```bash
~/Pictures/openclaw/wechat/
```

## Notes

- The script uses `playwright-core`
- It currently targets WeChat article pages only
- The project does not include automated tests yet
