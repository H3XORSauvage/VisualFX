const filterMap = {
    saturation: 'saturate',
    brightness: 'brightness',
    contrast: 'contrast',
    invert: 'invert',
    'hue-rotate': 'hue-rotate'
};

const defaultSettings = {
    saturation: 100,
    brightness: 100,
    contrast: 100,
    invert: 0,
    'hue-rotate': 0,
    isSiteEnabled: true,
    isAmbilightEnabled: false,
    targetType: 'body',
    targetValue: 'body'
};

function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

// --- Global Variables ---
let currentTargetElement = null;
let filterOverlay = null;

// --- Ambilight Variables ---
let ambilightCanvas = null;
let ambilightCtx = null;
let ambilightVideo = null;
let ambilightAnimationId = null;
let ambilightHalo = null; // The halo element, separate from the video
let ambilightResizeObserver = null; // For observing video element resizing

// --- Ambilight Core Functions ---
function stopAmbilight() {
    if (ambilightAnimationId) {
        cancelAnimationFrame(ambilightAnimationId);
        ambilightAnimationId = null;
    }
    if (ambilightHalo) {
        ambilightHalo.remove();
        ambilightHalo = null;
    }
    if (ambilightCanvas) {
        ambilightCanvas.remove();
        ambilightCanvas = null;
    }
    if (ambilightVideo) {
        ambilightVideo.removeAttribute('data-ambilight-active');
        // Remove the resize observer if it exists
        if (ambilightResizeObserver) {
            ambilightResizeObserver.disconnect();
            ambilightResizeObserver = null;
        }
        ambilightVideo = null;
    }
    console.log("VisualFX: Ambilight stopped.");
}

function updateAmbilightFrame() {
    // Add check for video readiness
    if (!ambilightVideo || !ambilightHalo || !ambilightCtx || ambilightVideo.paused || ambilightVideo.ended || ambilightVideo.readyState < 3) {
        if (ambilightHalo) ambilightHalo.style.display = 'none';
        ambilightAnimationId = requestAnimationFrame(updateAmbilightFrame);
        return;
    }

    const videoRect = ambilightVideo.getBoundingClientRect();
    if (videoRect.width === 0 || videoRect.height === 0) {
        if (ambilightHalo) ambilightHalo.style.display = 'none';
        ambilightAnimationId = requestAnimationFrame(updateAmbilightFrame);
        return;
    }

    // Match halo position and size to the video
    Object.assign(ambilightHalo.style, {
        display: 'block',
        top: `${videoRect.top}px`,
        left: `${videoRect.left}px`,
        width: `${videoRect.width}px`,
        height: `${videoRect.height}px`,
    });

    const videoWidth = ambilightVideo.videoWidth;
    const videoHeight = ambilightVideo.videoHeight;
    // Only resize canvas if necessary to avoid unnecessary re-allocations
    if (ambilightCanvas.width !== videoWidth || ambilightCanvas.height !== videoHeight) {
        ambilightCanvas.width = videoWidth;
        ambilightCanvas.height = videoHeight;
    }

    try {
        ambilightCtx.drawImage(ambilightVideo, 0, 0, videoWidth, videoHeight);
        const sampleSize = 1; // Increased sample size for better color averaging
        const topData = ambilightCtx.getImageData(0, 0, videoWidth, sampleSize).data;
        const bottomData = ambilightCtx.getImageData(0, videoHeight - sampleSize, videoWidth, sampleSize).data;
        const leftData = ambilightCtx.getImageData(0, 0, sampleSize, videoHeight).data;
        const rightData = ambilightCtx.getImageData(videoWidth - sampleSize, 0, sampleSize, videoHeight).data;

        const getAverageColor = (data) => {
            let r = 0, g = 0, b = 0, count = data.length / 4;
            for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; }
            return `rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`;
        };

        // Correct box-shadow for a surrounding glow
        // Calculate average brightness for dynamic opacity
        const fullFrameData = ambilightCtx.getImageData(0, 0, videoWidth, videoHeight).data;
        let totalBrightness = 0;
        for (let i = 0; i < fullFrameData.length; i += 4) {
            // Calculate luminance (perceived brightness) using standard formula
            totalBrightness += (fullFrameData[i] * 0.299 + fullFrameData[i+1] * 0.587 + fullFrameData[i+2] * 0.114);
        }
        const averageBrightness = totalBrightness / (fullFrameData.length / 4); // Average brightness per pixel (0-255)

        // Map averageBrightness to opacity (e.g., 0.2 for very dark to 1.0 for very bright)
        const minOpacity = 0.2; 
        const maxOpacity = 1.0; 
        const opacity = minOpacity + (averageBrightness / 255) * (maxOpacity - minOpacity);
        ambilightHalo.style.opacity = opacity;

        ambilightHalo.style.boxShadow = `
            0 -60px 100px 60px ${getAverageColor(topData)},
            0 60px 100px 60px ${getAverageColor(bottomData)},
            -60px 0 100px 60px ${getAverageColor(leftData)},
            60px 0 100px 60px ${getAverageColor(rightData)}
        `;

    } catch (e) {
        console.error("VisualFX Ambilight Error:", e);
        stopAmbilight();
        return;
    }

    ambilightAnimationId = requestAnimationFrame(updateAmbilightFrame);
}

