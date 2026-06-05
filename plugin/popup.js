document.addEventListener('DOMContentLoaded', () => {
    console.log("[YouTube Tracker] Popup loaded.");

    const serverInput = document.getElementById('server');
    const statusDiv = document.getElementById('status');
    const storage = getStorage();

    storage.get('server').then((result) => {
        if (result.server) {
            serverInput.value = result.server;
        }
    });

    document.getElementById('save').addEventListener('click', () => {
        const server = serverInput.value;
        storage.set({ server }).then(() => {
            console.log("[YouTube Tracker] URL saved:", server);
            statusDiv.textContent = 'Saved!';
            setTimeout(() => statusDiv.textContent = '', 1500);
        });
    });
});
