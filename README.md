# Skippy

A browser extension that auto-skips segments of YouTube videos based on timestamps from a backend server.

One codebase, one `plugin/` folder — load the same build in **Firefox** and **Chrome** (Manifest V3).

## How it works

1. You configure a **server base URL** in the extension popup (e.g. `https://api.example.com`).
2. On `youtube.com/watch` pages, the content script fetches skip ranges for the current video:
   ```
   GET {server}/api/v2/timestamps?link={youtube_watch_url}
   ```
3. While the video plays, if the current time falls inside a `[start_time, end_time]` range, playback jumps to `end_time`.

Expected API response: JSON array of objects with `start_time` and `end_time` (seconds).

## Project structure

```
skippy-plugin/
├── plugin/                 # Load this folder as an unpacked extension (Firefox + Chrome)
│   ├── manifest.json       # Manifest V3
│   ├── ext.js              # Cross-browser API shim (browser / chrome)
│   ├── processor.js        # Content script — fetch timestamps, skip segments
│   ├── popup.html          # Settings UI
│   ├── popup.js            # Save/load server URL to storage
│   └── icons/              # Extension icons (48px required)
├── .cursor/rules/          # Cursor agent conventions
└── README.md
```

The `plugin/` directory is the extension root. No separate Chrome repo or build step — both browsers load the same files.

## Development setup

### Prerequisites

- Firefox 109+ and/or Chrome (current)
- A running Skippy backend that exposes `GET /api/v2/timestamps`

### Load unpacked (Firefox)

1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**
2. Select `plugin/manifest.json`

### Load unpacked (Chrome)

1. Open `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `plugin/` folder

### Configure

1. Click the Skippy toolbar icon
2. Enter your server **base URL** (no path suffix — the extension appends `/api/v2/timestamps`)
3. Click **Save**
4. Open a YouTube video and check the browser console for `[YouTube Tracker]` logs

### Cross-browser dev workflow

After any change:

1. Reload the extension in **both** browsers' extension managers
2. Refresh open YouTube tabs (content scripts do not hot-reload)

## Making changes

| Change type | Files to edit |
|-------------|---------------|
| Skip logic, API calls, URL detection | `plugin/processor.js` |
| Settings UI | `plugin/popup.html`, `plugin/popup.js` |
| Cross-browser extension APIs | `plugin/ext.js` |
| Permissions, content script matches, icons | `plugin/manifest.json` |

## Permissions

- `host_permissions: https://*/*` — fetch timestamps from the configured server
- `storage` — persist the server URL via `storage.sync`

## Notes

- **Manifest V3** — supported by Firefox 109+ and Chrome; no background service worker required for this extension.
- **Firefox add-on ID** — set in `browser_specific_settings.gecko`; Chrome ignores this field.
- **Icons** — a placeholder `plugin/icons/icon-48.png` is included; replace before publishing.
- **Logging prefix** — console messages use `[YouTube Tracker]` (legacy name in code).

## License

Not specified.
