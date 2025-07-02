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
        ndFilterDisplay: document.getElementById('nd-filter-display')
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
        ui.tabContents.forEach(content => content.classList.remove('active'));
        ui.tabButtons.forEach(button => button.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
    }

    function renderPresets() {
        ui.presetsList.innerHTML = '';
        for (const name in allPresets) {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.innerHTML = `
                <span>${name}</span>
                <div class="preset-actions">
                    <button class="apply-preset" data-preset-name="${name}">Appliquer</button>
                    <button class="delete-preset delete-button" data-preset-name="${name}">Supprimer</button>
                </div>
            `;
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
                siteSettings[key] = (key === 'blur' || key === 'motion-blur') ? parseFloat(value) : parseInt(value, 10);
                if (key === 'nd-filter') updateNdFilterDisplay();
                saveSiteSettings();
            });
            if (ui.inputs[key]) {
                ui.inputs[key].addEventListener('change', () => {
                    let value = (key === 'blur' || key === 'motion-blur') ? parseFloat(ui.inputs[key].value) : parseInt(ui.inputs[key].value, 10);
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
});
