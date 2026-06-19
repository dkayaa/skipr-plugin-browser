# Skipr-plugin

A browser extension that auto-skips segments of YouTube videos based on timestamps from a backend server.

One codebase, one `skipr-plugin/` folder — load the same build in **Firefox** and **Chrome** (Manifest V3).

**Backend:** [skipr-youtube-api](https://github.com/dkayaa/skipr-youtube-api) — Flask API, ML pipeline, and timestamp storage.

## How it works

1. By default the extension uses a baked-in API URL (`config.js`). Optionally override it under **Advanced** in the popup.
2. On `youtube.com/watch` pages, the content script fetches skip ranges for the current video:
   ```
   GET {server}/api/v2/timestamps?link={youtube_watch_url}
   ```
3. While the video plays, if the current time falls inside a `[start_time, end_time]` range, playback jumps to `end_time`.

### API response

**Pending** (analysis running) — HTTP 202:

```json
{ "status": "pending" }
```

The extension polls the same URL every 3s until analysis finishes.

**Ready** (cached or complete) — HTTP 200:

```json
{
  "status": "ready",
  "intervals": [
    { "id": 1, "start_time": 236, "end_time": 312, "orgs": ["David", "Eight Sleep"] }
  ]
}
```

Skip logic uses `start_time` and `end_time` from each interval (seconds).

**Failed** — e.g. transcript unavailable:

```json
{ "status": "failed", "error": "Failed to fetch transcript for video ..." }
```

The extension logs the error and does not poll. Click **Try again** in the popup to re-request analysis (`retry=1` query param); pending polls after that omit `retry`.

## Project structure

```
skipr-plugin/
├── skipr-plugin/           # Load this folder as an unpacked extension (Firefox + Chrome)
│   ├── manifest.json       # Manifest V3
│   ├── config.js           # Default API base URL
│   ├── ext.js              # Cross-browser API shim (browser / chrome)
│   ├── processor.js        # Content script — fetch timestamps, skip segments
│   ├── popup.html          # Settings UI
│   ├── popup.js            # Save/load settings to storage
│   └── icons/              # Extension icons
├── scripts/
│   └── generate_icons.py   # Regenerate PNGs from icons/icon.svg
├── .cursor/rules/          # Cursor agent conventions
└── README.md
```

The `skipr-plugin/` directory is the extension root. No separate Chrome repo or build step — both browsers load the same files.

## Development setup

### Prerequisites

- Firefox 109+ and/or Chrome (current)
- A running [skipr-youtube-api](https://github.com/dkayaa/skipr-youtube-api) backend that exposes `GET /api/v2/timestamps`

### Load unpacked (Firefox)

1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**
2. Select `skipr-plugin/manifest.json`

### Load unpacked (Chrome)

1. Open `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `skipr-plugin/` folder

### Configure

1. Click the Skipr-plugin toolbar icon
2. Open **Advanced** only if you need a custom API server (default is in `config.js`)
3. Open a YouTube video and check the browser console for `[Skipr]` logs

### Cross-browser dev workflow

After any change:

1. Reload the extension in **both** browsers' extension managers
2. Refresh open YouTube tabs (content scripts do not hot-reload)

## CI

GitHub Actions runs on push/PR to `main`:

- **ESLint** — JS lint for `skipr-plugin/`
- **addons-linter** — manifest validation and WebExtension static analysis (MV3 service worker enabled)

Run locally:

```bash
npm ci
npm run ci
```

## Making changes

| Change type | Files to edit |
|-------------|---------------|
| Skip logic, API calls, URL detection | `skipr-plugin/processor.js` |
| Settings UI | `skipr-plugin/popup.html`, `skipr-plugin/popup.js` |
| Default API URL | `skipr-plugin/config.js` |
| Cross-browser extension APIs | `skipr-plugin/ext.js` |
| Permissions, content script matches, icons | `skipr-plugin/manifest.json` |

## Permissions

- `host_permissions` — fetch timestamps from the configured API server (see `manifest.json`)
- `storage` — persist settings via `storage.sync`

## Notes

- **Manifest V3** — supported by Firefox 109+ and Chrome.
- **Firefox add-on ID** — set in `browser_specific_settings.gecko`; Chrome ignores this field.
- **Icons** — regenerate with `python3 scripts/generate_icons.py` after editing `skipr-plugin/icons/icon.svg`.
- **Logging prefix** — console messages use `[Skipr]`.

## License

Not specified.