function startAmbilight(video) {
    if (!video || video.hasAttribute('data-ambilight-active')) return;
    stopAmbilight(); // Clean up any previous instance

    console.log("VisualFX: Starting Ambilight on video:", video);
    ambilightVideo = video;
    ambilightVideo.crossOrigin = 'anonymous';
    ambilightVideo.setAttribute('data-ambilight-active', 'true');

    // Create the halo element
    ambilightHalo = document.createElement('div');
    Object.assign(ambilightHalo.style, {
        position: 'fixed',
        zIndex: '2147483646', // Just under the max z-index, to be on top of most things
        pointerEvents: 'none', // Click through the halo
        display: 'none' // Initially hidden
    });
    document.body.appendChild(ambilightHalo);
    
    // The video's own filter will be applied on top of the halo
    video.style.zIndex = '2147483647';
    video.style.position = 'relative'; // Needed for z-index to apply

    // Setup canvas for color analysis
    ambilightCanvas = document.createElement('canvas');
    ambilightCanvas.style.display = 'none';
    document.body.appendChild(ambilightCanvas);
    ambilightCtx = ambilightCanvas.getContext('2d', { willReadFrequently: true });

    // Observe video for resize events
    ambilightResizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.target === ambilightVideo) {
                // Re-trigger frame update on video resize
                if (ambilightAnimationId) {
                    cancelAnimationFrame(ambilightAnimationId);
                }
                ambilightAnimationId = requestAnimationFrame(updateAmbilightFrame);
            }
        }
    });
    ambilightResizeObserver.observe(ambilightVideo);

    if (!ambilightAnimationId) {
        ambilightAnimationId = requestAnimationFrame(updateAmbilightFrame);
    }
}

function setupAmbilight(settings) {
    if (settings.isAmbilightEnabled) {
        // Filter for videos that are ready enough to have dimensions
        const videos = Array.from(document.querySelectorAll('video')).filter(v => v.readyState >= 2 && v.videoWidth > 200);
        const largestVideo = videos.sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height))[0];
        
        if (largestVideo && !largestVideo.hasAttribute('data-ambilight-active')) {
            startAmbilight(largestVideo);
        } else if (!largestVideo && ambilightVideo) { // If no suitable video found but ambilight is active, stop it
            stopAmbilight();
        }
    } else {
        stopAmbilight();
    }
}

// --- Filter Application Functions ---
function applyFilters() {
    browser.storage.local.get(null).then(storage => {
        const hostname = getHostname(window.location.href);
        const siteSettings = storage[hostname] || defaultSettings;

        setupAmbilight(siteSettings);

        const isGloballyEnabled = storage.isGloballyEnabled !== false;
        const isSiteEnabled = siteSettings.isSiteEnabled;

        if (currentTargetElement) currentTargetElement.style.filter = 'none';
        document.body.style.filter = 'none';
        if (document.fullscreenElement) document.fullscreenElement.style.filter = 'none';
        if (filterOverlay) Object.assign(filterOverlay.style, { filter: 'none', clipPath: 'none', webkitClipPath: 'none' });

        if (isGloballyEnabled && isSiteEnabled) {
            const filters = Object.entries(filterMap).map(([key, filterName]) => {
                const value = siteSettings[key] !== undefined ? siteSettings[key] : defaultSettings[key];
                let unit = (key === 'hue-rotate') ? 'deg' : '%';
                return `${filterName}(${value}${unit})`;
            }).join(' ');

            const fullscreenEl = document.fullscreenElement;
            let target = fullscreenEl;

            if (!target) {
                const targetType = siteSettings.targetType || 'body';
                if (targetType === 'element') {
                    try { target = document.querySelector(siteSettings.targetValue); } catch (e) {}
                }
                if (!target) target = document.body;
            }
            
            currentTargetElement = target;
            currentTargetElement.style.filter = filters;
        }
    });
}

// --- Event & Message Listeners ---
applyFilters();
browser.storage.onChanged.addListener(applyFilters);
document.addEventListener('fullscreenchange', applyFilters);

const observer = new MutationObserver(() => applyFilters());
observer.observe(document.body, { childList: true, subtree: true });