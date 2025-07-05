document.addEventListener('DOMContentLoaded', async () => {
    const ui = {
        globalEnable: document.getElementById('global-enable'),
        siteEnable: document.getElementById('site-enable'),
        ambilightEnable: document.getElementById('ambilight-enable'), // Ambilight switch
        controlsWrapper: document.getElementById('controls-wrapper'),
        resetButton: document.getElementById('reset-button'),
        sliders: {
            saturation: document.getElementById('saturation'),
            brightness: document.getElementById('brightness'),
            contrast: document.getElementById('contrast'),
            invert: document.getElementById('invert'),
            'hue-rotate': document.getElementById('hue-rotate'),
            'blue-light-filter': document.getElementById('blue-light-filter'),
            blur: document.getElementById('blur'),
            'nd-filter': document.getElementById('nd-filter')
        },
        inputs: {
            saturation: document.getElementById('saturation-input'),
            brightness: document.getElementById('brightness-input'),
            contrast: document.getElementById('contrast-input'),
            invert: document.getElementById('invert-input'),
            'hue-rotate': document.getElementById('hue-rotate-input'),
            'blue-light-filter': document.getElementById('blue-light-filter-input'),
            blur: document.getElementById('blur-input'),
            'nd-filter': document.getElementById('nd-filter-input')
        },
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        presetNameInput: document.getElementById('preset-name-input'),
        savePresetButton: document.getElementById('save-preset-button'),
        presetsList: document.getElementById('presets-list'),
        selectElementButton: document.getElementById('select-element-button'),
        currentTargetDisplay: document.getElementById('current-target-display'),
        cplEnable: document.getElementById('cpl-enable'),
        ndFilterDisplay: document.getElementById('nd-filter-display'),
        toastNotification: document.getElementById('toast-notification'),
        firstTimeTutorial: document.getElementById('first-time-tutorial'),
        tutorialGotItButton: document.getElementById('tutorial-got-it')
    };

    const defaultSettings = {
        saturation: 100,
        brightness: 100,
        contrast: 100,
        invert: 0,
        'hue-rotate': 0,
        'blue-light-filter': 0,
        blur: 0,
        'nd-filter': 0,
        isCplEnabled: false,
        isSiteEnabled: true,
        isAmbilightEnabled: false, // Ambilight default
        targetType: 'body',
        targetValue: 'body'
    };

    let currentHostname = null;
    let siteSettings = {};
    let allPresets = {};

    async function init() {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        currentHostname = new URL(tab.url).hostname;

        const storage = await browser.storage.local.get(null);
        ui.globalEnable.checked = storage.isGloballyEnabled !== false;
        siteSettings = storage[currentHostname] || { ...defaultSettings };
        allPresets = storage.presets || {};

        updateUIFromSettings();
        renderPresets();
        setupListeners();
        showTab('tab-controls');

        // Check if tutorial has been seen
        const { hasSeenTutorial } = await browser.storage.local.get('hasSeenTutorial');
        if (!hasSeenTutorial) {
            ui.firstTimeTutorial.style.opacity = '1';
            ui.firstTimeTutorial.style.pointerEvents = 'auto';
            ui.tutorialGotItButton.addEventListener('click', async () => {
                ui.firstTimeTutorial.style.opacity = '0';
                ui.firstTimeTutorial.style.pointerEvents = 'none';
                await browser.storage.local.set({ hasSeenTutorial: true });
            });
        }
    }

    function updateUIFromSettings() {
        ui.siteEnable.checked = siteSettings.isSiteEnabled;
        ui.ambilightEnable.checked = siteSettings.isAmbilightEnabled;
        ui.cplEnable.checked = siteSettings.isCplEnabled;
        Object.keys(ui.sliders).forEach(key => {
            const value = siteSettings[key] !== undefined ? siteSettings[key] : defaultSettings[key];
            ui.sliders[key].value = value;
            if (ui.inputs[key]) ui.inputs[key].value = value; // Check if input exists
        });
        if (siteSettings.targetType === 'element') {
            ui.currentTargetDisplay.textContent = siteSettings.targetValue;
        } else if (siteSettings.targetType === 'area') {
            ui.currentTargetDisplay.textContent = `Zone`;
        } else {
            ui.currentTargetDisplay.textContent = 'body';
        }
        toggleControlsActive();
    }

    function toggleControlsActive() {
        const isEnabled = ui.globalEnable.checked && ui.siteEnable.checked;
        ui.controlsWrapper.style.opacity = isEnabled ? '1' : '0.5';
        ui.controlsWrapper.style.pointerEvents = isEnabled ? 'auto' : 'none';
    }

    async function saveSiteSettings() {
        await browser.storage.local.set({ [currentHostname]: siteSettings });
    }

    async function savePresets() {
        await browser.storage.local.set({ presets: allPresets });
    }

    function showTab(tabId) {
        const currentActiveTabContent = document.querySelector('.tab-content.active');
        const targetTabContent = document.getElementById(tabId);
        const targetTabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);

        // If the clicked tab is already active, do nothing
        if (targetTabContent && targetTabContent.classList.contains('active')) {
            return;
        }

        // Update button active state immediately
        ui.tabButtons.forEach(button => button.classList.remove('active'));
        if (targetTabButton) {
            targetTabButton.classList.add('active');
        }

        if (currentActiveTabContent) {
            // Start fade-out for the current active tab
            currentActiveTabContent.classList.remove('active');

            // After fade-out, activate the new tab
            setTimeout(() => {
                // Ensure the old tab is truly hidden after its transition
                currentActiveTabContent.style.display = 'none';

                if (targetTabContent) {
                    targetTabContent.style.display = 'block'; // Make new tab visible for fade-in
                    // Trigger reflow to ensure display change is applied before opacity transition
                    targetTabContent.offsetWidth; // Force reflow
                    targetTabContent.classList.add('active'); // Start fade-in
                    targetTabContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300); // Match CSS transition duration
        } else if (targetTabContent) {
            // This case handles the initial load or if no tab was active
            targetTabContent.style.display = 'block';
            targetTabContent.offsetWidth; // Force reflow
            targetTabContent.classList.add('active');
            targetTabContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function showToast(message) {
        ui.toastNotification.textContent = message;
        ui.toastNotification.classList.add('show');
        setTimeout(() => {
            ui.toastNotification.classList.remove('show');
        }, 2000);
    }

    function renderPresets() {
        ui.presetsList.innerHTML = '';
        for (const name in allPresets) {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            const span = document.createElement('span');
            span.textContent = name;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'preset-actions';

            const applyButton = document.createElement('button');
            applyButton.className = 'apply-preset';
            applyButton.dataset.presetName = name;
            applyButton.textContent = 'Appliquer';

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-preset delete-button';
            deleteButton.dataset.presetName = name;
            deleteButton.textContent = 'Supprimer';

            actionsDiv.appendChild(applyButton);
            actionsDiv.appendChild(deleteButton);

            presetItem.appendChild(span);
            presetItem.appendChild(actionsDiv);
            ui.presetsList.appendChild(presetItem);
        }
    }

    const ndValues = ["Off", "ND8", "ND16", "ND32"];
    function updateNdFilterDisplay() {
        const value = ui.sliders['nd-filter'].value;
        ui.ndFilterDisplay.textContent = ndValues[value];
    }

    function setupListeners() {
        ui.globalEnable.addEventListener('change', async (e) => {
            await browser.storage.local.set({ isGloballyEnabled: e.target.checked });
            toggleControlsActive();
        });

        ui.siteEnable.addEventListener('change', () => {
            siteSettings.isSiteEnabled = ui.siteEnable.checked;
            saveSiteSettings();
            toggleControlsActive();
        });

        ui.ambilightEnable.addEventListener('change', () => {
            siteSettings.isAmbilightEnabled = ui.ambilightEnable.checked;
            saveSiteSettings();
        });

        ui.cplEnable.addEventListener('change', () => {
            siteSettings.isCplEnabled = ui.cplEnable.checked;
            saveSiteSettings();
        });

        Object.keys(ui.sliders).forEach(key => {
            ui.sliders[key].addEventListener('input', () => {
                const value = ui.sliders[key].value;
                if (ui.inputs[key]) ui.inputs[key].value = value; // Check if input exists
                siteSettings[key] = (key === 'blur') ? parseFloat(value) : parseInt(value, 10);
                if (key === 'nd-filter') updateNdFilterDisplay();
                saveSiteSettings();
            });
            if (ui.inputs[key]) {
                ui.inputs[key].addEventListener('change', () => {
                    let value = (key === 'blur') ? parseFloat(ui.inputs[key].value) : parseInt(ui.inputs[key].value, 10);
                    const max = parseInt(ui.inputs[key].max, 10);
                    if (isNaN(value)) value = defaultSettings[key];
                    if (value > max) value = max;
                    if (value < 0) value = 0;
                    ui.sliders[key].value = value;
                    ui.inputs[key].value = value;
                    siteSettings[key] = value;
                    saveSiteSettings();
                });
            }
        });

        ui.resetButton.addEventListener('click', () => {
            siteSettings = { ...defaultSettings, isSiteEnabled: siteSettings.isSiteEnabled };
            saveSiteSettings();
            updateUIFromSettings();
        });

        ui.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => showTab(e.target.dataset.tab));
        });

        ui.savePresetButton.addEventListener('click', () => {
            const presetName = ui.presetNameInput.value.trim();
            if (presetName) {
                allPresets[presetName] = { ...siteSettings };
                savePresets();
                renderPresets();
                ui.presetNameInput.value = '';
                showToast(`Préréglage "${presetName}" sauvegardé !`);
            } else {
                alert('Veuillez donner un nom au préréglage.');
            }
        });

        ui.presetsList.addEventListener('click', (e) => {
            const presetName = e.target.dataset.presetName;
            if (e.target.classList.contains('apply-preset')) {
                siteSettings = { ...allPresets[presetName] };
                saveSiteSettings();
                updateUIFromSettings();
                showTab('tab-controls');
                showToast(`Préréglage "${presetName}" appliqué !`);
            } else if (e.target.classList.contains('delete-preset')) {
                if (confirm(`Voulez-vous vraiment supprimer le préréglage "${presetName}" ?`)) {
                    delete allPresets[presetName];
                    savePresets();
                    renderPresets();
                }
            }
        });

        ui.selectElementButton.addEventListener('click', async () => {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                browser.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => window.postMessage({ type: 'ACTIVATE_SELECTOR_MODE', mode: 'element' }, '*')
                });
                ui.selectElementButton.textContent = 'Cliquez sur la page...';
                ui.selectElementButton.disabled = true;
            }
        });

        browser.runtime.onMessage.addListener((message) => {
            if (message.type === 'ELEMENT_SELECTED') {
                siteSettings.targetType = 'element';
                siteSettings.targetValue = message.selector;
                saveSiteSettings();
                updateUIFromSettings();
            } else if (message.type === 'AREA_SELECTED') {
                siteSettings.targetType = 'area';
                siteSettings.targetValue = message.coords;
                saveSiteSettings();
                updateUIFromSettings();
            }
            if (message.type.startsWith('SELECTOR_MODE')) { // DEACTIVATED or ACTIVATED
                ui.selectElementButton.textContent = 'Sélectionner un élément';
                ui.selectElementButton.disabled = false;
            }
        });
    }

    init();

    // Custom animation for category toggle
    document.querySelectorAll('.filter-category').forEach(detailsElement => {
        const summaryElement = detailsElement.querySelector('summary');
        const contentDiv = detailsElement.querySelector('div');
        if (!summaryElement || !contentDiv) return;

        // Set initial state for animation
        if (detailsElement.open) {
            contentDiv.style.maxHeight = contentDiv.scrollHeight + 'px';
        } else {
            contentDiv.style.maxHeight = '0px';
        }

        summaryElement.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default toggle behavior

            const duration = 300; // milliseconds
            let startTime = null;

            let startHeight;
            let endHeight;
            let isOpening; // Flag to indicate if we are opening or closing

            if (detailsElement.open) {
                // Currently open, so we are closing
                isOpening = false;
                startHeight = contentDiv.scrollHeight; // Get current height
                endHeight = 0;

                // Ensure the starting height is applied before animation
                contentDiv.style.maxHeight = startHeight + 'px';
                void contentDiv.offsetWidth; // Force reflow
            } else {
                // Currently closed, so we are opening
                isOpening = true;
                detailsElement.setAttribute('open', ''); // Set 'open' attribute immediately
                contentDiv.style.maxHeight = 'none'; // Temporarily remove max-height to get true scrollHeight
                startHeight = 0;
                endHeight = contentDiv.scrollHeight;
                contentDiv.style.maxHeight = '0px'; // Reset for animation start
            }

            function animate(currentTime) {
                if (!startTime) startTime = currentTime;
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);

                // Apply easeOutCubic easing function for a very smooth, non-bouncy effect
                const easeOutCubic = (x) => {
                    return 1 - Math.pow(1 - x, 3);
                };

                const easedProgress = easeOutCubic(progress);

                contentDiv.style.maxHeight = (startHeight + (endHeight - startHeight) * easedProgress) + 'px';

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation finished
                    if (isOpening) {
                        contentDiv.style.maxHeight = '9999px'; // Set to a very large value if open
                    } else {
                        contentDiv.style.maxHeight = '0px'; // Set to 0px if closed
                        detailsElement.removeAttribute('open'); // Remove 'open' attribute after closing
                    }
                }
            }

            requestAnimationFrame(animate);
        });
    });

    // Smooth scroll for user interaction
    let scrollTarget = 0;
    let currentScroll = 0;
    let animationFrameId = null;

    function animateScroll() {
        currentScroll += (scrollTarget - currentScroll) * 0.1; // Adjust 0.1 for more/less smoothness
        window.scrollTo(0, currentScroll);

        if (Math.abs(scrollTarget - currentScroll) > 0.5) {
            animationFrameId = requestAnimationFrame(animateScroll);
        } else {
            window.scrollTo(0, scrollTarget);
            animationFrameId = null;
        }
    }

    window.addEventListener('wheel', (e) => {
        e.preventDefault(); // Prevent default scroll behavior

        scrollTarget += e.deltaY;

        // Clamp scrollTarget to valid scroll range
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(animateScroll);
        }
    }, { passive: false });
});
