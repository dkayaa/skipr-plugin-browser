// Globals 
var timestamps = [];
var api_url = '';
const api_path = '/api/v2/timestamps';

// Load server URL from storage
setInterval(() => {
    const storage = (typeof browser !== "undefined") ? browser.storage.sync : chrome.storage.sync;

    storage.get('server').then((result) => {
        var api_url_old = api_url;
        api_url = result.server || 'No Server URL Set';
        if (api_url !== api_url_old) {
            console.log("[YouTube Tracker] API URL updated:", api_url);
            getServer(video_ref);
        }
    });
}, 1000); // Check every second

function waitForVideo() {
    const video = document.querySelector('video');
    if (video) {
        video_ref = window.location.href;

        console.log("[YouTube Tracker] Video found.");
        console.log("[YouTube Tracker]:", video_ref);

        getServer(video_ref);
        trackVideo(video);

    } else {
        setTimeout(waitForVideo, 10000);
    }
}

function getServer(link) {
    timestamps = []
    const params = new URLSearchParams();
    params.append('link', video_ref);
    console.log("[YouTube Tracker] Sending GET request to:", api_url + api_path);

    fetch(api_url + api_path + '?' + params.toString(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    }).then(response => response.json())
        .then(data => {
            console.log('[YouTube Tracker] GET request responded with:', data);
            timestamps = data;
        }).catch(error => {
            console.error("[YouTube Tracker] GET request error:", error);
        });
}

function trackVideo(video) {
    setInterval(() => {
        const curTime = document.querySelector('video').currentTime;
        for (let i = 0; i < timestamps.length - 1; i++) {

            if ((timestamps[i].start_time < curTime) && (curTime < timestamps[i].end_time)) {
                document.querySelector('video').currentTime = timestamps[i].end_time
                return
            }
        }
    }, 5000); // Log every 5 seconds
}

let currentVideoId = getVideoIdFromUrl(location.href);

function getVideoIdFromUrl(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
}

function onNewVideo(videoId) {
    console.log("[Youtube Tracker] New video loaded:", videoId);
    waitForVideo();
}

function handleUrlChange() {
    const newVideoId = getVideoIdFromUrl(location.href);
    if (newVideoId && newVideoId !== currentVideoId) {
        currentVideoId = newVideoId;
        onNewVideo(newVideoId);
    }
}

// Hook into History API
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

// Also poll for changes every 500ms (for edge cases)
setInterval(handleUrlChange, 500);

