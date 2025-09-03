const ZOOM_STORAGE_KEY = 'globalCameraZoom';
let video, track, zoomSlider, focusFrame;
let focusCheckInterval;

async function initCamera() {
    video = document.getElementById('camera');
    zoomSlider = document.getElementById('zoomSlider');
    focusFrame = document.getElementById('focusFrame');

    if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
        });
        video.srcObject = stream;
        track = stream.getVideoTracks()[0];
        setupZoom();
        triggerFocus();
        focusCheckInterval = setInterval(checkFocus, 500);
    } catch (err) {
        console.error('Camera init failed', err);
    }
}

function setupZoom() {
    const capabilities = track.getCapabilities();
    if (!capabilities.zoom) {
        zoomSlider.style.display = 'none';
        return;
    }
    const storedZoom = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY)) || capabilities.zoom.min || 1;
    zoomSlider.min = capabilities.zoom.min || 1;
    zoomSlider.max = capabilities.zoom.max || 3;
    zoomSlider.step = capabilities.zoom.step || 0.1;
    zoomSlider.value = storedZoom;
    applyZoom(storedZoom);

    zoomSlider.addEventListener('input', () => {
        const val = parseFloat(zoomSlider.value);
        applyZoom(val);
        localStorage.setItem(ZOOM_STORAGE_KEY, val);
        triggerFocus();
    });
}

function applyZoom(val) {
    track.applyConstraints({ advanced: [{ zoom: val }] }).catch(err => console.warn('Zoom not supported', err));
}

function triggerFocus() {
    const capabilities = track.getCapabilities();
    if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(()=>{});
    } else if (capabilities.focusMode && capabilities.focusMode.includes('single-shot')) {
        track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] }).catch(()=>{});
    }
}

function checkFocus() {
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Laplacian variance focus measure
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < data.length; i += 4) {
        const g = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        sum += g;
        sumSq += g * g;
    }
    const mean = sum / (data.length / 4);
    const variance = sumSq / (data.length / 4) - mean * mean;
    const threshold = 500;
    if (variance > threshold) {
        focusFrame.style.borderColor = 'lime';
    } else {
        focusFrame.style.borderColor = 'red';
    }
}

document.addEventListener('DOMContentLoaded', initCamera);
