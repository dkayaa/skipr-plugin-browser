/* exported showSkipNotification, hideSkipToast */
const NOTIFY_TOAST_MS = 2000;

let skipToastEl = null;
let skipToastTimer = null;
let skipToastHideTimer = null;
let skipToastStyleEl = null;

function ensureSkipToastStyles() {
    if (skipToastStyleEl) {
        return;
    }

    skipToastStyleEl = document.createElement('style');
    skipToastStyleEl.textContent = `
        .skipr-skip-toast {
            position: absolute;
            left: 12px;
            bottom: 52px;
            z-index: 2147483646;
            max-width: min(360px, 72%);
            padding: 8px 12px;
            border-radius: 4px;
            background: rgba(0, 0, 0, 0.78);
            color: #fff;
            font: 500 13px/1.35 Roboto, "YouTube Noto", Arial, sans-serif;
            letter-spacing: 0.01em;
            pointer-events: none;
            opacity: 0;
            transform: translateY(6px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        }

        .skipr-skip-toast.visible {
            opacity: 1;
            transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
            .skipr-skip-toast {
                transition: none;
            }
        }
    `;
    document.head.appendChild(skipToastStyleEl);
}

function getPlayerContainer(video) {
    if (!video) {
        return null;
    }

    const player = video.closest('.html5-video-player') || document.querySelector('#movie_player');
    if (!player) {
        return null;
    }

    const style = getComputedStyle(player);
    if (style.position === 'static') {
        player.style.position = 'relative';
    }

    return player;
}

function formatSkipMessage(segment, level) {
    if (level === 'detailed' && Array.isArray(segment.orgs) && segment.orgs.length > 0) {
        return 'Skipped: ' + segment.orgs.join(', ');
    }

    return 'Skipped segment';
}

function hideSkipToast() {
    clearTimeout(skipToastTimer);
    clearTimeout(skipToastHideTimer);

    if (!skipToastEl) {
        return;
    }

    skipToastEl.classList.remove('visible');
    skipToastHideTimer = setTimeout(() => {
        if (skipToastEl) {
            skipToastEl.remove();
            skipToastEl = null;
        }
    }, 200);
}

function showSkipNotification(segment, level, video) {
    if (level === 'off' || !segment || !video) {
        return;
    }

    ensureSkipToastStyles();

    const container = getPlayerContainer(video);
    if (!container) {
        return;
    }

    hideSkipToast();

    skipToastEl = document.createElement('div');
    skipToastEl.className = 'skipr-skip-toast';
    skipToastEl.setAttribute('role', 'status');
    skipToastEl.setAttribute('aria-live', 'polite');
    skipToastEl.textContent = formatSkipMessage(segment, level);
    container.appendChild(skipToastEl);

    requestAnimationFrame(() => {
        if (skipToastEl) {
            skipToastEl.classList.add('visible');
        }
    });

    skipToastTimer = setTimeout(() => {
        hideSkipToast();
    }, NOTIFY_TOAST_MS);
}
