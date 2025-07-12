document.addEventListener('DOMContentLoaded', () => {
  function settings() {
    browser.runtime.openOptionsPage().catch((error) => {
      console.error('Error opening options page:', error);
    });
  }
  
  document.getElementById('settings').addEventListener('click', settings);

  // Add message listener for exclusion messages
  const browserApi = (typeof browser !== 'undefined') ? browser : chrome;
  browserApi.runtime.onMessage.addListener((message) => {
    if (message.type === "exclusion") {
      showError({ type: "exclusion" });
    }
  });
});

function listenForEvents() {
  const browserApi = (typeof browser !== 'undefined') ? browser : chrome;
  
  browserApi.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs[0].url) {
        browserApi.tabs.sendMessage(tabs[0].id, { command: "checkExclusion" })
          .catch(() => {
            // If the site is excluded, show the exclusion message
            showError({ type: "exclusion" });
          });
      }
    });

  let currentVolume = 0;

  function err(error) {
    console.error(`Volume Control: Error: ${error}`);
  }

  function formatValue(dB) {
    return `${dB >= 0 ? '+' : ''}${dB} dB`;
  }

  function setVolume(dB) {
    const slider = document.querySelector("#volume-slider");
    const text = document.querySelector("#volume-text");
    slider.value = dB;
    text.value = formatValue(dB);
    currentVolume = dB;
    browserApi.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        browserApi.tabs.sendMessage(tabs[0].id, { command: "setVolume", dB })
          .catch(err);
      })
      .catch(err);
  }

  function updateVolume() {
    const slider = document.querySelector("#volume-slider");
    const text = document.querySelector("#volume-text");
    text.value = formatValue(slider.value);
  }

  function updateVolumeFromText() {
    const text = document.querySelector("#volume-text");
    const dB = text.value.match(/-?\d+/)?.[0];
    if (dB !== undefined) {
      const slider = document.querySelector("#volume-slider");
      slider.value = dB;
      updateVolume();
      setVolume(dB);
      text.setSelectionRange(text.selectionStart, text.selectionEnd);
    }
  }

  function updateVolumeFromSlider() {
    const slider = document.querySelector("#volume-slider");
    updateVolume();
    setVolume(slider.value);
  }

  function toggleMono() {
    const monoCheckbox = document.querySelector("#mono-checkbox");
    const mono = monoCheckbox.checked;
    browserApi.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        browserApi.tabs.sendMessage(tabs[0].id, { command: "setMono", mono })
          .catch(err);
      })
      .catch(err);
  }

  function handleInputChange(event) {
    if (event.target.id === "volume-text") {
      updateVolumeFromText();
    } else if (event.target.id === "volume-slider") {
      updateVolumeFromSlider();
    } else if (event.target.id === "mono-checkbox") {
      toggleMono();
    }
  }

  function showError(error) {
    const popupContent = document.querySelector("#popup-content");
    const errorContent = document.querySelector("#error-content");
    const exclusionMessage = document.querySelector(".exclusion-message");
    const topControls = document.querySelector(".top-controls");
    const leftControls = document.querySelector(".left");
    
    if (error.type === "exclusion") {
      // Show exclusion message and hide controls
      exclusionMessage.classList.remove("hidden");
      topControls.classList.add("hidden");
      leftControls.classList.add("hidden");
      document.body.classList.add("excluded-site");
    } else {
      popupContent.classList.add("hidden");
      errorContent.classList.remove("hidden");
      errorContent.querySelector("p").textContent = error.message || "An error occurred";
    }
    console.error(`Volume Control: Error: ${error.message || error}`);
  }

  browserApi.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs.length === 0) {
        showError("No audio playing.");
        return;
      }
      const volumeSlider = document.querySelector("#volume-slider");
      const volumeText = document.querySelector("#volume-text");
      const monoCheckbox = document.querySelector("#mono-checkbox");

      volumeSlider.addEventListener("input", updateVolumeFromSlider);
      volumeSlider.addEventListener("change", updateVolumeFromSlider);
      volumeText.addEventListener("input", updateVolumeFromText);
      monoCheckbox.addEventListener("change", toggleMono);
      document.addEventListener("change", handleInputChange);

      volumeSlider.focus();
      browserApi.tabs.sendMessage(tabs[0].id, { command: "getVolume" })
        .then((response) => {
          if (response && response.response !== undefined) {
            currentVolume = response.response;
            setVolume(currentVolume);
          } else {
            showError("Failed to get volume information.");
          }
        })
        .catch(err);
      browserApi.tabs.sendMessage(tabs[0].id, { command: "getMono" })
        .then((response) => {
          if (response && response.response !== undefined) {
            monoCheckbox.checked = response.response;
          } else {
            showError("Failed to get mono information.");
          }
        })
        .catch(err);
    })
    .catch(showError);

  browserApi.runtime.onMessage.addListener((message) => {
    if (message.type === "exclusion") {
      showError({ type: "exclusion" });
    }
  });
}

document.addEventListener("DOMContentLoaded", listenForEvents);
