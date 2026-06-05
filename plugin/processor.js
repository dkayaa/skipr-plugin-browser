const api_path = '/api/v2/timestamps';
const SKIP_CHECK_MS = 250;
const URL_POLL_MS = 500;
const STORAGE_POLL_MS = 1000;
const VIDEO_RETRY_MS = 1000;
const ANALYSIS_POLL_MS = 3000;

let timestamps = [];
let api_url = '';
let video_ref = '';
let trackedVideo = null;
let skipHandler = null;
let waitVideoTimeout = null;
let pendingPollTimeout = null;
let fetchGeneration = 0;
let analysisState = { status: 'idle', error: null, link: null };

function getVideoIdFromUrl(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
}

function parseIntervals(data) {
    if (!data || data.status !== 'ready' || !Array.isArray(data.intervals)) {
        console.warn("[YouTube Tracker] Expected ready response with intervals, got:", data);
        return [];
    }

    return data.intervals.filter((entry) => {
        return typeof entry.start_time === 'number'
            && typeof entry.end_time === 'number'
            && entry.start_time < entry.end_time;
    });
}

function cancelPendingPoll() {
    if (pendingPollTimeout) {
        clearTimeout(pendingPollTimeout);
        pendingPollTimeout = null;
    }
}

function isStaleFetch(link, generation) {
    return link !== video_ref || generation !== fetchGeneration;
}

function setAnalysisState(status, error = null) {
    analysisState = { status, error, link: video_ref || null };
    ext.runtime.sendMessage({
        type: 'analysis-status',
        status: analysisState.status,
        error: analysisState.error,
        link: analysisState.link,
    }).catch(() => {});
}

function buildTimestampsUrl(link, { retry = false } = {}) {
    const params = new URLSearchParams();
    params.append('link', link);
    if (retry) {
        params.append('retry', '1');
    }
    return api_url + api_path + '?' + params.toString();
}

function schedulePendingPoll(link, generation) {
    cancelPendingPoll();
    pendingPollTimeout = setTimeout(() => {
        fetchTimestamps(link, generation);
    }, ANALYSIS_POLL_MS);
}

function fetchTimestamps(link, generation, { retry = false } = {}) {
    const url = buildTimestampsUrl(link, { retry });
    console.log("[YouTube Tracker] Sending GET request to:", url);

    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    })
        .then((response) => {
            return response.json().then((data) => ({ response, data }));
        })
        .then(({ response, data }) => {
            if (isStaleFetch(link, generation)) {
                console.log("[YouTube Tracker] Ignoring stale response for:", link);
                return;
            }

            if (response.status === 202 || data.status === 'pending') {
                setAnalysisState('pending');
                console.log("[YouTube Tracker] Analysis pending, polling again in", ANALYSIS_POLL_MS, "ms");
                schedulePendingPoll(link, generation);
                return;
            }

            if (data.status === 'failed') {
                const error = data.error || 'Analysis failed';
                setAnalysisState('failed', error);
                console.error("[YouTube Tracker] Analysis failed:", error);
                return;
            }

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            if (data.status === 'ready') {
                timestamps = parseIntervals(data);
                setAnalysisState('ready');
                console.log('[YouTube Tracker] Loaded', timestamps.length, 'skip segment(s)');
                return;
            }

            console.warn("[YouTube Tracker] Unexpected response:", response.status, data);
        })
        .catch((error) => {
            if (!isStaleFetch(link, generation)) {
                console.error("[YouTube Tracker] GET request error:", error);
            }
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

function getServer(link, { retry = false } = {}) {
    cancelPendingPoll();
    fetchGeneration += 1;

    if (!link || !api_url) {
        timestamps = [];
        setAnalysisState('idle');
        return;
    }

    timestamps = [];
    if (retry) {
        setAnalysisState('pending');
    }
    fetchTimestamps(link, fetchGeneration, { retry });
}

function retryAnalysis() {
    if (!video_ref) {
        return { ok: false, error: 'No video loaded' };
    }
    getServer(video_ref, { retry: true });
    return { ok: true };
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
    setAnalysisState('idle');
    waitForVideo();
}

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'get-status') {
        sendResponse(analysisState);
        return;
    }

    if (message.type === 'retry-analysis') {
        sendResponse(retryAnalysis());
        return;
    }
});

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
