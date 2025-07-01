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
    targetType: 'body', // 'body', 'element', or 'area'
    targetValue: 'body' // CSS selector for element, or coordinates for area
};

function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

let currentTargetElement = null; // Element currently being filtered
let selectorModeActive = false; // Flag for selector mode
let highlightOverlay = null; // Overlay for highlighting elements
let messageOverlay = null; // Overlay for displaying messages
let selectionRect = null; // Visual rectangle for area selection
let startX, startY; // Starting coordinates for area selection

// --- Selector Mode Functions ---
function generateCssSelector(el) {
    if (!el || el.nodeType !== 1) return null;

    let selector = el.tagName.toLowerCase();

    if (el.id) {
        return `#${el.id}`;
    }
    if (el.className) {
        const classes = el.className.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) {
            selector += '.' + classes.join('.');
        }
    }

    // Add nth-child if not unique enough
    let siblings = el.parentNode ? Array.from(el.parentNode.children) : [];
    let sameTagSiblings = siblings.filter(s => s.tagName === el.tagName);
    if (sameTagSiblings.length > 1) {
        let index = sameTagSiblings.indexOf(el) + 1;
        selector += `:nth-child(${index})`;
    }

    // Traverse up the DOM tree
    if (el.parentNode && el.parentNode.tagName.toLowerCase() !== 'body' && el.parentNode.tagName.toLowerCase() !== 'html') {
        return generateCssSelector(el.parentNode) + ' > ' + selector;
    }

    return selector;
}

function highlightElement(el) {
    if (!highlightOverlay) {
        highlightOverlay = document.createElement('div');
        highlightOverlay.style.position = 'absolute';
        highlightOverlay.style.border = '2px solid #7aa2f7';
        highlightOverlay.style.backgroundColor = 'rgba(122, 162, 247, 0.2)';
        highlightOverlay.style.zIndex = '999999';
        highlightOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through
        document.body.appendChild(highlightOverlay);
    }
    const rect = el.getBoundingClientRect();
    highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.display = 'block';
}

function hideHighlight() {
    if (highlightOverlay) {
        highlightOverlay.style.display = 'none';
    }
}

function showMessage(msg) {
    if (!messageOverlay) {
        messageOverlay = document.createElement('div');
        messageOverlay.style.position = 'fixed';
        messageOverlay.style.top = '10px';
        messageOverlay.style.left = '50%';
        messageOverlay.style.transform = 'translateX(-50%)';
        messageOverlay.style.backgroundColor = '#1a1b26';
        messageOverlay.style.color = '#a9b1d6';
        messageOverlay.style.padding = '10px 20px';
        messageOverlay.style.borderRadius = '5px';
        messageOverlay.style.zIndex = '1000000';
        messageOverlay.style.border = '1px solid #414868';
        messageOverlay.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
        document.body.appendChild(messageOverlay);
    }
    messageOverlay.textContent = msg;
    messageOverlay.style.display = 'block';
}

function hideMessage() {
    if (messageOverlay) {
        messageOverlay.style.display = 'none';
    }
}

let currentSelectorMode = null; // 'element' or 'area'

function activateSelectorMode(mode) {
    currentSelectorMode = mode;
    selectorModeActive = true;
    document.documentElement.style.cursor = 'crosshair';
    document.addEventListener('keydown', handleEscapeKey, true);

    if (mode === 'element') {
        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
        document.addEventListener('click', handleClickElement, true);
        showMessage('Cliquez sur un élément pour le sélectionner ou appuyez sur Échap pour annuler.');
    } else if (mode === 'area') {
        document.addEventListener('mousedown', handleMouseDownArea, true);
        showMessage('Cliquez et glissez pour sélectionner une zone ou appuyez sur Échap pour annuler.');
    }
    browser.runtime.sendMessage({ type: 'SELECTOR_MODE_ACTIVATED' });
}

function deactivateSelectorMode() {
    selectorModeActive = false;
    currentSelectorMode = null;
    document.documentElement.style.cursor = 'auto';
    document.removeEventListener('keydown', handleEscapeKey, true);

    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleClickElement, true);
    document.removeEventListener('mousedown', handleMouseDownArea, true);
    document.removeEventListener('mousemove', handleMouseMoveArea, true);
    document.removeEventListener('mouseup', handleMouseUpArea, true);

    hideHighlight();
    hideMessage();
    if (selectionRect) {
        selectionRect.remove();
        selectionRect = null;
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        deactivateSelectorMode();
        browser.runtime.sendMessage({ type: 'SELECTOR_MODE_DEACTIVATED' });
    }
}

// --- Element Selection Handlers ---
function handleMouseOver(e) {
    if (selectorModeActive && currentSelectorMode === 'element') {
        highlightElement(e.target);
    }
}

function handleMouseOut(e) {
    if (selectorModeActive && currentSelectorMode === 'element') {
        hideHighlight();
    }
}

function handleClickElement(e) {
    if (selectorModeActive && currentSelectorMode === 'element') {
        e.preventDefault();
        e.stopPropagation();
        const clickedElement = document.elementFromPoint(e.clientX, e.clientY);
        const selector = generateCssSelector(clickedElement);
        browser.runtime.sendMessage({ type: 'ELEMENT_SELECTED', selector: selector });
        deactivateSelectorMode();
        browser.runtime.sendMessage({ type: 'SELECTOR_MODE_DEACTIVATED' });
    }
}

