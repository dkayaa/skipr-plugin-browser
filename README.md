# Skippy

A browser extension that auto-skips segments of YouTube videos based on timestamps from a backend server.

Supports Firefox (primary) and Chrome-compatible browsers via the WebExtension APIs.

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
├── plugin/                 # Load this folder as an unpacked extension
│   ├── manifest.json       # Extension manifest (MV2)
│   ├── processor.js        # Content script — fetch timestamps, skip segments
│   ├── popup.html          # Settings UI
│   ├── popup.js            # Save/load server URL to storage
│   └── icons/              # Extension icons (48px required)
├── .cursor/rules/          # Cursor agent conventions
└── README.md
```

The `plugin/` directory is the extension root. Keeping source in a subfolder leaves room at the repo root for docs, tooling, or CI without mixing them into the loadable extension bundle.

## Development setup

### Prerequisites

- Firefox and/or Chrome
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

## Making changes

| Change type | Files to edit |
|-------------|---------------|
| Skip logic, API calls, URL detection | `plugin/processor.js` |
| Settings UI | `plugin/popup.html`, `plugin/popup.js` |
| Permissions, content script matches, icons | `plugin/manifest.json` |

After editing, reload the extension in the browser's extension manager and refresh any open YouTube tabs.

## Permissions

- `https://*/*` — fetch timestamps from the configured server
- `storage` — persist the server URL via `browser.storage.sync` / `chrome.storage.sync`

## Notes

- **Manifest V2** — works in Firefox; Chrome is deprecating MV2, so a future MV3 migration may be needed.
- **Icons** — a placeholder `plugin/icons/icon-48.png` is included; replace before publishing.
- **Logging prefix** — console messages use `[YouTube Tracker]` (legacy name in code).

## License

Not specified.
