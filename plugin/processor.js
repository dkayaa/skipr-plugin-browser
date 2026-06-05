const api_path = '/api/v2/timestamps';
const SKIP_CHECK_MS = 250;
const URL_POLL_MS = 500;
const STORAGE_POLL_MS = 1000;
const VIDEO_RETRY_MS = 1000;

let timestamps = [];
let api_url = '';
let video_ref = '';
let trackedVideo = null;
let skipHandler = null;
let waitVideoTimeout = null;

function getVideoIdFromUrl(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
}

function parseTimestamps(data) {
    if (!Array.isArray(data)) {
        console.warn("[YouTube Tracker] Expected array response, got:", typeof data);
        return [];
    }

    return data.filter((entry) => {
        return typeof entry.start_time === 'number'
            && typeof entry.end_time === 'number'
            && entry.start_time < entry.end_time;
    });
}

function stopTracking() {
    if (skipHandler && trackedVideo) {
        trackedVideo.removeEventListener('timeupdate', skipHandler);
    }
    skipHandler = null;
    trackedVideo = null;
}

function checkAndSkip(video) {
    if (!video || !video.isConnected) {
        return;
    }

    const curTime = video.currentTime;
    for (let i = 0; i < timestamps.length; i++) {
        const { start_time, end_time } = timestamps[i];
        if (start_time <= curTime && curTime < end_time) {
            console.log("[YouTube Tracker] Skipping segment", start_time, "–", end_time);
            video.currentTime = end_time;
            return;
        }
    }
}

function trackVideo(video) {
    stopTracking();
    trackedVideo = video;

    let lastCheck = 0;
    skipHandler = () => {
        const now = performance.now();
        if (now - lastCheck < SKIP_CHECK_MS) {
            return;
        }
        lastCheck = now;
        checkAndSkip(video);
    };

    video.addEventListener('timeupdate', skipHandler);
}

function getServer(link) {
    if (!link || !api_url) {
        timestamps = [];
        return;
    }

    timestamps = [];
    const fetchLink = link;
    const params = new URLSearchParams();
    params.append('link', link);

    console.log("[YouTube Tracker] Sending GET request to:", api_url + api_path);

    fetch(api_url + api_path + '?' + params.toString(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then((data) => {
            if (fetchLink !== video_ref) {
                console.log("[YouTube Tracker] Ignoring stale response for:", fetchLink);
                return;
            }
            timestamps = parseTimestamps(data);
            console.log('[YouTube Tracker] Loaded', timestamps.length, 'skip segment(s)');
        })
        .catch((error) => {
            console.error("[YouTube Tracker] GET request error:", error);
        });
}

function waitForVideo() {
    if (waitVideoTimeout) {
        clearTimeout(waitVideoTimeout);
        waitVideoTimeout = null;
    }

    const video = document.querySelector('video');
    if (video) {
        video_ref = window.location.href;

        console.log("[YouTube Tracker] Video found:", video_ref);

        getServer(video_ref);
        trackVideo(video);
    } else {
        waitVideoTimeout = setTimeout(waitForVideo, VIDEO_RETRY_MS);
    }
}

function loadServerUrl() {
    getStorage().get('server')
        .then((result) => {
            const next = result.server || '';
            if (next === api_url) {
                return;
            }

            api_url = next;
            console.log("[YouTube Tracker] API URL updated:", api_url || '(not set)');
            if (video_ref) {
                getServer(video_ref);
            }
        })
        .catch((error) => {
            console.error("[YouTube Tracker] Storage read error:", error);
        });
}

let currentVideoId = getVideoIdFromUrl(location.href);

function onNewVideo(videoId) {
    console.log("[Youtube Tracker] New video loaded:", videoId);
    stopTracking();
    timestamps = [];
    waitForVideo();
}

function handleUrlChange() {
    const newVideoId = getVideoIdFromUrl(location.href);
    if (newVideoId && newVideoId !== currentVideoId) {
        currentVideoId = newVideoId;
        onNewVideo(newVideoId);
    }
}

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
    originalPushState.apply(this, args);
    setTimeout(handleUrlChange, 100);
};

history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    setTimeout(handleUrlChange, 100);
};

window.addEventListener("popstate", () => {
    setTimeout(handleUrlChange, 100);
});

setInterval(handleUrlChange, URL_POLL_MS);

loadServerUrl();
setInterval(loadServerUrl, STORAGE_POLL_MS);

if (currentVideoId) {
    waitForVideo();
}