// --- Area Selection Handlers ---
function handleMouseDownArea(e) {
    if (selectorModeActive && currentSelectorMode === 'area' && e.button === 0) { // Left click
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;

        selectionRect = document.createElement('div');
        selectionRect.style.position = 'fixed';
        selectionRect.style.border = '2px dashed #7aa2f7';
        selectionRect.style.backgroundColor = 'rgba(122, 162, 247, 0.1)';
        selectionRect.style.zIndex = '999999';
        document.body.appendChild(selectionRect);

        document.addEventListener('mousemove', handleMouseMoveArea, true);
        document.addEventListener('mouseup', handleMouseUpArea, true);
    }
}

function handleMouseMoveArea(e) {
    if (selectorModeActive && currentSelectorMode === 'area') {
        const currentX = e.clientX;
        const currentY = e.clientY;

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(startX - currentX);
        const height = Math.abs(startY - currentY);

        selectionRect.style.left = `${x}px`;
        selectionRect.style.top = `${y}px`;
        selectionRect.style.width = `${width}px`;
        selectionRect.style.height = `${height}px`;
    }
}

function handleMouseUpArea(e) {
    if (selectorModeActive && currentSelectorMode === 'area' && e.button === 0) {
        document.removeEventListener('mousemove', handleMouseMoveArea, true);
        document.removeEventListener('mouseup', handleMouseUpArea, true);

        const endX = e.clientX;
        const endY = e.clientY;

        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(startX - endX);
        const height = Math.abs(startY - endY);

        if (width > 5 && height > 5) { // Ensure a meaningful selection
            const coords = {
                x: x,
                y: y,
                width: width,
                height: height
            };
            browser.runtime.sendMessage({ type: 'AREA_SELECTED', coords: coords });
        } else {
            // If selection is too small, treat as cancellation
            browser.runtime.sendMessage({ type: 'SELECTOR_MODE_DEACTIVATED' });
        }
        deactivateSelectorMode();
    }
}

// --- Filter Application Functions ---
let filterOverlay = null; // The overlay element for filters

function applyFilters() {
    browser.storage.local.get(null).then(storage => {
        const hostname = getHostname(window.location.href);
        const siteSettings = storage[hostname] || defaultSettings;

        const isGloballyEnabled = storage.isGloballyEnabled !== false; // true by default
        const isSiteEnabled = siteSettings.isSiteEnabled;
        const targetType = siteSettings.targetType || 'body';
        const targetValue = siteSettings.targetValue || 'body';

        // --- Step 1: Reset all potential previous targets ---
        // Reset body and any previously targeted element
        if (currentTargetElement) {
            currentTargetElement.style.filter = 'none';
        }
        document.body.style.filter = 'none';

        // Also reset fullscreen element if it exists and is different
        if (document.fullscreenElement && document.fullscreenElement !== currentTargetElement) {
            document.fullscreenElement.style.filter = 'none';
        }

        // Reset filterOverlay (for area selection)
        if (filterOverlay) {
            filterOverlay.style.filter = 'none';
            filterOverlay.style.clipPath = 'none';
            filterOverlay.style.webkitClipPath = 'none';
        }

        // --- Step 2: Apply filters based on current settings ---
        if (isGloballyEnabled && isSiteEnabled) {
            const filters = Object.entries(filterMap).map(([key, filterName]) => {
                const value = siteSettings[key] !== undefined ? siteSettings[key] : defaultSettings[key];
                let unit = '%';
                if (key === 'hue-rotate') {
                    unit = 'deg';
                }
                return `${filterName}(${value}${unit})`;
            }).join(' ');

            const fullscreenEl = document.fullscreenElement;
            if (fullscreenEl) {
                // If in fullscreen, always apply to the fullscreen element
                currentTargetElement = fullscreenEl;
                fullscreenEl.style.filter = filters;
            } else {
                // Not in fullscreen, apply to the selected target
                if (targetType === 'body') {
                    currentTargetElement = document.body;
                    document.body.style.filter = filters;
                } else if (targetType === 'element') {
                    try {
                        const newTarget = document.querySelector(targetValue);
                        if (newTarget) {
                            currentTargetElement = newTarget;
                            currentTargetElement.style.filter = filters;
                        } else {
                            console.error("Invalid selector, falling back to body:", targetValue);
                            currentTargetElement = document.body;
                            document.body.style.filter = filters;
                        }
                    } catch (e) {
                        console.error("Invalid selector, falling back to body:", targetValue, e);
                        currentTargetElement = document.body;
                        document.body.style.filter = filters;
                    }
                } else if (targetType === 'area') {
                    // Area selection logic remains the same
                    if (!filterOverlay) {
                        filterOverlay = document.createElement('div');
                        filterOverlay.style.position = 'fixed';
                        filterOverlay.style.top = '0';
                        filterOverlay.style.left = '0';
                        filterOverlay.style.width = '100vw';
                        filterOverlay.style.height = '100vh';
                        filterOverlay.style.zIndex = '999998';
                        filterOverlay.style.pointerEvents = 'none';
                        document.body.appendChild(filterOverlay);
                    }
                    if (targetValue) {
                        const { x, y, width, height } = targetValue;
                        const clipPath = `inset(${y}px ${window.innerWidth - (x + width)}px ${window.innerHeight - (y + height)}px ${x}px)`;
                        filterOverlay.style.filter = filters;
                        filterOverlay.style.clipPath = clipPath;
                        filterOverlay.style.webkitClipPath = clipPath;
                    }
                }
            }
        }
    });
}

// --- Message Listener from Popup ---
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'ACTIVATE_SELECTOR_MODE') {
        activateSelectorMode(event.data.mode);
    } else if (event.data.type === 'APPLY_FILTERS') {
        applyFilters();
    }
});

// Initial application on load
applyFilters();

// Listen for storage changes (when settings are changed in popup)
browser.storage.onChanged.addListener(applyFilters);

// Listen for fullscreen changes to re-apply filters
document.addEventListener('fullscreenchange', applyFilters);
