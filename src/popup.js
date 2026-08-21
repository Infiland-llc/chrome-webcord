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
  const ICONS = {
    record: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>',
    resume: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8,5 19,12 8,19"></polygon></svg>'
  };
  const cameraLabels = {
    onLabel: "隐藏摄像头",
    offLabel: "显示摄像头"
  };
  const micLabels = {
    onLabel: "关闭麦克风",
    offLabel: "开启麦克风"
  };

  let timerInterval = 0;
  let timerOrigin = 0;
  let frozenElapsedMs = 0;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "HCR_RECORDING_STATE") {
      applyRecordingState(message);
    }
  });

  bindRemoteToggle(cameraButton, "HCR_TOGGLE_OVERLAY", "visible", cameraLabels, "无法切换摄像头。");
  bindRemoteToggle(micButton, "HCR_TOGGLE_MICROPHONE", "recordMicrophone", micLabels, "无法切换麦克风。");

  recordButton.addEventListener("click", async () => {
    const recording = recordButton.dataset.recording === "true";
    await sendRecordingCommand(recording ? "HCR_PANEL_STOP" : "HCR_PANEL_START");
  });

  pauseButton.addEventListener("click", async () => {
    await sendRecordingCommand("HCR_TOGGLE_PAUSE");
  });

  cancelButton.addEventListener("click", async () => {
    await sendRecordingCommand("HCR_PANEL_CANCEL");
  });

  settingsButton.addEventListener("click", () => {
    const open = settingsMenu.hidden;
    settingsMenu.hidden = !open;
    settingsButton.setAttribute("aria-expanded", String(open));
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
          throw new Error(response.error || "无法更新录制范围。");
        }
        applyRecordArea(response?.recordArea || recordArea);
        if (recordArea === "region") {
          window.close();
        }
      } catch (_error) {
        await syncPopupState();
      } finally {
        button.disabled = false;
      }
    });
  });

  syncPopupState();

  function bindRemoteToggle(button, type, responseKey, labels, errorText) {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const tab = await getActiveTab();
        const response = await chrome.runtime.sendMessage({
          type,
          tabId: tab?.id
        });
        if (response?.ok === false) {
          throw new Error(response.error || errorText);
        }
        setToggle(button, Boolean(response?.[responseKey]), labels.onLabel, labels.offLabel);
      } catch (_error) {
        setToggle(button, button.getAttribute("aria-pressed") === "true", labels.onLabel, labels.offLabel);
      } finally {
        button.disabled = false;
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
        throw new Error(response.error || "无法更新录制状态。");
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
  }

  async function syncPopupState() {
    try {
      const tab = await getActiveTab();
      const response = await chrome.runtime.sendMessage({
        type: "HCR_GET_OVERLAY_STATE",
        tabId: tab?.id
      });
      if (response?.ok) {
        setToggle(cameraButton, Boolean(response.visible), cameraLabels.onLabel, cameraLabels.offLabel);
        setToggle(micButton, response.recordMicrophone !== false, micLabels.onLabel, micLabels.offLabel);
        applyRecordArea(response.recordArea);
        applyRecordingState(response);
        return;
      }
    } catch (_error) {
      // Fall back to the last stored overlay visibility.
    }

    const stored = await chrome.storage.local.get("hcr.overlay");
    setToggle(cameraButton, stored["hcr.overlay"]?.visible !== false, cameraLabels.onLabel, cameraLabels.offLabel);
    setToggle(micButton, stored["hcr.overlay"]?.recordMicrophone !== false, micLabels.onLabel, micLabels.offLabel);
    applyRecordArea(stored["hcr.overlay"]?.recordArea);
    applyRecordingState({ recording: false, paused: false, elapsedMs: 0 });
  }

  function applyRecordingState(state = {}) {
    const recording = Boolean(state.recording);
    const paused = Boolean(state.paused);
    const elapsedMs = Number(state.elapsedMs) || 0;

    recordButton.dataset.recording = String(recording);
    recordButton.innerHTML = recording ? ICONS.stop : ICONS.record;
    recordButton.title = recording ? "停止录制" : "录制";
    recordButton.setAttribute("aria-label", recording ? "停止录制" : "录制");
    recordTimer.hidden = !recording;
    pauseButton.hidden = !recording;
    cancelButton.hidden = !recording;
    pauseButton.innerHTML = paused ? ICONS.resume : ICONS.pause;
    pauseButton.title = paused ? "继续录制" : "暂停";
    pauseButton.setAttribute("aria-label", paused ? "继续录制" : "暂停");
    pauseButton.dataset.paused = String(paused);
    startLocalTimer(elapsedMs, recording, paused);
    recordAreaButtons.forEach((button) => {
      button.disabled = recording;
    });
  }

  function applyRecordArea(recordArea) {
    const selected = recordArea === "region" ? "region" : "tab";
    recordAreaButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.recordArea === selected));
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

  function setToggle(button, pressed, onLabel, offLabel) {
    button.setAttribute("aria-pressed", String(pressed));
    const label = pressed ? onLabel : offLabel;
    button.title = label;
    button.setAttribute("aria-label", label);
  }
})();
