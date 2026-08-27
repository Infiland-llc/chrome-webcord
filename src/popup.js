(function () {
  const recordButton = document.getElementById("recordButton");
  const recordTimer = document.getElementById("recordTimer");
  const pauseButton = document.getElementById("pauseButton");
  const cancelButton = document.getElementById("cancelButton");
  const cameraButton = document.getElementById("cameraButton");
  const micButton = document.getElementById("micButton");
  const settingsButton = document.getElementById("settingsButton");
  const settingsMenu = document.getElementById("settingsMenu");
  const recordAreaButtons = [...document.querySelectorAll("[data-record-area]")];
  const aspectField = document.getElementById("aspectField");
  const cropAspectButtons = [...document.querySelectorAll("[data-crop-aspect]")];
  const localeButtons = [...document.querySelectorAll("[data-locale]")];
  const ICONS = {
    record: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>',
    resume: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8,5 19,12 8,19"></polygon></svg>'
  };

  let locale = window.HCR_I18N.detect();
  let timerInterval = 0;
  let timerOrigin = 0;
  let frozenElapsedMs = 0;
  let recordingElsewhere = false;

  function t(key) {
    return window.HCR_I18N.t(locale, key);
  }

  function cameraLabels() {
    return { onLabel: t("hideCamera"), offLabel: t("showCamera") };
  }

  function micLabels() {
    return { onLabel: t("muteMic"), offLabel: t("unmuteMic") };
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "HCR_RECORDING_STATE") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeId = tabs[0]?.id;
        if (message.tabId && activeId && message.tabId !== activeId) {
          recordingElsewhere = Boolean(message.recording);
          applyRecordingLock();
          return;
        }
        if (!message.recording) {
          recordingElsewhere = false;
        }
        applyRecordingState(message);
        applyRecordingLock();
      });
    }
    if (message?.type === "HCR_OVERLAY_STATE") {
      applyOverlayMessage(message);
    }
  });

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes["hcr.recordingTabId"]) {
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeId = tabs[0]?.id;
      const busyTab = Number(changes["hcr.recordingTabId"].newValue) || 0;
      recordingElsewhere = Boolean(busyTab && activeId && busyTab !== activeId);
      applyRecordingLock();
    });
  });

  bindRemoteToggle(cameraButton, "HCR_TOGGLE_OVERLAY", "visible", cameraLabels, "cannotToggleCamera");
  bindRemoteToggle(micButton, "HCR_TOGGLE_MICROPHONE", "recordMicrophone", micLabels, "cannotToggleMic");

  recordButton.addEventListener("click", async () => {
    if (recordButton.disabled) {
      return;
    }
    const recording = recordButton.dataset.recording === "true";
    await sendRecordingCommand(recording ? "HCR_STOP_RECORDING" : "HCR_START_RECORDING");
  });

  pauseButton.addEventListener("click", async () => {
    await sendRecordingCommand("HCR_TOGGLE_PAUSE");
  });

  cancelButton.addEventListener("click", async () => {
    await sendRecordingCommand("HCR_CANCEL_RECORDING");
  });

  settingsButton.addEventListener("click", () => {
    if (settingsButton.disabled) {
      return;
    }
    const open = settingsMenu.hidden;
    settingsMenu.hidden = !open;
    settingsButton.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || isRecordingLocked() || !isRegionSelected()) {
      return;
    }
    event.preventDefault();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.runtime.sendMessage({
        type: "HCR_STEP_BACK_REGION",
        tabId: tabs[0]?.id
      }).then((response) => {
        applyRecordArea(response?.recordArea, response?.cropAspect);
      }).catch(() => undefined);
    });
  });

  recordAreaButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const recordArea = button.dataset.recordArea === "region" ? "region" : "tab";
      button.disabled = true;
      try {
        const tab = await getActiveTab();
        const response = await chrome.runtime.sendMessage({
          type: "HCR_SET_RECORD_AREA",
          recordArea,
          tabId: tab?.id
        });
        if (response?.ok === false) {
          throw new Error(response.error || t("cannotUpdateArea"));
        }
        applyRecordArea(response?.recordArea || recordArea, response?.cropAspect);
      } catch (_error) {
        await syncPopupState();
      } finally {
        button.disabled = isRecordingLocked();
      }
    });
  });

  cropAspectButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.disabled) {
        return;
      }
      const cropAspect = button.dataset.cropAspect || "any";
      button.disabled = true;
      try {
        const tab = await getActiveTab();
        const response = await chrome.runtime.sendMessage({
          type: "HCR_SET_CROP_ASPECT",
          cropAspect,
          tabId: tab?.id
        });
        if (response?.ok === false) {
          throw new Error(response.error || t("cannotUpdateAspect"));
        }
        applyCropAspect(response?.cropAspect || cropAspect);
      } catch (_error) {
        await syncPopupState();
      } finally {
        button.disabled = isRecordingLocked();
      }
    });
  });

  localeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      locale = window.HCR_I18N.normalize(button.dataset.locale);
      applyPopupLocale();
      await window.HCR_I18N.save(locale);
    });
  });

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[window.HCR_I18N.STORAGE_KEY]) {
      return;
    }
    const next = window.HCR_I18N.normalize(changes[window.HCR_I18N.STORAGE_KEY].newValue);
    if (next === locale) {
      return;
    }
    locale = next;
    applyPopupLocale();
  });

  initPopup();

  async function initPopup() {
    applyPopupLocale();
    locale = await window.HCR_I18N.load();
    applyPopupLocale();
    await syncPopupState();
  }

  function bindRemoteToggle(button, type, responseKey, labelsFor, errorKey) {
    button.addEventListener("click", async () => {
      if (button.disabled) {
        return;
      }
      button.disabled = true;
      const labels = labelsFor();
      try {
        const tab = await getActiveTab();
        const response = await chrome.runtime.sendMessage({
          type,
          tabId: tab?.id
        });
        if (response?.ok === false) {
          throw new Error(response.error || t(errorKey));
        }
        setToggle(button, Boolean(response?.[responseKey]), labels.onLabel, labels.offLabel);
      } catch (_error) {
        setToggle(button, button.getAttribute("aria-pressed") === "true", labels.onLabel, labels.offLabel);
      } finally {
        button.disabled = isRecordingLocked();
      }
    });
  }

  async function sendRecordingCommand(type) {
    recordButton.disabled = true;
    pauseButton.disabled = true;
    cancelButton.disabled = true;
    try {
      const tab = await getActiveTab();
      const response = await chrome.runtime.sendMessage({
        type,
        mode: "tab",
        tabId: tab?.id
      });
      if (response?.ok === false) {
        throw new Error(response.error === "recordingElsewhere" ? t("recordingElsewhere") : (response.error || t("cannotUpdateRecording")));
      }
      applyRecordingState(response);
      if (type !== "HCR_GET_OVERLAY_STATE") {
        await syncPopupState();
      }
    } catch (_error) {
      await syncPopupState();
    } finally {
      recordButton.disabled = false;
      pauseButton.disabled = false;
      cancelButton.disabled = false;
    }
    applyRecordingLock();
  }

  async function syncPopupState() {
    try {
      const tab = await getActiveTab();
      const response = await chrome.runtime.sendMessage({
        type: "HCR_GET_OVERLAY_STATE",
        tabId: tab?.id
      });
      recordingElsewhere = Boolean(response?.recordingElsewhere);
      if (response?.ok) {
        setToggle(cameraButton, Boolean(response.visible), cameraLabels().onLabel, cameraLabels().offLabel);
        setToggle(micButton, Boolean(response.recordMicrophone), micLabels().onLabel, micLabels().offLabel);
        applyRecordArea(response.recordArea, response.cropAspect);
        applyRecordingState(response);
        applyRecordingLock();
        return;
      }
    } catch (_error) {
      // Fall back to defaults when the current tab has no overlay yet.
    }

    setToggle(cameraButton, false, cameraLabels().onLabel, cameraLabels().offLabel);
    setToggle(micButton, false, micLabels().onLabel, micLabels().offLabel);
    applyRecordArea("tab", "any");
    applyRecordingState({ recording: false, paused: false, elapsedMs: 0 });
    applyRecordingLock();
  }

  function applyRecordingLock() {
    const locked = recordingElsewhere && recordButton.dataset.recording !== "true";
    recordButton.disabled = locked;
    if (locked) {
      recordButton.title = t("recordingElsewhere");
      recordButton.setAttribute("aria-label", t("recordingElsewhere"));
    }
  }

  function applyOverlayMessage(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (message.tabId && tabs[0]?.id !== message.tabId) {
        return;
      }
      setToggle(cameraButton, Boolean(message.visible), cameraLabels().onLabel, cameraLabels().offLabel);
      setToggle(micButton, Boolean(message.recordMicrophone), micLabels().onLabel, micLabels().offLabel);
      applyRecordArea(message.recordArea, message.cropAspect);
    });
  }

  function applyRecordingState(state = {}) {
    const recording = Boolean(state.recording);
    const paused = Boolean(state.paused);
    const elapsedMs = Number(state.elapsedMs) || 0;

    recordButton.dataset.recording = String(recording);
    recordButton.innerHTML = recording ? ICONS.stop : ICONS.record;
    recordButton.title = recording ? t("stopRecord") : t("record");
    recordButton.setAttribute("aria-label", recording ? t("stopRecord") : t("record"));
    recordTimer.hidden = !recording;
    pauseButton.hidden = !recording;
    cancelButton.hidden = !recording;
    pauseButton.innerHTML = paused ? ICONS.resume : ICONS.pause;
    pauseButton.title = paused ? t("resume") : t("pause");
    pauseButton.setAttribute("aria-label", paused ? t("resume") : t("pause"));
    pauseButton.dataset.paused = String(paused);
    startLocalTimer(elapsedMs, recording, paused);
    lockSideButtons(recording);
    recordAreaButtons.forEach((button) => {
      button.disabled = recording;
    });
    cropAspectButtons.forEach((button) => {
      button.disabled = recording;
    });
    applyRecordingLock();
  }

  function isRecordingLocked() {
    return recordButton.dataset.recording === "true";
  }

  function lockSideButtons(recording) {
    cameraButton.disabled = recording;
    micButton.disabled = recording;
    settingsButton.disabled = recording;
  }

  function applyRecordArea(recordArea, cropAspect) {
    const selected = recordArea === "region" ? "region" : "tab";
    recordAreaButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.recordArea === selected));
    });
    aspectField.hidden = selected !== "region";
    applyCropAspect(cropAspect);
  }

  function isRegionSelected() {
    return recordAreaButtons.some((button) => {
      return button.dataset.recordArea === "region" && button.getAttribute("aria-pressed") === "true";
    });
  }

  function applyCropAspect(cropAspect) {
    const selected = cropAspect && cropAspect !== "any" ? cropAspect : "any";
    cropAspectButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.cropAspect === selected));
    });
  }

  function startLocalTimer(elapsedMs, recording, paused) {
    window.clearInterval(timerInterval);
    frozenElapsedMs = elapsedMs;
    timerOrigin = Date.now() - elapsedMs;
    renderTimer(elapsedMs);

    if (!recording || paused) {
      return;
    }

    timerInterval = window.setInterval(() => {
      renderTimer(Date.now() - timerOrigin);
    }, 250);
  }

  function renderTimer(elapsedMs) {
    recordTimer.textContent = formatClock(elapsedMs);
  }

  function formatClock(elapsedMs) {
    const ms = Number.isFinite(elapsedMs) ? elapsedMs : frozenElapsedMs;
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function applyPopupLocale() {
    window.HCR_I18N.apply(document, locale);
    const recording = recordButton.dataset.recording === "true";
    const paused = pauseButton.dataset.paused === "true";
    recordButton.title = recording ? t("stopRecord") : t("record");
    recordButton.setAttribute("aria-label", recording ? t("stopRecord") : t("record"));
    pauseButton.title = paused ? t("resume") : t("pause");
    pauseButton.setAttribute("aria-label", paused ? t("resume") : t("pause"));
    cancelButton.title = t("cancelRecord");
    cancelButton.setAttribute("aria-label", t("cancelRecord"));
    settingsButton.title = t("settings");
    settingsButton.setAttribute("aria-label", t("settings"));
    setToggle(cameraButton, cameraButton.getAttribute("aria-pressed") === "true", cameraLabels().onLabel, cameraLabels().offLabel);
    setToggle(micButton, micButton.getAttribute("aria-pressed") === "true", micLabels().onLabel, micLabels().offLabel);
    applyRecordingLock();
  }

  function setToggle(button, pressed, onLabel, offLabel) {
    button.setAttribute("aria-pressed", String(pressed));
    const label = pressed ? onLabel : offLabel;
    button.title = label;
    button.setAttribute("aria-label", label);
  }
})();
