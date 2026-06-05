document.getElementById('save').addEventListener('click', () => {
    console.log("[YouTube Tracker] Save button clicked.");
    const storage = (typeof browser !== "undefined") ? browser.storage.sync : chrome.storage.sync;
    const serverInput = document.getElementById('server');
    const statusDiv = document.getElementById('status');

    const server = serverInput.value;
    storage.set({ server }).then(() => {
        console.log("[YouTube Tracker] URL saved:", server);
        statusDiv.textContent = 'Saved!';
        setTimeout(() => statusDiv.textContent = '', 1500);
    });
});


document.addEventListener('DOMContentLoaded', () => {
    console.log("[YouTube Tracker] Popup loaded.");

    const serverInput = document.getElementById('server');
    const statusDiv = document.getElementById('status');

    // Use browser.storage for Firefox compatibility
    const storage = (typeof browser !== "undefined") ? browser.storage.sync : chrome.storage.sync;

    storage.get('server').then((result) => {
        if (result.server) {
            serverInput.value = result.server;
        }
    });

    document.getElementById('save').addEventListener('click', () => {
        const server = serverInput.value;
        storage.set({ 'server': server }).then(() => {
            console.log("[YouTube Tracker] URL saved:", server);
            statusDiv.textContent = 'Saved!';
            setTimeout(() => statusDiv.textContent = '', 1500);
        });
    });
});