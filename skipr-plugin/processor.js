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
let notifyLevel = 'minimal';
let skippingEnabled = true;

const NOTIFY_LEVELS = new Set(['off', 'minimal', 'detailed']);

function getVideoIdFromUrl(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
}

function parseIntervals(data) {
    if (!data || data.status !== 'ready' || !Array.isArray(data.intervals)) {
        console.warn("[Skipr] Expected ready response with intervals, got:", data);
        return [];
    }

    return data.intervals.filter((entry) => {
        return typeof entry.start_time === 'number'
            && typeof entry.end_time === 'number'
            && entry.start_time < entry.end_time;
    }).map((entry) => ({
        start_time: entry.start_time,
        end_time: entry.end_time,
        orgs: Array.isArray(entry.orgs) ? entry.orgs.filter((org) => typeof org === 'string') : [],
    }));
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
    console.log("[Skipr] Sending GET request to:", url);

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
                console.log("[Skipr] Ignoring stale response for:", link);
                return;
            }

            if (response.status === 202 || data.status === 'pending') {
                setAnalysisState('pending');
                console.log("[Skipr] Analysis pending, polling again in", ANALYSIS_POLL_MS, "ms");
                schedulePendingPoll(link, generation);
                return;
            }

            if (data.status === 'failed') {
                const error = data.error || 'Analysis failed';
                setAnalysisState('failed', error);
                console.error("[Skipr] Analysis failed:", error);
                return;
            }

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            if (data.status === 'ready') {
                timestamps = parseIntervals(data);
                setAnalysisState('ready');
                console.log('[Skipr] Loaded', timestamps.length, 'skip segment(s)');
                return;
            }

            console.warn("[Skipr] Unexpected response:", response.status, data);
        })
        .catch((error) => {
            if (!isStaleFetch(link, generation)) {
                console.error("[Skipr] GET request error:", error);
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

function syncSkippingState() {
    ext.runtime.sendMessage({
        type: 'skipping-enabled',
        enabled: skippingEnabled,
    }).catch(() => {});
}

function checkAndSkip(video) {
    if (!skippingEnabled || !video || !video.isConnected) {
        return;
    }

    const curTime = video.currentTime;
    for (let i = 0; i < timestamps.length; i++) {
        const segment = timestamps[i];
        const { start_time, end_time } = segment;
        if (start_time <= curTime && curTime < end_time) {
            console.log("[Skipr] Skipping segment", start_time, "–", end_time);
            video.currentTime = end_time;
            showSkipNotification(segment, notifyLevel, video);
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

    if (!link) {
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

        console.log("[Skipr] Video found:", video_ref);

        getServer(video_ref);
        trackVideo(video);
    } else {
        waitVideoTimeout = setTimeout(waitForVideo, VIDEO_RETRY_MS);
    }
}

function loadSettings() {
    return getStorage().get(['server', 'notifyLevel', 'skippingEnabled'])
        .then((result) => {
            const nextUrl = resolveApiUrl(result.server);
            const nextNotify = NOTIFY_LEVELS.has(result.notifyLevel) ? result.notifyLevel : 'minimal';
            const nextSkipping = result.skippingEnabled !== false;
            const urlChanged = nextUrl !== api_url;
            const notifyChanged = nextNotify !== notifyLevel;
            const skippingChanged = nextSkipping !== skippingEnabled;

            api_url = nextUrl;
            notifyLevel = nextNotify;
            skippingEnabled = nextSkipping;

            if (urlChanged) {
                console.log("[Skipr] API URL updated:", api_url || '(not set)');
            }

            if (notifyChanged) {
                console.log("[Skipr] Notification level:", notifyLevel);
            }

            if (skippingChanged) {
                console.log("[Skipr] Interval skipping:", skippingEnabled ? 'enabled' : 'disabled');
                syncSkippingState();
            }

            if (urlChanged && video_ref) {
                getServer(video_ref);
            }
        })
        .catch((error) => {
            console.error("[Skipr] Storage read error:", error);
        });
}

function init() {
    loadSettings().then(() => {
        syncSkippingState();
        if (currentVideoId) {
            waitForVideo();
        }
    });

    setInterval(loadSettings, STORAGE_POLL_MS);
}

let currentVideoId = getVideoIdFromUrl(location.href);

function onNewVideo(videoId) {
    console.log("[Skipr] New video loaded:", videoId);
    stopTracking();
    hideSkipToast();
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

init();
