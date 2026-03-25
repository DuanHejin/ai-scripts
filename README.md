# ai-scripts

Small personal automation scripts.

## Included

### `bilibili-dl.mjs`

Download a public Bilibili video from a video page URL.

Features:

- Opens the video page and extracts play info from page state
- Downloads the highest-bitrate stream exposed to the current page session
- Saves to `~/Pictures/openclaw/bilibili/`
- If `ffmpeg` is installed, merges separate video and audio streams automatically
- Cleans the page title to avoid the `_哔哩哔哩_bilibili` suffix in filenames
- Supports logged-in downloads through the `BILIBILI_COOKIE` environment variable

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
- `ffmpeg` if you want Bilibili video and audio streams merged into a single MP4

## Install

```bash
npm install
npm link
```

For Bilibili merged MP4 output:

```bash
brew install ffmpeg
```

After `npm link`, you can run the commands directly from anywhere:

```bash
bilibili-dl "<bilibili-video-url>"
douyin-dl "<douyin-video-url>"
wechat-dl "<wechat-article-url>"
```

## Usage

```bash
bilibili-dl "<bilibili-video-url>"
bilibili-dl "<bilibili-video-url>" "<filename>"
bilibili-dl "<bilibili-video-url>" -o-icloud "icloud/bilibili"
douyin-dl "<douyin-video-url>"
douyin-dl "<douyin-video-url>" "<filename>"
douyin-dl "<douyin-video-url>" -o-icloud "icloud/douyin"
wechat-dl "<wechat-article-url>"
wechat-dl "<wechat-article-url>" "<keyword>"
wechat-dl "<wechat-article-url>" "flowers" -o-icloud "icloud/wechat"
```

For higher Bilibili qualities that require login:

```bash
export BILIBILI_COOKIE='SESSDATA=...; bili_jct=...; DedeUserID=...'
bilibili-dl "https://www.bilibili.com/video/BVxxxxxxxxxx"
```

How to get the Bilibili cookie safely:

1. Open a Bilibili video page in Chrome or Edge while logged in.
2. Open DevTools with `F12` or `Cmd+Option+I`.
3. Go to `Network` and refresh the page.
4. Click the main document request for `www.bilibili.com/video/...`.
5. In `Request Headers`, copy the full `cookie` header value.
6. Use it only in your local shell session:

```bash
export BILIBILI_COOKIE='SESSDATA=...; bili_jct=...; DedeUserID=...; DedeUserID__ckMd5=...'
```

Or run a single command without exporting permanently:

```bash
BILIBILI_COOKIE='SESSDATA=...; bili_jct=...; DedeUserID=...' bilibili-dl "https://www.bilibili.com/video/BVxxxxxxxxxx"
```

To save directly into iCloud Drive, pass `-o-icloud <subdir>`. The value is resolved under:

```bash
~/Library/Mobile Documents/com~apple~CloudDocs/
```

Examples:

```bash
wechat-dl "https://mp.weixin.qq.com/s/xxxxxx" -o-icloud
wechat-dl "https://mp.weixin.qq.com/s/xxxxxx" -o-icloud "icloud/wechat"
douyin-dl "https://www.douyin.com/video/7583932066951204145" -o-icloud
douyin-dl "https://www.douyin.com/video/7583932066951204145" -o-icloud "icloud/douyin"
bilibili-dl "https://www.bilibili.com/video/BVxxxxxxxxxx" -o-icloud
bilibili-dl "https://www.bilibili.com/video/BVxxxxxxxxxx" -o-icloud "icloud/bilibili"
```

The `icloud/` prefix in the subdirectory is optional. These two are equivalent:

```bash
-o-icloud "icloud/wechat"
-o-icloud "wechat"
```

If you pass `-o-icloud` without a subdirectory, each script uses its own default iCloud folder:

```bash
wechat-dl  -> ~/Library/Mobile Documents/com~apple~CloudDocs/wechat
douyin-dl  -> ~/Library/Mobile Documents/com~apple~CloudDocs/douyin
bilibili-dl -> ~/Library/Mobile Documents/com~apple~CloudDocs/bilibili
```

Example:

```bash
bilibili-dl "https://www.bilibili.com/video/BVxxxxxxxxxx"
bilibili-dl "https://www.bilibili.com/video/BVxxxxxxxxxx" "my-video"
douyin-dl "https://www.douyin.com/video/7583932066951204145"
douyin-dl "https://www.douyin.com/video/7583932066951204145" "altay-trip"
wechat-dl "https://mp.weixin.qq.com/s/xxxxxx"
wechat-dl "https://mp.weixin.qq.com/s/xxxxxx" "flowers"
```

## Output

Bilibili videos are saved to:

```bash
~/Pictures/openclaw/bilibili/
```

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
- Bilibili downloads use the highest quality exposed on the page, which may still depend on login state, membership access, and source availability
- To access 1080p or higher when Bilibili restricts anonymous playback, provide your logged-in browser cookie through `BILIBILI_COOKIE`
- It currently targets WeChat article pages only
- The project does not include automated tests yet
