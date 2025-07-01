document.addEventListener('DOMContentLoaded', async () => {
    const ui = {
        globalEnable: document.getElementById('global-enable'),
        siteEnable: document.getElementById('site-enable'),
        controlsWrapper: document.getElementById('controls-wrapper'),
        resetButton: document.getElementById('reset-button'),
        sliders: {
            saturation: document.getElementById('saturation'),
            brightness: document.getElementById('brightness'),
            contrast: document.getElementById('contrast'),
            invert: document.getElementById('invert'),
            'hue-rotate': document.getElementById('hue-rotate')
        },
        inputs: {
            saturation: document.getElementById('saturation-input'),
            brightness: document.getElementById('brightness-input'),
            contrast: document.getElementById('contrast-input'),
            invert: document.getElementById('invert-input'),
            'hue-rotate': document.getElementById('hue-rotate-input')
        },
        // New UI elements for tabs and presets
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        presetNameInput: document.getElementById('preset-name-input'),
        savePresetButton: document.getElementById('save-preset-button'),
        presetsList: document.getElementById('presets-list'),
        selectElementButton: document.getElementById('select-element-button'),
        selectAreaButton: document.getElementById('select-area-button'),
        currentTargetDisplay: document.getElementById('current-target-display')
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

    let currentHostname = null;
    let siteSettings = {};
    let allPresets = {}; // Stores all user-defined presets

    // --- Initialisation ---
    async function init() {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        currentHostname = new URL(tab.url).hostname;

        const storage = await browser.storage.local.get(null);
        ui.globalEnable.checked = storage.isGloballyEnabled !== false;
        siteSettings = storage[currentHostname] || { ...defaultSettings };
        allPresets = storage.presets || {};

        updateUIFromSettings();
        renderPresets(); // Display saved presets
        setupListeners();
        showTab('tab-controls'); // Show controls tab by default
    }

    // --- Mise à jour de l'UI ---
    function updateUIFromSettings() {
        ui.siteEnable.checked = siteSettings.isSiteEnabled;
        Object.keys(ui.sliders).forEach(key => {
            const value = siteSettings[key] !== undefined ? siteSettings[key] : defaultSettings[key];
            ui.sliders[key].value = value;
            ui.inputs[key].value = value;
        });
        // Update target display based on targetType
        if (siteSettings.targetType === 'element') {
            ui.currentTargetDisplay.textContent = siteSettings.targetValue;
        } else if (siteSettings.targetType === 'area') {
            ui.currentTargetDisplay.textContent = `Zone: ${siteSettings.targetValue.x},${siteSettings.targetValue.y} - ${siteSettings.targetValue.width}x${siteSettings.targetValue.height}`;
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

    // --- Sauvegarde ---
    async function saveSiteSettings() {
        const newSettings = { ...siteSettings };
        await browser.storage.local.set({ [currentHostname]: newSettings });
    }

    async function savePresets() {
        await browser.storage.local.set({ presets: allPresets });
    }

    // --- Gestion des onglets ---
    function showTab(tabId) {
        ui.tabContents.forEach(content => {
            content.classList.remove('active');
        });
        ui.tabButtons.forEach(button => {
            button.classList.remove('active');
        });

        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
    }

    // --- Gestion des préréglages ---
    function renderPresets() {
        ui.presetsList.innerHTML = '';
        for (const name in allPresets) {
            const presetItem = document.createElement('div');
            presetItem.classList.add('preset-item');

            const presetNameSpan = document.createElement('span');
            presetNameSpan.textContent = name;
            presetItem.appendChild(presetNameSpan);

            const presetActionsDiv = document.createElement('div');
            presetActionsDiv.classList.add('preset-actions');

            const applyButton = document.createElement('button');
            applyButton.classList.add('apply-preset');
            applyButton.dataset.presetName = name;
            applyButton.textContent = 'Appliquer';
            presetActionsDiv.appendChild(applyButton);

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-preset', 'delete-button');
            deleteButton.dataset.presetName = name;
            deleteButton.textContent = 'Supprimer';
            presetActionsDiv.appendChild(deleteButton);

            presetItem.appendChild(presetActionsDiv);
            ui.presetsList.appendChild(presetItem);
        }
    }

    // --- Écouteurs d'événements ---
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

        Object.keys(ui.sliders).forEach(key => {
            ui.sliders[key].addEventListener('input', () => {
                const value = ui.sliders[key].value;
                ui.inputs[key].value = value;
                siteSettings[key] = parseInt(value, 10);
                saveSiteSettings();
            });

            ui.inputs[key].addEventListener('change', () => {
                let value = parseInt(ui.inputs[key].value, 10);
                const max = parseInt(ui.inputs[key].max, 10);
                if (isNaN(value)) value = defaultSettings[key];
                if (value > max) value = max;
                if (value < 0) value = 0;
                
                ui.sliders[key].value = value;
                ui.inputs[key].value = value;
                siteSettings[key] = value;
                saveSiteSettings();
            });
        });

        ui.resetButton.addEventListener('click', () => {
            siteSettings = { ...defaultSettings };
            saveSiteSettings();
            updateUIFromSettings();
        });

        // Tab listeners
        ui.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                showTab(e.target.dataset.tab);
            });
        });

        // Preset listeners
        ui.savePresetButton.addEventListener('click', () => {
            const presetName = ui.presetNameInput.value.trim();
            if (presetName) {
                allPresets[presetName] = { ...siteSettings }; // Save current site settings as a preset
                savePresets();
                renderPresets();
                ui.presetNameInput.value = '';
            } else {
                alert('Veuillez donner un nom au préréglage.');
            }
        });

        ui.presetsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('apply-preset')) {
                const presetName = e.target.dataset.presetName;
                siteSettings = { ...allPresets[presetName] }; // Load preset settings
                saveSiteSettings();
                updateUIFromSettings();
                showTab('tab-controls'); // Switch back to controls tab
            } else if (e.target.classList.contains('delete-preset')) {
                const presetName = e.target.dataset.presetName;
                if (confirm(`Voulez-vous vraiment supprimer le préréglage "${presetName}" ?`)) {
                    delete allPresets[presetName];
                    savePresets();
                    renderPresets();
                }
            }
        });

        // Selector mode listener (element)
        ui.selectElementButton.addEventListener('click', async () => {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                browser.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        window.postMessage({ type: 'ACTIVATE_SELECTOR_MODE', mode: 'element' }, '*');
                    }
                });
                ui.selectElementButton.textContent = 'Cliquez sur la page...';
                ui.selectElementButton.disabled = true;
                ui.selectAreaButton.disabled = true; // Disable other selector button
            }
        });

        // Selector mode listener (area)
        ui.selectAreaButton.addEventListener('click', async () => {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                browser.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        window.postMessage({ type: 'ACTIVATE_SELECTOR_MODE', mode: 'area' }, '*');
                    }
                });
                ui.selectAreaButton.textContent = 'Dessinez une zone...';
                ui.selectAreaButton.disabled = true;
                ui.selectElementButton.disabled = true; // Disable other selector button
            }
        });

        // Listen for messages from content script
        browser.runtime.onMessage.addListener((message) => {
            if (message.type === 'ELEMENT_SELECTED') {
                siteSettings.targetType = 'element';
                siteSettings.targetValue = message.selector;
                saveSiteSettings();
                updateUIFromSettings();
                ui.selectElementButton.textContent = 'Sélectionner un élément';
                ui.selectElementButton.disabled = false;
                ui.selectAreaButton.disabled = false;
            } else if (message.type === 'AREA_SELECTED') {
                siteSettings.targetType = 'area';
                siteSettings.targetValue = message.coords;
                saveSiteSettings();
                updateUIFromSettings();
                ui.selectAreaButton.textContent = 'Sélectionner une zone';
                ui.selectAreaButton.disabled = false;
                ui.selectElementButton.disabled = false;
            } else if (message.type === 'SELECTOR_MODE_DEACTIVATED') {
                ui.selectElementButton.textContent = 'Sélectionner un élément';
                ui.selectElementButton.disabled = false;
                ui.selectAreaButton.textContent = 'Sélectionner une zone';
                ui.selectAreaButton.disabled = false;
            }
        });
    }

    init();
});
