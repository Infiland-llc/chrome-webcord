(function () {
  if (window.__HTML_CAMERA_RECORDER__) {
    return;
  }
  window.__HTML_CAMERA_RECORDER__ = true;

  const STORAGE_KEY = "hcr.overlay";
  const MIN_CROP_SIZE = 40;
  const CROP_ASPECT_VALUES = {
    "16:9": 16 / 9,
    "4:3": 4 / 3,
    "1:1": 1,
    "3:4": 3 / 4,
    "9:16": 9 / 16
  };
  const DEFAULT_STATE = {
    visible: false,
    x: 24,
    y: 96,
    width: 240,
    height: 240,
    shape: "square",
    borderWidth: 0,
    borderColor: "#ffffff",
    recordArea: "tab",
    recordMicrophone: false,
    cropRect: null,
    cropAspect: "any",
    prompter: {
      visible: false,
      x: 24,
      y: 320,
      width: 380,
      height: 260,
      opacity: 72,
      text: "在这里输入提词内容。"
    }
  };

  const ICONS = {
    record: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>',
    resume: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8,5 19,12 8,19"></polygon></svg>',
    cancel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4C7.58 4 4.01 7.58 4.01 12S7.58 20 12 20c3.73 0 6.84-2.55 7.73-6h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"></path></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l4.5-2.5v9L15 14"></path><rect x="3" y="6" width="12" height="12" rx="2"></rect></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path></svg>',
    tab: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 9h16"></path><circle cx="7" cy="7" r="0.7" fill="currentColor" stroke="none"></circle><circle cx="9.5" cy="7" r="0.7" fill="currentColor" stroke="none"></circle><circle cx="12" cy="7" r="0.7" fill="currentColor" stroke="none"></circle></svg>',
    region: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" stroke-dasharray="3 2"></rect></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.03.03a2 2 0 1 1-2.83 2.83l-.03-.03A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .58V20a2 2 0 1 1-4 0v-.05a1.7 1.7 0 0 0-1-.58 1.7 1.7 0 0 0-1.88.34l-.03.03a2 2 0 1 1-2.83-2.83l.03-.03A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-.58-1H4a2 2 0 1 1 0-4h.05a1.7 1.7 0 0 0 .58-1 1.7 1.7 0 0 0-.34-1.88l-.03-.03a2 2 0 1 1 2.83-2.83l.03.03A1.7 1.7 0 0 0 9 4.63c.34-.12.68-.32 1-.58V4a2 2 0 1 1 4 0v.05c.32.26.66.46 1 .58a1.7 1.7 0 0 0 1.88-.34l.03-.03a2 2 0 1 1 2.83 2.83l-.03.03A1.7 1.7 0 0 0 19.37 9c.12.34.32.68.58 1H20a2 2 0 1 1 0 4h-.05c-.26.32-.46.66-.55 1Z"></path></svg>',
    square: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4"></rect></svg>',
    circle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle></svg>'
  };

  let state = { ...DEFAULT_STATE };
  let host;
  let shadow;
  let video;
  let placeholder;
  let statusEl;
  let recordDot;
  let recordButton;
  let borderWidthInput;
  let borderColorInput;
  let settingsPanel;
  let previewFrame;
  let prompterHost;
  let promptTextEl;
  let prompterOpacityInput;
  let regionMaskHost;
  let regionMaskShadow;
  let regionDockTimer = 0;
  let regionDockSettingsOpen = false;
  let cameraStream;
  let microphoneStream;
  let displayStream;
  let mixedStream;
  let audioContext;
  let audioDestination;
  let microphoneGain;
  let microphoneConnected = false;
  let audioNodes = [];
  let cropFrameId = 0;
  let cropFrameFromVideo = false;
  let cropCanvas;
  let cropVideo;
  let cropTargetEl;
  let mediaRecorder;
  let chunks = [];
  let recordingMime = "";
  let recordingElapsedMs = 0;
  let recordingTickStartedAt = 0;
  let recordingPaused = false;
  let discardRecording = false;
  let finishingRecording = false;
  let downloadToastTimer = 0;
  let pageUnloading = false;
  let ownTabId = null;
  let recordingTabId = null;
  const RECORDING_TAB_KEY = "hcr.recordingTabId";
  let locale = window.HCR_I18N?.detect?.() || "en";

  boot();

  async function boot() {
    locale = await loadLocale();
    const stored = readStoredState();
    state = { ...DEFAULT_STATE, ...stored };
    state.shape = stored.shape === "circle" ? "circle" : "square";
    state.visible = DEFAULT_STATE.visible;
    state.recordMicrophone = DEFAULT_STATE.recordMicrophone;
    state.recordArea = DEFAULT_STATE.recordArea;
    state.cropRect = DEFAULT_STATE.cropRect;
    state.cropAspect = DEFAULT_STATE.cropAspect;
    state.prompter = { ...DEFAULT_STATE.prompter, ...(stored.prompter || {}), visible: false };
    buildOverlay();
    buildPrompter();
    applyState();
    applyPrompterState();
    applyLocale();
    bindChromeMessages();
    bindLocaleStorage();
    bindRecordingLock();
    syncCameraPreview();
  }

  function t(key) {
    return window.HCR_I18N ? window.HCR_I18N.t(locale, key) : key;
  }

  async function loadLocale() {
    if (window.HCR_I18N?.load) {
      return window.HCR_I18N.load();
    }
    return window.HCR_I18N?.detect?.() || "en";
  }

  async function setLocale(next) {
    locale = window.HCR_I18N ? window.HCR_I18N.normalize(next) : locale;
    applyLocale();
    if (window.HCR_I18N?.save) {
      await window.HCR_I18N.save(locale);
    }
  }

  function applyLocale() {
    if (window.HCR_I18N?.apply) {
      if (shadow) {
        window.HCR_I18N.apply(shadow, locale);
      }
      if (prompterHost?.shadowRoot) {
        window.HCR_I18N.apply(prompterHost.shadowRoot, locale);
      }
      if (regionMaskShadow) {
        window.HCR_I18N.apply(regionMaskShadow, locale);
      }
    }
    applyDefaultPrompterText();
    refreshOverlayChrome();
    if (state.cropRect) {
      updateRegionDock(state.cropRect);
    }
  }

  function applyDefaultPrompterText() {
    if (!window.HCR_I18N) {
      return;
    }
    const defaults = new Set([
      window.HCR_I18N.t("zh", "prompterPlaceholder"),
      window.HCR_I18N.t("en", "prompterPlaceholder")
    ]);
    if (!defaults.has(state.prompter.text)) {
      return;
    }
    const next = t("prompterPlaceholder");
    if (state.prompter.text === next) {
      return;
    }
    state.prompter.text = next;
    applyPrompterState();
    persistState();
  }

  function refreshOverlayChrome() {
    if (!shadow || !recordButton) {
      return;
    }
    const recording = isRecorderLive();
    const locked = isRecordingElsewhere();
    recordButton.disabled = locked && !recording;
    recordButton.title = locked && !recording ? t("recordingElsewhere") : (recording ? t("stopRecord") : t("startRecord"));
    recordButton.setAttribute("aria-label", recordButton.title);
    if (placeholder && !placeholder.hidden) {
      const key = placeholder.getAttribute("data-i18n") || "openingCamera";
      placeholder.textContent = t(key);
    }
  }

  function isRecordingElsewhere() {
    return Boolean(recordingTabId && ownTabId && recordingTabId !== ownTabId);
  }

  function bindRecordingLock() {
    loadRecordingLock();
    try {
      chrome.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[RECORDING_TAB_KEY]) {
          return;
        }
        recordingTabId = Number(changes[RECORDING_TAB_KEY].newValue) || null;
        applyRecordingLock();
      });
    } catch (_error) {
      // storage may be unavailable in tests.
    }
  }

  function loadRecordingLock() {
    try {
      chrome.runtime.sendMessage({ type: "HCR_GET_RECORDING_LOCK" }, (response) => {
        if (chrome.runtime.lastError) {
          applyRecordingLock();
          return;
        }
        ownTabId = Number(response?.tabId) || null;
        recordingTabId = Number(response?.recordingTabId) || null;
        applyRecordingLock();
      });
    } catch (_error) {
      applyRecordingLock();
    }
  }

  function applyRecordingLock() {
    refreshOverlayChrome();
    if (state.cropRect) {
      updateRegionDock(state.cropRect);
    }
  }

  function bindLocaleStorage() {
    try {
      chrome.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[window.HCR_I18N.STORAGE_KEY]) {
          return;
        }
        const next = window.HCR_I18N.normalize(changes[window.HCR_I18N.STORAGE_KEY].newValue);
        if (next === locale) {
          return;
        }
        locale = next;
        applyLocale();
      });
    } catch (_error) {
      // storage may be unavailable in tests.
    }
  }

  function bindLocaleButtons(root) {
    root.querySelectorAll("[data-locale]").forEach((button) => {
      button.addEventListener("click", () => {
        setLocale(button.dataset.locale);
      });
    });
  }

  function buildOverlay() {
    host = document.createElement("html-camera-recorder");
    shadow = host.attachShadow({ mode: "open" });

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("src/content.css");

    const panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="toolbar">
        <button class="icon-button record-button" type="button" title="开始录制" aria-label="开始录制">${ICONS.record}</button>
        <button class="icon-button settings-button" type="button" title="调整蒙版" aria-label="调整蒙版" data-i18n-title="adjustMask">${ICONS.settings}</button>
      </div>
      <div class="preview-frame" data-shape="square" title="拖拽移动摄像头浮窗" data-i18n-title="dragCamera">
        <video autoplay muted playsinline></video>
        <div class="placeholder" data-i18n="openingCamera">正在开启摄像头...</div>
        <div class="record-dot" hidden></div>
        <div class="status"></div>
      </div>
      <form class="settings" hidden>
        <div class="field">
          <span data-i18n="shape">形状</span>
          <div class="segmented" role="group" data-i18n-aria="shape">
            <button type="button" data-shape="square">${ICONS.square}<span data-i18n="square">方形</span></button>
            <button type="button" data-shape="circle">${ICONS.circle}<span data-i18n="circle">圆形</span></button>
          </div>
        </div>
        <label class="field">
          <span data-i18n="border">边框</span>
          <input class="border-width-input" type="range" min="0" max="12" step="1" value="0">
        </label>
        <label class="field border-color-field">
          <span data-i18n="borderColor">边框颜色</span>
          <input class="border-color-input" type="color" value="#ffffff">
        </label>
      </form>
      <div class="resize-handle" title="拖拽调整大小" data-i18n-title="resize"></div>
    `;

    shadow.append(stylesheet, panel);
    document.documentElement.appendChild(host);

    video = shadow.querySelector("video");
    placeholder = shadow.querySelector(".placeholder");
    statusEl = shadow.querySelector(".status");
    recordDot = shadow.querySelector(".record-dot");
    recordButton = shadow.querySelector(".record-button");
    borderWidthInput = shadow.querySelector(".border-width-input");
    borderColorInput = shadow.querySelector(".border-color-input");
    settingsPanel = shadow.querySelector(".settings");
    previewFrame = shadow.querySelector(".preview-frame");
    const settingsButton = shadow.querySelector(".settings-button");

    settingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      settingsPanel.hidden = !settingsPanel.hidden;
    });
    document.addEventListener("pointerdown", (event) => {
      if (settingsPanel.hidden) {
        return;
      }
      const path = event.composedPath();
      if (path.includes(settingsPanel) || path.includes(settingsButton)) {
        return;
      }
      settingsPanel.hidden = true;
    }, true);
    recordButton.addEventListener("click", toggleRecording);
    previewFrame.addEventListener("dblclick", () => {
      if (isRecorderLive()) {
        stopRecording();
      }
    });
    borderWidthInput.addEventListener("input", () => {
      state.borderWidth = Number(borderWidthInput.value);
      applyState();
      persistState();
    });
    borderColorInput.addEventListener("input", () => {
      state.borderColor = borderColorInput.value;
      applyState();
      persistState();
    });

    shadow.querySelectorAll("[data-shape]").forEach((button) => {
      button.addEventListener("click", () => {
        state.shape = button.dataset.shape === "circle" ? "circle" : "square";
        applyState();
        persistState();
      });
    });

    bindDrag(previewFrame);
    bindResize(shadow.querySelector(".resize-handle"));
  }

  function buildPrompter() {
    prompterHost = document.createElement("html-camera-prompter");
    prompterHost.setAttribute("data-role", "prompter");
    const prompterShadow = prompterHost.attachShadow({ mode: "open" });

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("src/content.css");

    const panel = document.createElement("section");
    panel.className = "prompter";
    panel.innerHTML = `
      <div class="prompter-handle" data-prompter-drag>
        <strong data-i18n="prompterTitle">题词板</strong>
        <span data-i18n="prompterDrag">拖动这里移动</span>
      </div>
      <label class="field">
        <span data-i18n="opacity">透明度</span>
        <input class="prompter-opacity" type="range" min="20" max="100" step="1" value="72">
      </label>
      <textarea class="prompter-text" spellcheck="false"></textarea>
      <div class="button-row">
        <button class="copy-prompt" type="button" data-i18n="copyText">复制文本</button>
        <button class="clear-prompt" type="button" data-i18n="clear">清空</button>
      </div>
      <div class="prompter-resize" title="拖拽调整大小" data-i18n-title="prompterResize"></div>
    `;

    prompterShadow.append(stylesheet, panel);
    prompterHost.hidden = true;
    document.documentElement.appendChild(prompterHost);

    promptTextEl = prompterShadow.querySelector(".prompter-text");
    prompterOpacityInput = prompterShadow.querySelector(".prompter-opacity");

    promptTextEl.addEventListener("input", () => {
      state.prompter.text = promptTextEl.value;
      persistState();
    });
    prompterOpacityInput.addEventListener("input", () => {
      state.prompter.opacity = Number(prompterOpacityInput.value);
      applyPrompterState();
      persistState();
    });
    prompterShadow.querySelector(".copy-prompt").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(promptTextEl.value);
      } catch (_error) {
        promptTextEl.select();
        document.execCommand("copy");
      }
    });
    prompterShadow.querySelector(".clear-prompt").addEventListener("click", () => {
      promptTextEl.value = "";
      state.prompter.text = "";
      persistState();
    });

    bindPrompterDrag(prompterShadow.querySelector("[data-prompter-drag]"));
    bindPrompterResize(prompterShadow.querySelector(".prompter-resize"));
  }

  function bindPrompterDrag(handle) {
    let start = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) {
        return;
      }
      start = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: state.prompter.x,
        y: state.prompter.y
      };
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      state.prompter.x = clamp(start.x + event.clientX - start.pointerX, 0, Math.max(0, window.innerWidth - state.prompter.width));
      state.prompter.y = clamp(start.y + event.clientY - start.pointerY, 0, Math.max(0, window.innerHeight - state.prompter.height));
      applyPrompterState();
    });

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);

    function finish(event) {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      start = null;
      persistState();
    }
  }

  function bindPrompterResize(handle) {
    let start = null;

    handle.addEventListener("pointerdown", (event) => {
      start = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        width: state.prompter.width,
        height: state.prompter.height
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      state.prompter.width = clamp(start.width + event.clientX - start.pointerX, 280, window.innerWidth);
      state.prompter.height = clamp(start.height + event.clientY - start.pointerY, 180, window.innerHeight);
      constrainPrompterToViewport();
      applyPrompterState();
    });

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);

    function finish(event) {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      start = null;
      persistState();
    }
  }

  function bindDrag(handle) {
    let start = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button") || host.hasAttribute("recording")) {
        return;
      }
      start = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: state.x,
        y: state.y
      };
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      state.x = clamp(start.x + event.clientX - start.pointerX, 0, Math.max(0, window.innerWidth - state.width));
      state.y = clamp(start.y + event.clientY - start.pointerY, 0, Math.max(0, window.innerHeight - state.height));
      applyState();
    });

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);

    function finish(event) {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      start = null;
      persistState();
    }
  }

  function bindResize(handle) {
    let start = null;

    handle.addEventListener("pointerdown", (event) => {
      start = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        size: Math.max(state.width, state.height)
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      const delta = Math.max(event.clientX - start.pointerX, event.clientY - start.pointerY);
      const size = start.size + delta;
      state.width = size;
      state.height = size;
      constrainToViewport();
      applyState();
    });

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);

    function finish(event) {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      start = null;
      persistState();
    }
  }

  function setRecordArea(recordArea) {
    if (isRecorderLive()) {
      return {
        ok: false,
        error: t("cannotChangeAreaWhileRecording"),
        recordArea: state.recordArea === "region" ? "region" : "tab",
        cropAspect: normalizeCropAspect(state.cropAspect)
      };
    }

    if (recordArea === "region") {
      state.recordArea = "region";
      beginRegionSelection();
      return { ok: true, recordArea: "region", cropAspect: normalizeCropAspect(state.cropAspect) };
    }

    state.recordArea = "tab";
    state.cropRect = null;
    removeRegionSelectionLayer();
    applyState();
    persistState();
    return { ok: true, recordArea: "tab", cropAspect: normalizeCropAspect(state.cropAspect) };
  }

  function removeRegionSelectionLayer() {
    document.querySelector("[data-hcr-region-select]")?.remove();
  }

  function isRegionSelecting() {
    return Boolean(document.querySelector("[data-hcr-region-select]"));
  }

  function hasCropRect() {
    return Boolean(state.cropRect && state.cropRect.width > 0 && state.cropRect.height > 0);
  }

  function stepBackRegionSelection() {
    if (isRecorderLive() || state.recordArea !== "region") {
      return {
        ok: true,
        recordArea: state.recordArea === "region" ? "region" : "tab",
        cropAspect: normalizeCropAspect(state.cropAspect)
      };
    }

    if (hasCropRect() && !isRegionSelecting()) {
      state.cropRect = null;
      applyState();
      persistState();
      beginRegionSelection();
      return {
        ok: true,
        recordArea: "region",
        cropAspect: normalizeCropAspect(state.cropAspect)
      };
    }

    const result = setRecordArea("tab");
    setStatus(t("regionCancelled"));
    return result;
  }

  function setCropAspect(cropAspect) {
    if (isRecorderLive()) {
      return {
        ok: false,
        error: t("cannotChangeAspectWhileRecording"),
        recordArea: state.recordArea === "region" ? "region" : "tab",
        cropAspect: normalizeCropAspect(state.cropAspect)
      };
    }

    state.cropAspect = normalizeCropAspect(cropAspect);
    const ratio = getCropAspectRatio();
    if (state.cropRect && ratio) {
      state.cropRect = snapCropRectToAspect(state.cropRect, ratio);
    }
    applyState();
    persistState();
    return {
      ok: true,
      recordArea: state.recordArea === "region" ? "region" : "tab",
      cropAspect: state.cropAspect
    };
  }

  function beginRegionSelection() {
    if (isRegionLocked()) {
      return;
    }

    removeRegionSelectionLayer();
    if (regionMaskHost) {
      regionMaskHost.hidden = true;
    }

    const layer = document.createElement("div");
    const box = document.createElement("div");
    let start = null;

    layer.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "cursor:crosshair",
      "background:rgba(15,23,42,0.18)"
    ].join(";");
    box.style.cssText = [
      "position:fixed",
      "display:none",
      "border:2px dashed #374151",
      "background:transparent",
      "box-shadow:0 0 0 9999px rgba(15,23,42,0.22)",
      "pointer-events:none"
    ].join(";");

    layer.setAttribute("data-hcr-region-select", "");
    layer.tabIndex = -1;
    layer.appendChild(box);
    document.documentElement.appendChild(layer);
    layer.focus({ preventScroll: true });
    setStatus(t("dragRegion"));

    layer.addEventListener("pointerdown", (event) => {
      start = { x: event.clientX, y: event.clientY };
      layer.setPointerCapture(event.pointerId);
      drawSelectionBox(box, start.x, start.y, start.x, start.y);
    });

    layer.addEventListener("pointermove", (event) => {
      if (!start) {
        return;
      }
      drawSelectionBox(box, start.x, start.y, event.clientX, event.clientY);
    });

    layer.addEventListener("pointerup", (event) => {
      if (!start) {
        return;
      }

      const rect = normalizeRect(start.x, start.y, event.clientX, event.clientY);
      layer.remove();
      start = null;

      if (rect.width < MIN_CROP_SIZE || rect.height < MIN_CROP_SIZE) {
        state.recordArea = "tab";
        state.cropRect = null;
        setStatus(t("regionTooSmall"));
      } else {
        state.cropRect = rect;
        setStatus(t("regionSelected"));
      }
      applyState();
      persistState();
    });
  }

  function drawSelectionBox(box, x1, y1, x2, y2) {
    const rect = normalizeRect(x1, y1, x2, y2);
    box.style.display = "block";
    box.style.left = `${rect.x}px`;
    box.style.top = `${rect.y}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }

  function normalizeRect(x1, y1, x2, y2) {
    const ratio = getCropAspectRatio();
    if (!ratio) {
      const left = clamp(Math.min(x1, x2), 0, window.innerWidth);
      const top = clamp(Math.min(y1, y2), 0, window.innerHeight);
      const right = clamp(Math.max(x1, x2), 0, window.innerWidth);
      const bottom = clamp(Math.max(y1, y2), 0, window.innerHeight);
      return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(right - left),
        height: Math.round(bottom - top)
      };
    }

    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    let nextWidth = width;
    let nextHeight = height;
    if (width >= height * ratio) {
      nextWidth = height * ratio;
      nextHeight = height;
    } else {
      nextWidth = width;
      nextHeight = width / ratio;
    }

    let x = x2 >= x1 ? x1 : x1 - nextWidth;
    let y = y2 >= y1 ? y1 : y1 - nextHeight;
    const maxWidth = x2 >= x1 ? window.innerWidth - x1 : x1;
    const maxHeight = y2 >= y1 ? window.innerHeight - y1 : y1;
    if (nextWidth > maxWidth) {
      nextWidth = Math.max(0, maxWidth);
      nextHeight = nextWidth / ratio;
    }
    if (nextHeight > maxHeight) {
      nextHeight = Math.max(0, maxHeight);
      nextWidth = nextHeight * ratio;
    }
    x = x2 >= x1 ? x1 : x1 - nextWidth;
    y = y2 >= y1 ? y1 : y1 - nextHeight;
    return {
      x: Math.round(clamp(x, 0, window.innerWidth)),
      y: Math.round(clamp(y, 0, window.innerHeight)),
      width: Math.round(nextWidth),
      height: Math.round(nextHeight)
    };
  }

  function normalizeCropAspect(value) {
    return CROP_ASPECT_VALUES[value] ? value : "any";
  }

  function getCropAspectRatio() {
    return CROP_ASPECT_VALUES[state.cropAspect] || 0;
  }

  function minAspectSize(ratio) {
    const minWidth = Math.max(MIN_CROP_SIZE, MIN_CROP_SIZE * ratio);
    return { minWidth, minHeight: minWidth / ratio };
  }

  function placeAspectRect(x, y, width, height, ratio) {
    const { minWidth } = minAspectSize(ratio);
    let nextWidth = Math.max(width, minWidth);
    let nextHeight = nextWidth / ratio;
    if (nextWidth > window.innerWidth) {
      nextWidth = window.innerWidth;
      nextHeight = nextWidth / ratio;
    }
    if (nextHeight > window.innerHeight) {
      nextHeight = window.innerHeight;
      nextWidth = nextHeight * ratio;
    }
    return {
      x: Math.round(clamp(x, 0, Math.max(0, window.innerWidth - nextWidth))),
      y: Math.round(clamp(y, 0, Math.max(0, window.innerHeight - nextHeight))),
      width: Math.round(nextWidth),
      height: Math.round(nextHeight)
    };
  }

  function snapCropRectToAspect(rect, ratio) {
    const { minWidth, minHeight } = minAspectSize(ratio);
    let height = Math.max(rect.height, minHeight);
    let width = height * ratio;

    if (width < minWidth) {
      width = minWidth;
      height = width / ratio;
    }
    if (width > window.innerWidth) {
      width = window.innerWidth;
      height = width / ratio;
    }
    if (height > window.innerHeight) {
      height = window.innerHeight;
      width = height * ratio;
      if (width > window.innerWidth) {
        width = window.innerWidth;
        height = width / ratio;
      }
    }

    const centerX = rect.x + rect.width / 2;
    return {
      x: Math.round(clamp(centerX - width / 2, 0, Math.max(0, window.innerWidth - width))),
      y: Math.round(clamp(rect.y, 0, Math.max(0, window.innerHeight - height))),
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  function syncRegionMask() {
    const rect = state.cropRect;
    const active = state.recordArea === "region" && rect && rect.width > 0 && rect.height > 0;
    if (!active) {
      if (regionMaskHost) {
        regionMaskHost.remove();
        regionMaskHost = null;
        regionMaskShadow = null;
      }
      syncCropTargetElement(null);
      return;
    }

    constrainCropRect();
    if (!regionMaskHost) {
      buildRegionMask();
    }
    regionMaskHost.hidden = false;
    updateRegionMaskLayout();
    syncCropTargetElement(state.cropRect);
  }

  function buildRegionMask() {
    regionMaskHost = document.createElement("html-camera-region-mask");
    regionMaskHost.setAttribute("data-role", "region-mask");
    regionMaskShadow = regionMaskHost.attachShadow({ mode: "open" });

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("src/content.css");

    const root = document.createElement("div");
    root.className = "region-mask";
    root.innerHTML = `
      <div class="region-shade" data-side="top"></div>
      <div class="region-shade" data-side="left"></div>
      <div class="region-shade" data-side="right"></div>
      <div class="region-shade" data-side="bottom"></div>
      <div class="region-frame">
        <div class="region-move" data-action="move" data-edge="n"></div>
        <div class="region-move" data-action="move" data-edge="s"></div>
        <div class="region-move" data-action="move" data-edge="w"></div>
        <div class="region-move" data-action="move" data-edge="e"></div>
        <div class="region-handle" data-action="resize" data-edge="nw"></div>
        <div class="region-handle" data-action="resize" data-edge="n"></div>
        <div class="region-handle" data-action="resize" data-edge="ne"></div>
        <div class="region-handle" data-action="resize" data-edge="e"></div>
        <div class="region-handle" data-action="resize" data-edge="se"></div>
        <div class="region-handle" data-action="resize" data-edge="s"></div>
        <div class="region-handle" data-action="resize" data-edge="sw"></div>
        <div class="region-handle" data-action="resize" data-edge="w"></div>
        <div class="region-size"></div>
      </div>
      <div class="region-dock" hidden>
        <div class="region-dock-bar">
          <button class="region-dock-button region-dock-record" type="button" title="录制" aria-label="录制">${ICONS.record}</button>
          <span class="region-dock-timer" hidden>00:00</span>
          <button class="region-dock-button region-dock-pause" type="button" title="暂停" aria-label="暂停" hidden>${ICONS.pause}</button>
          <button class="region-dock-button region-dock-cancel" type="button" title="取消录制" aria-label="取消录制" hidden data-i18n-title="cancelRecord">${ICONS.cancel}</button>
          <button class="region-dock-button region-dock-toggle region-dock-camera" type="button" title="显示摄像头" aria-label="显示摄像头" aria-pressed="false">${ICONS.camera}</button>
          <button class="region-dock-button region-dock-toggle region-dock-mic" type="button" title="开启麦克风" aria-label="开启麦克风" aria-pressed="false">${ICONS.mic}</button>
          <button class="region-dock-button region-dock-settings" type="button" title="设置" aria-label="设置" aria-expanded="false" data-i18n-title="settings">${ICONS.settings}</button>
        </div>
        <section class="region-dock-menu" hidden>
          <div class="region-dock-field">
            <span data-i18n="recordArea">录制范围</span>
            <div class="region-dock-segmented" role="group" data-i18n-aria="recordArea">
              <button type="button" data-record-area="tab">${ICONS.tab}<span data-i18n="fullPage">整页</span></button>
              <button type="button" data-record-area="region">${ICONS.region}<span data-i18n="region">区域</span></button>
            </div>
          </div>
          <div class="region-dock-field region-dock-aspect-field">
            <span data-i18n="aspectRatio">画面比例</span>
            <div class="region-dock-aspect" role="group" data-i18n-aria="aspectRatio">
              <button type="button" data-crop-aspect="16:9">16:9</button>
              <button type="button" data-crop-aspect="4:3">4:3</button>
              <button type="button" data-crop-aspect="1:1">1:1</button>
              <button type="button" data-crop-aspect="3:4">3:4</button>
              <button type="button" data-crop-aspect="9:16">9:16</button>
              <button type="button" data-crop-aspect="any">Any</button>
            </div>
          </div>
          <div class="region-dock-field">
            <span data-i18n="language">语言</span>
            <div class="region-dock-segmented" role="group" data-i18n-aria="language">
              <button type="button" data-locale="zh">中文</button>
              <button type="button" data-locale="en">English</button>
            </div>
          </div>
        </section>
      </div>
    `;

    regionMaskShadow.append(stylesheet, root);
    bindRegionMaskPointer(root);
    bindRegionDock(root);
    bindLocaleButtons(root);
    window.HCR_I18N?.apply?.(regionMaskShadow, locale);
    document.documentElement.appendChild(regionMaskHost);
  }

  function updateRegionMaskLayout() {
    const rect = state.cropRect;
    if (!regionMaskShadow || !rect) {
      return;
    }

    regionMaskHost.toggleAttribute("data-locked", isRegionLocked());
    const shade = (side) => regionMaskShadow.querySelector(`[data-side="${side}"]`);
    shade("top").style.cssText = `left:0;top:0;width:100%;height:${rect.y}px`;
    shade("left").style.cssText = `left:0;top:${rect.y}px;width:${rect.x}px;height:${rect.height}px`;
    shade("right").style.cssText = `left:${rect.x + rect.width}px;top:${rect.y}px;width:${Math.max(0, window.innerWidth - rect.x - rect.width)}px;height:${rect.height}px`;
    shade("bottom").style.cssText = `left:0;top:${rect.y + rect.height}px;width:100%;height:${Math.max(0, window.innerHeight - rect.y - rect.height)}px`;

    const frame = regionMaskShadow.querySelector(".region-frame");
    frame.style.left = `${rect.x}px`;
    frame.style.top = `${rect.y}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;

    const sizeEl = regionMaskShadow.querySelector(".region-size");
    sizeEl.textContent = `${rect.width} × ${rect.height}`;
    sizeEl.dataset.placement = rect.y < 32 ? "below" : "above";
    updateRegionDock(rect);
  }

  function bindRegionDock(root) {
    const dock = root.querySelector(".region-dock");
    const recordEl = dock.querySelector(".region-dock-record");
    const pauseEl = dock.querySelector(".region-dock-pause");
    const cancelEl = dock.querySelector(".region-dock-cancel");
    const cameraEl = dock.querySelector(".region-dock-camera");
    const micEl = dock.querySelector(".region-dock-mic");
    const settingsEl = dock.querySelector(".region-dock-settings");

    dock.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    recordEl.addEventListener("click", async () => {
      if (recordEl.disabled || isRecordingElsewhere()) {
        return;
      }
      recordEl.disabled = true;
      try {
        if (isRecorderLive()) {
          stopRecording();
        } else {
          await startRecording({ mode: "tab" });
        }
      } catch (_error) {
        // startRecording already surfaces status text.
      } finally {
        updateRegionDock(state.cropRect);
      }
    });

    pauseEl.addEventListener("click", async () => {
      if (pauseEl.disabled || !isRecorderLive()) {
        return;
      }
      await togglePauseRecording();
      updateRegionDock(state.cropRect);
    });

    cancelEl.addEventListener("click", async () => {
      if (cancelEl.disabled || !isRecorderLive()) {
        return;
      }
      await cancelRecording();
      updateRegionDock(state.cropRect);
    });

    cameraEl.addEventListener("click", () => {
      if (cameraEl.disabled) {
        return;
      }
      state.visible = !state.visible;
      applyState();
      persistState();
      syncCameraPreview();
      updateRegionDock(state.cropRect);
    });

    micEl.addEventListener("click", async () => {
      if (micEl.disabled) {
        return;
      }
      micEl.disabled = true;
      try {
        await toggleMicrophone();
      } catch (_error) {
        // toggleMicrophone already surfaces status text.
      } finally {
        updateRegionDock(state.cropRect);
      }
    });

    settingsEl.addEventListener("click", () => {
      if (settingsEl.disabled) {
        return;
      }
      regionDockSettingsOpen = !regionDockSettingsOpen;
      updateRegionDock(state.cropRect);
    });

    dock.querySelectorAll("[data-record-area]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) {
          return;
        }
        setRecordArea(button.dataset.recordArea === "region" ? "region" : "tab");
      });
    });

    dock.querySelectorAll("[data-crop-aspect]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) {
          return;
        }
        setCropAspect(button.dataset.cropAspect);
      });
    });
  }

  function updateRegionDock(rect) {
    if (!regionMaskShadow) {
      return;
    }
    const dock = regionMaskShadow.querySelector(".region-dock");
    if (!dock) {
      return;
    }

    const visible = Boolean(rect && rect.width > 0 && rect.height > 0 && !isRegionSelecting());
    dock.hidden = !visible;
    if (!visible) {
      regionDockSettingsOpen = false;
      window.clearInterval(regionDockTimer);
      return;
    }

    const recording = isRecorderLive();
    const paused = recordingPaused || mediaRecorder?.state === "paused";
    const recordEl = dock.querySelector(".region-dock-record");
    const timerEl = dock.querySelector(".region-dock-timer");
    const pauseEl = dock.querySelector(".region-dock-pause");
    const cancelEl = dock.querySelector(".region-dock-cancel");
    const cameraEl = dock.querySelector(".region-dock-camera");
    const micEl = dock.querySelector(".region-dock-mic");
    const settingsEl = dock.querySelector(".region-dock-settings");
    const menuEl = dock.querySelector(".region-dock-menu");
    const aspectField = dock.querySelector(".region-dock-aspect-field");

    recordEl.disabled = isRecordingElsewhere() && !recording;
    recordEl.dataset.recording = String(recording);
    recordEl.innerHTML = recording ? ICONS.stop : ICONS.record;
    recordEl.title = recordEl.disabled ? t("recordingElsewhere") : (recording ? t("stopRecord") : t("record"));
    recordEl.setAttribute("aria-label", recordEl.title);
    timerEl.hidden = !recording;
    pauseEl.hidden = !recording;
    cancelEl.hidden = !recording;
    pauseEl.innerHTML = paused ? ICONS.resume : ICONS.pause;
    pauseEl.title = paused ? t("resume") : t("pause");
    pauseEl.setAttribute("aria-label", paused ? t("resume") : t("pause"));
    renderRegionDockTimer();

    window.clearInterval(regionDockTimer);
    if (recording && !paused) {
      regionDockTimer = window.setInterval(renderRegionDockTimer, 250);
    }

    setDockToggle(cameraEl, state.visible, t("hideCamera"), t("showCamera"));
    setDockToggle(micEl, Boolean(state.recordMicrophone), t("muteMic"), t("unmuteMic"));
    cameraEl.disabled = recording;
    micEl.disabled = recording;
    settingsEl.disabled = recording;
    settingsEl.setAttribute("aria-expanded", String(regionDockSettingsOpen));
    menuEl.hidden = !regionDockSettingsOpen;

    const selectedArea = state.recordArea === "region" ? "region" : "tab";
    dock.querySelectorAll("[data-record-area]").forEach((button) => {
      button.disabled = recording;
      button.setAttribute("aria-pressed", String(button.dataset.recordArea === selectedArea));
    });

    aspectField.hidden = selectedArea !== "region";
    const selectedAspect = normalizeCropAspect(state.cropAspect);
    dock.querySelectorAll("[data-crop-aspect]").forEach((button) => {
      button.disabled = recording;
      button.setAttribute("aria-pressed", String(button.dataset.cropAspect === selectedAspect));
    });

    positionRegionDock(rect, dock);
  }

  function setDockToggle(button, pressed, onLabel, offLabel) {
    button.setAttribute("aria-pressed", String(pressed));
    const label = pressed ? onLabel : offLabel;
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  function positionRegionDock(rect, dock) {
    const gap = 8;
    const width = dock.offsetWidth;
    const height = dock.offsetHeight;
    const spaceBelow = window.innerHeight - (rect.y + rect.height);
    const placeRight = spaceBelow < height + gap + 8;
    let left;
    let top;

    if (placeRight) {
      left = rect.x + rect.width + gap;
      top = rect.y + rect.height / 2 - height / 2;
    } else {
      const sizeBelow = rect.y < 32 ? 28 : 0;
      left = rect.x + rect.width / 2 - width / 2;
      top = rect.y + rect.height + gap + sizeBelow;
    }

    dock.style.left = `${Math.round(clamp(left, gap, Math.max(gap, window.innerWidth - width - gap)))}px`;
    dock.style.top = `${Math.round(clamp(top, gap, Math.max(gap, window.innerHeight - height - gap)))}px`;
  }

  function renderRegionDockTimer() {
    const timerEl = regionMaskShadow?.querySelector(".region-dock-timer");
    if (!timerEl) {
      return;
    }
    const totalSeconds = Math.max(0, Math.floor(getRecordingElapsedMs() / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function bindRegionMaskPointer(root) {
    let drag = null;

    root.addEventListener("pointerdown", (event) => {
      if (isRegionLocked()) {
        return;
      }
      const target = event.target.closest("[data-action]");
      if (!target || !state.cropRect) {
        return;
      }
      drag = {
        pointerId: event.pointerId,
        action: target.dataset.action,
        edge: target.dataset.edge,
        startX: event.clientX,
        startY: event.clientY,
        rect: { ...state.cropRect }
      };
      target.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    root.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      state.cropRect = drag.action === "move"
        ? moveCropRect(drag.rect, dx, dy)
        : resizeCropRect(drag.rect, drag.edge, dx, dy);
      updateRegionMaskLayout();
    });

    root.addEventListener("pointerup", finishRegionDrag);
    root.addEventListener("pointercancel", finishRegionDrag);

    function finishRegionDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      drag = null;
      constrainCropRect();
      updateRegionMaskLayout();
      persistState();
    }
  }

  function moveCropRect(start, dx, dy) {
    return {
      x: Math.round(clamp(start.x + dx, 0, window.innerWidth - start.width)),
      y: Math.round(clamp(start.y + dy, 0, window.innerHeight - start.height)),
      width: start.width,
      height: start.height
    };
  }

  function resizeCropRect(start, edge, dx, dy) {
    const ratio = getCropAspectRatio();
    if (ratio) {
      return resizeCropRectLocked(start, edge, dx, dy, ratio);
    }

    let x = start.x;
    let y = start.y;
    let width = start.width;
    let height = start.height;

    if (edge.includes("e")) {
      width = clamp(start.width + dx, MIN_CROP_SIZE, window.innerWidth - start.x);
    }
    if (edge.includes("s")) {
      height = clamp(start.height + dy, MIN_CROP_SIZE, window.innerHeight - start.y);
    }
    if (edge.includes("w")) {
      const nextX = clamp(start.x + dx, 0, start.x + start.width - MIN_CROP_SIZE);
      width = start.width + (start.x - nextX);
      x = nextX;
    }
    if (edge.includes("n")) {
      const nextY = clamp(start.y + dy, 0, start.y + start.height - MIN_CROP_SIZE);
      height = start.height + (start.y - nextY);
      y = nextY;
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  function resizeCropRectLocked(start, edge, dx, dy, ratio) {
    const { minWidth } = minAspectSize(ratio);
    const right = start.x + start.width;
    const bottom = start.y + start.height;
    const centerX = start.x + start.width / 2;
    const centerY = start.y + start.height / 2;
    let width = start.width;
    let height = start.height;

    if (edge === "e" || edge === "w") {
      width = edge === "e" ? start.width + dx : start.width - dx;
      height = width / ratio;
    } else if (edge === "n" || edge === "s") {
      height = edge === "s" ? start.height + dy : start.height - dy;
      width = height * ratio;
    } else {
      const rawWidth = edge.includes("e") ? start.width + dx : start.width - dx;
      const rawHeight = edge.includes("s") ? start.height + dy : start.height - dy;
      if (Math.abs(rawWidth / ratio) >= Math.abs(rawHeight)) {
        width = rawWidth;
        height = rawWidth / ratio;
      } else {
        height = rawHeight;
        width = rawHeight * ratio;
      }
    }

    if (width < minWidth) {
      width = minWidth;
      height = width / ratio;
    }

    let x = edge.includes("w") ? right - width : edge === "n" || edge === "s" ? centerX - width / 2 : start.x;
    let y = edge.includes("n") ? bottom - height : edge === "e" || edge === "w" ? centerY - height / 2 : start.y;

    if (x < 0) {
      width += x;
      height = width / ratio;
      x = 0;
      if (edge.includes("w")) {
        x = right - width;
      } else if (edge === "n" || edge === "s") {
        x = centerX - width / 2;
      }
    }
    if (y < 0) {
      height += y;
      width = height * ratio;
      y = 0;
      if (edge.includes("n")) {
        y = bottom - height;
      } else if (edge === "e" || edge === "w") {
        y = centerY - height / 2;
      }
    }
    if (x + width > window.innerWidth) {
      width = window.innerWidth - Math.max(0, x);
      height = width / ratio;
      if (edge.includes("w")) {
        x = right - width;
      } else if (edge === "n" || edge === "s") {
        x = centerX - width / 2;
      }
    }
    if (y + height > window.innerHeight) {
      height = window.innerHeight - Math.max(0, y);
      width = height * ratio;
      if (edge.includes("n")) {
        y = bottom - height;
      } else if (edge === "e" || edge === "w") {
        y = centerY - height / 2;
      }
    }

    return placeAspectRect(x, y, width, height, ratio);
  }

  function constrainCropRect() {
    if (!state.cropRect) {
      return;
    }
    const ratio = getCropAspectRatio();
    if (ratio) {
      state.cropRect = snapCropRectToAspect(state.cropRect, ratio);
      return;
    }
    const min = Math.min(MIN_CROP_SIZE, window.innerWidth, window.innerHeight);
    const width = clamp(state.cropRect.width, min, window.innerWidth);
    const height = clamp(state.cropRect.height, min, window.innerHeight);
    state.cropRect = {
      x: Math.round(clamp(state.cropRect.x, 0, Math.max(0, window.innerWidth - width))),
      y: Math.round(clamp(state.cropRect.y, 0, Math.max(0, window.innerHeight - height))),
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  function syncCameraPreview() {
    if (state.visible) {
      startCamera().catch(() => {});
      return;
    }
    stopCamera();
  }

  async function startCamera() {
    if (cameraStream?.getVideoTracks().some((track) => track.readyState === "live")) {
      placeholder.hidden = true;
      return;
    }

    placeholder.setAttribute("data-i18n", "openingCamera");
    placeholder.textContent = t("openingCamera");
    placeholder.hidden = false;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      video.srcObject = cameraStream;
      placeholder.hidden = true;
    } catch (error) {
      placeholder.setAttribute("data-i18n", "cameraDenied");
      placeholder.textContent = t("cameraDenied");
      setStatus(t("cameraDenied"));
      throw error;
    }
  }

  function stopCamera() {
    if (!cameraStream) {
      return;
    }
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    video.srcObject = null;
    placeholder.setAttribute("data-i18n", "openingCamera");
    placeholder.textContent = t("openingCamera");
    placeholder.hidden = false;
  }

  async function toggleRecording() {
    if (isRecorderLive()) {
      stopRecording();
      return;
    }
    if (isRecordingElsewhere()) {
      return;
    }

    await startRecording({ mode: "tab" });
  }

  async function startRecording(options = {}) {
    if (isRecordingElsewhere()) {
      throw new Error(t("recordingElsewhere"));
    }
    try {
      if (!cameraStream) {
        await startCamera();
      }
      if (state.recordMicrophone) {
        await ensureMicrophone();
      }

      setRecordingUi(true);
      const mode = options.mode || "tab";
      displayStream = mode === "desktop"
        ? await captureDesktopStream(options.streamId)
        : await captureCurrentTabStream();
      const cropRect = state.recordArea === "region" && state.cropRect
        ? { ...state.cropRect }
        : null;
      const videoStream = mode === "tab" && cropRect
        ? await createCroppedVideoStream(displayStream, cropRect)
        : displayStream;

      mixedStream = await createRecordingStream(videoStream);
      preferDetailVideoTracks(mixedStream);
      const recorderOptions = chooseRecordingOptions(mixedStream);
      recordingMime = recorderOptions.mimeType || "";
      chunks = [];
      discardRecording = false;

      mediaRecorder = new MediaRecorder(mixedStream, recorderOptions);
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      });
      mediaRecorder.addEventListener("stop", saveRecording, { once: true });
      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (pageUnloading) {
          cancelRecording();
          return;
        }
        stopRecording();
      }, { once: true });

      mediaRecorder.start(1000);
      startRecordingClock();
      recordButton.dataset.recording = "true";
      recordButton.title = t("stopRecord");
      recordButton.setAttribute("aria-label", t("stopRecord"));
      recordButton.innerHTML = ICONS.stop;
      recordDot.hidden = false;
      notifyRecordingState();
    } catch (error) {
      setRecordingUi(false);
      cleanupRecordingStreams();
      const message = error.message || t("cannotStartRecording");
      setStatus(message.includes("Extension has not been invoked") ? t("invokeExtension") : (error.name === "NotAllowedError" ? t("recordingPermissionDenied") : message));
      notifyRecordingState();
      throw error;
    }
  }

  async function captureCurrentTabStream() {
    const streamId = await getCurrentTabStreamId();
    const size = getPreferredCaptureSize();
    return captureWithFallback([
      {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        minWidth: size.width,
        maxWidth: size.width,
        minHeight: size.height,
        maxHeight: size.height,
        minFrameRate: 30,
        maxFrameRate: 60
      },
      {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        minWidth: size.width,
        maxWidth: Math.max(size.width, 1920),
        minHeight: size.height,
        maxHeight: Math.max(size.height, 1080),
        maxFrameRate: 60
      },
      {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        maxFrameRate: 60
      }
    ]);
  }

  async function captureDesktopStream(streamId) {
    if (!streamId) {
      throw new Error(t("noCaptureSource"));
    }

    return captureWithFallback([
      {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: streamId,
        minFrameRate: 30,
        maxFrameRate: 60
      },
      {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: streamId,
        maxFrameRate: 60
      }
    ]);
  }

  async function captureWithFallback(mandatoryList) {
    let lastError;
    for (const mandatory of mandatoryList) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { mandatory }
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error(t("cannotCaptureTab"));
  }

  function getPreferredCaptureSize() {
    const dpr = window.devicePixelRatio || 1;
    return {
      width: Math.max(2, Math.round(window.innerWidth * dpr)),
      height: Math.max(2, Math.round(window.innerHeight * dpr))
    };
  }

  function getCurrentTabStreamId() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "HCR_GET_TAB_STREAM_ID" }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response?.ok || !response.streamId) {
          reject(new Error(response?.error || t("cannotCaptureTab")));
          return;
        }
        resolve(response.streamId);
      });
    });
  }

  function syncCropTargetElement(rect) {
    if (!rect) {
      cropTargetEl?.remove();
      cropTargetEl = null;
      return;
    }

    if (!cropTargetEl) {
      cropTargetEl = document.createElement("div");
      cropTargetEl.setAttribute("data-hcr-crop-target", "");
      cropTargetEl.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:0",
        "margin:0",
        "padding:0",
        "border:0",
        "background:transparent"
      ].join(";");
      document.documentElement.appendChild(cropTargetEl);
    }

    cropTargetEl.style.left = `${rect.x}px`;
    cropTargetEl.style.top = `${rect.y}px`;
    cropTargetEl.style.width = `${rect.width}px`;
    cropTargetEl.style.height = `${rect.height}px`;
  }

  async function createCroppedVideoStream(tabStream, rect) {
    const sourceTrack = tabStream.getVideoTracks()[0];
    if (!sourceTrack) {
      throw new Error(t("cannotCreateRegionFrame"));
    }
    preferDetailVideoTracks(tabStream);
    return cropTabStreamWithCanvas(sourceTrack, rect);
  }

  function mapPageRectToVideoRect(rect, frameW, frameH) {
    const viewW = window.innerWidth || 1;
    const viewH = window.innerHeight || 1;
    // Tab capture often letterboxes a shorter viewport into a taller frame.
    // Independent scaleX/scaleY would then sample the region-mask shades
    // above and below the selection, while left/right still look correct.
    const scale = Math.min(frameW / viewW, frameH / viewH);
    const offsetX = (frameW - viewW * scale) / 2;
    const offsetY = (frameH - viewH * scale) / 2;
    let x = Math.ceil(offsetX + rect.x * scale);
    let y = Math.ceil(offsetY + rect.y * scale);
    let x2 = Math.floor(offsetX + (rect.x + rect.width) * scale);
    let y2 = Math.floor(offsetY + (rect.y + rect.height) * scale);
    x = clamp(x, 0, frameW - 2);
    y = clamp(y, 0, frameH - 2);
    x2 = clamp(x2, x + 2, frameW);
    y2 = clamp(y2, y + 2, frameH);
    let width = x2 - x;
    let height = y2 - y;
    if (width % 2) {
      width -= 1;
    }
    if (height % 2) {
      height -= 1;
    }
    return {
      x,
      y,
      width: Math.max(2, width),
      height: Math.max(2, height)
    };
  }

  function cropTabStreamWithCanvas(sourceTrack, rect) {
    return new Promise((resolve, reject) => {
      cleanupCropElements();
      const tabVideo = document.createElement("video");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false, desynchronized: true }) || canvas.getContext("2d");

      if (!context) {
        reject(new Error(t("cannotCreateRegionFrame")));
        return;
      }

      cropVideo = tabVideo;
      cropCanvas = canvas;
      tabVideo.muted = true;
      tabVideo.playsInline = true;
      tabVideo.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px;opacity:0;pointer-events:none";
      canvas.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px;opacity:0;pointer-events:none";
      document.documentElement.append(tabVideo, canvas);
      tabVideo.srcObject = new MediaStream([sourceTrack]);
      tabVideo.addEventListener("loadedmetadata", () => {
        tabVideo.play().then(async () => {
          if (typeof tabVideo.requestVideoFrameCallback === "function") {
            await new Promise((done) => tabVideo.requestVideoFrameCallback(() => done()));
          }

          const settings = typeof sourceTrack.getSettings === "function" ? sourceTrack.getSettings() : {};
          const frameW = tabVideo.videoWidth || settings.width;
          const frameH = tabVideo.videoHeight || settings.height;
          if (!frameW || !frameH) {
            reject(new Error(t("cannotCreateRegionFrame")));
            return;
          }

          const source = mapPageRectToVideoRect(rect, frameW, frameH);

          canvas.width = source.width;
          canvas.height = source.height;
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(
            tabVideo,
            source.x,
            source.y,
            source.width,
            source.height,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const canvasStream = canvas.captureStream(60);
          const canvasTrack = canvasStream.getVideoTracks()[0];
          preferDetailVideoTracks(canvasStream);
          if (canvasTrack?.muted) {
            await Promise.race([
              new Promise((done) => canvasTrack.addEventListener("unmute", done, { once: true })),
              new Promise((done) => window.setTimeout(done, 400))
            ]);
          }

          const useVideoFrames = typeof tabVideo.requestVideoFrameCallback === "function";
          cropFrameFromVideo = useVideoFrames;

          function draw() {
            if (!displayStream) {
              return;
            }
            context.drawImage(
              tabVideo,
              source.x,
              source.y,
              source.width,
              source.height,
              0,
              0,
              canvas.width,
              canvas.height
            );
            if (useVideoFrames) {
              cropFrameId = tabVideo.requestVideoFrameCallback(draw);
              return;
            }
            cropFrameId = window.requestAnimationFrame(draw);
          }

          cropFrameId = useVideoFrames
            ? tabVideo.requestVideoFrameCallback(draw)
            : window.requestAnimationFrame(draw);
          resolve(canvasStream);
        }).catch(reject);
      }, { once: true });
    });
  }

  function cleanupCropElements() {
    if (cropFrameId) {
      if (cropFrameFromVideo && typeof cropVideo?.cancelVideoFrameCallback === "function") {
        cropVideo.cancelVideoFrameCallback(cropFrameId);
      } else {
        window.cancelAnimationFrame(cropFrameId);
      }
      cropFrameId = 0;
    }
    cropFrameFromVideo = false;
    cropVideo?.remove();
    cropCanvas?.remove();
    cropVideo = null;
    cropCanvas = null;
  }

  async function createRecordingStream(videoStream) {
    const output = new MediaStream();
    videoStream.getVideoTracks().forEach((track) => output.addTrack(track));

    if (state.recordMicrophone) {
      await ensureMicrophone();
      microphoneStream?.getAudioTracks().forEach((track) => {
        output.addTrack(track.clone());
      });
    }

    if (output.getAudioTracks().length > 0) {
      return output;
    }

    audioContext = new AudioContext();
    audioDestination = audioContext.createMediaStreamDestination();
    audioNodes = [];
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(audioDestination);
    oscillator.start();
    audioNodes.push(oscillator, gain);
    audioDestination.stream.getAudioTracks().forEach((track) => output.addTrack(track));
    return output;
  }

  async function ensureMicrophone() {
    if (microphoneStream?.getAudioTracks().some((track) => track.readyState === "live")) {
      return;
    }

    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  }

  function stopMicrophone() {
    if (!microphoneStream) {
      return;
    }
    microphoneStream.getTracks().forEach((track) => track.stop());
    microphoneStream = null;
    microphoneConnected = false;
    microphoneGain = null;
  }

  async function toggleMicrophone() {
    const previous = Boolean(state.recordMicrophone);
    state.recordMicrophone = !previous;
    try {
      await applyMicrophoneSetting();
      persistState();
    } catch (error) {
      state.recordMicrophone = previous;
      setStatus(t("micDenied"));
      throw error;
    }
    setStatus(state.recordMicrophone ? t("willRecordMic") : t("willNotRecordMic"));
    return state.recordMicrophone;
  }

  async function applyMicrophoneSetting() {
    if (!isRecorderLive()) {
      if (!state.recordMicrophone) {
        stopMicrophone();
      }
      return;
    }

    if (!state.recordMicrophone) {
      if (microphoneGain) {
        microphoneGain.gain.value = 0;
      }
      mixedStream?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      return;
    }

    await ensureMicrophone();
    if (microphoneGain) {
      microphoneGain.gain.value = 1;
    }
    mixedStream?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
  }

  function stopRecording() {
    finalizeRecorder(false);
  }

  function cancelRecording() {
    return finalizeRecorder(true);
  }

  function finalizeRecorder(discard) {
    discardRecording = Boolean(discard) || pageUnloading;
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      saveRecording();
      return Promise.resolve(getRecordingState());
    }

    recordingPaused = false;
    setRecordingTracksEnabled(true);

    if (mediaRecorder.state === "paused") {
      try {
        mediaRecorder.resume();
      } catch (_error) {
        // Some capture streams ignore resume(); stop() still finalizes the file.
      }
    }

    return new Promise((resolve) => {
      mediaRecorder.addEventListener("stop", () => resolve(getRecordingState()), { once: true });
      if (mediaRecorder.state === "recording" || mediaRecorder.state === "paused") {
        try {
          mediaRecorder.requestData();
        } catch (_error) {
          // requestData() is optional; stop() still flushes the trailer.
        }
        mediaRecorder.stop();
        return;
      }
      saveRecording();
      resolve(getRecordingState());
    });
  }

  async function togglePauseRecording() {
    if (!isRecorderLive()) {
      return getRecordingState();
    }
    if (recordingPaused || mediaRecorder?.state === "paused") {
      await resumeRecording();
    } else {
      pauseRecording();
    }
    notifyRecordingState();
    return getRecordingState();
  }

  function pauseRecordingIfNeeded() {
    if (!isRecorderLive() || recordingPaused || mediaRecorder?.state === "paused") {
      return getRecordingState();
    }
    pauseRecording();
    notifyRecordingState();
    return getRecordingState();
  }

  function pauseRecording() {
    if (!isRecorderLive() || recordingPaused) {
      return;
    }
    recordingElapsedMs = getRecordingElapsedMs();
    recordingTickStartedAt = 0;
    recordingPaused = true;
    try {
      if (mediaRecorder?.state === "recording" && typeof mediaRecorder.pause === "function") {
        mediaRecorder.pause();
      }
    } catch (_error) {
      // Some Chrome capture streams ignore MediaRecorder.pause().
    }
    // If pause() worked, keep video tracks live so the camera overlay does not
    // go black and get captured as a flash at the cut. Only mute audio, and
    // disable video when pause() is ignored.
    setRecordingTracksEnabled(false, { includeVideo: mediaRecorder?.state !== "paused" });
  }

  async function resumeRecording() {
    if (!recordingPaused && mediaRecorder?.state !== "paused") {
      return;
    }
    recordingPaused = false;
    recordingTickStartedAt = Date.now();
    setRecordingTracksEnabled(true);
    await waitForCapturedPreviewFrame();
    try {
      if (mediaRecorder?.state === "paused" && typeof mediaRecorder.resume === "function") {
        mediaRecorder.resume();
      }
    } catch (_error) {
      // Keep recording via enabled tracks if resume() is unavailable.
    }
  }

  async function waitForCapturedPreviewFrame() {
    if (state.visible && video && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (typeof video.requestVideoFrameCallback === "function") {
        await Promise.race([
          new Promise((resolve) => video.requestVideoFrameCallback(() => resolve())),
          new Promise((resolve) => window.setTimeout(resolve, 160))
        ]);
      }
    }
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    });
  }

  function setRecordingTracksEnabled(enabled, options = {}) {
    const includeVideo = options.includeVideo !== false;
    [mixedStream, displayStream, microphoneStream].forEach((stream) => {
      stream?.getTracks().forEach((track) => {
        if (!includeVideo && track.kind === "video") {
          return;
        }
        track.enabled = enabled;
      });
    });
  }

  function startRecordingClock() {
    recordingElapsedMs = 0;
    recordingTickStartedAt = Date.now();
    recordingPaused = false;
  }

  function getRecordingElapsedMs() {
    if (!isRecorderLive()) {
      return 0;
    }
    if (recordingPaused || mediaRecorder?.state === "paused" || !recordingTickStartedAt) {
      return recordingElapsedMs;
    }
    return recordingElapsedMs + Math.max(0, Date.now() - recordingTickStartedAt);
  }

  function getRecordingState() {
    return {
      recording: isRecorderLive(),
      paused: recordingPaused || mediaRecorder?.state === "paused",
      elapsedMs: getRecordingElapsedMs()
    };
  }

  function isRecorderLive() {
    return mediaRecorder?.state === "recording" || mediaRecorder?.state === "paused";
  }

  function isRegionLocked() {
    return Boolean(host?.hasAttribute("recording") || isRecorderLive());
  }

  function saveRecording() {
    if (finishingRecording || (!mediaRecorder && !host?.hasAttribute("recording"))) {
      return;
    }

    finishingRecording = true;
    const discarded = discardRecording;
    discardRecording = false;

    try {
      const hasVideo = !discarded && chunks.length > 0;
      if (hasVideo) {
        const mimeType = recordingMime || chunks[0].type || "video/webm";
        const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `webcord-${Math.floor(Date.now() / 1000)}.${extension}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showDownloadToast(t("videoDownloaded"));
      } else if (discarded) {
        if (!pageUnloading) {
          showDownloadToast(t("recordingCancelled"));
        }
      } else {
        setStatus(t("noRecordingData"));
      }

      recordButton.dataset.recording = "false";
      recordButton.title = t("startRecord");
      recordButton.setAttribute("aria-label", t("startRecord"));
      recordButton.innerHTML = ICONS.record;
      recordDot.hidden = true;
      setRecordingUi(false);
      cleanupRecordingStreams();
      notifyRecordingState();
    } finally {
      finishingRecording = false;
    }
  }

  function notifyRecordingState() {
    try {
      chrome.runtime.sendMessage({
        type: "HCR_RECORDING_STATE",
        ok: true,
        ...getRecordingState()
      }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_error) {
      // The popup may already be gone.
    }
    updateRegionDock(state.cropRect);
  }

  function showDownloadToast(message) {
    const existing = document.querySelector("html-camera-toast");
    existing?.remove();
    window.clearTimeout(downloadToastTimer);

    const toastHost = document.createElement("html-camera-toast");
    toastHost.setAttribute("data-role", "toast");
    toastHost.style.cssText = [
      "all: initial",
      "position: fixed",
      "inset: 0",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "pointer-events: none",
      "z-index: 2147483647"
    ].join(";");
    const toastShadow = toastHost.attachShadow({ mode: "open" });
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = [
      "padding: 14px 22px",
      "border-radius: 10px",
      "color: #f8fafc",
      "background: rgba(15, 23, 42, 0.92)",
      "box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28)",
      "font: 650 14px/1.4 Inter, ui-sans-serif, system-ui, sans-serif",
      "text-align: center"
    ].join(";");
    toastShadow.append(toast);
    (document.body || document.documentElement).appendChild(toastHost);

    downloadToastTimer = window.setTimeout(() => {
      toastHost.remove();
    }, 2800);
  }

  function setRecordingUi(isRecording) {
    host.toggleAttribute("recording", isRecording);
    settingsPanel.hidden = true;
    if (isRecording) {
      statusEl.textContent = "";
    }
    syncRegionMask();
  }

  function cleanupRecordingStreams() {
    mediaRecorder = null;
    chunks = [];
    recordingMime = "";
    recordingElapsedMs = 0;
    recordingTickStartedAt = 0;
    recordingPaused = false;
    discardRecording = false;
    cleanupCropElements();
    if (displayStream) {
      displayStream.getTracks().forEach((track) => track.stop());
      displayStream = null;
    }
    if (mixedStream) {
      mixedStream.getTracks().forEach((track) => {
        if (!displayStream?.getTracks().includes(track) && !cameraStream?.getTracks().includes(track) && !microphoneStream?.getTracks().includes(track)) {
          track.stop();
        }
      });
      mixedStream = null;
    }
    audioNodes.forEach((node) => node.disconnect());
    audioNodes = [];
    audioDestination = null;
    microphoneGain = null;
    microphoneConnected = false;
    stopMicrophone();
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    syncCameraPreview();
  }

  function chooseRecordingMime() {
    const candidates = [
      'video/mp4;codecs="avc1.640029,mp4a.40.2"',
      'video/mp4;codecs="avc1.640028,mp4a.40.2"',
      'video/mp4;codecs="avc1.4D4029,mp4a.40.2"',
      'video/mp4;codecs="avc1.64001F,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4;codecs="avc1.640029"',
      'video/mp4;codecs="avc1.42E01E"',
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];
    return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
  }

  function chooseRecordingOptions(stream) {
    const mimeType = chooseRecordingMime();
    const track = stream.getVideoTracks()[0];
    const settings = typeof track?.getSettings === "function" ? track.getSettings() : {};
    const width = Number(settings.width) || 1280;
    const height = Number(settings.height) || 720;
    const videoBitsPerSecond = Math.round(Math.min(12_000_000, Math.max(5_000_000, width * height * 3.2)));
    const options = {
      videoBitsPerSecond,
      audioBitsPerSecond: 160000
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }
    return options;
  }

  function preferDetailVideoTracks(stream) {
    stream?.getVideoTracks().forEach((track) => {
      if ("contentHint" in track) {
        track.contentHint = "detail";
      }
    });
  }

  function applyState() {
    if (!host) {
      return;
    }

    constrainToViewport();
    host.hidden = !state.visible;
    host.dataset.shape = state.shape;
    host.style.left = `${Math.round(state.x)}px`;
    host.style.top = `${Math.round(state.y)}px`;
    host.style.width = `${Math.round(state.width)}px`;
    host.style.height = `${Math.round(state.height)}px`;
    host.style.setProperty("--hcr-border-width", `${state.borderWidth}px`);
    host.style.setProperty("--hcr-border-color", state.borderColor);
    previewFrame.dataset.shape = state.shape;
    borderWidthInput.value = String(state.borderWidth);
    borderColorInput.value = state.borderColor;
    const borderColorField = shadow.querySelector(".border-color-field");
    if (borderColorField) {
      borderColorField.hidden = Number(state.borderWidth) <= 0;
    }
    shadow.querySelectorAll("[data-shape]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.shape === state.shape));
    });
    syncRegionMask();
  }

  function applyPrompterState() {
    if (!prompterHost) {
      return;
    }

    constrainPrompterToViewport();
    prompterHost.hidden = !state.prompter.visible;
    prompterHost.style.left = `${Math.round(state.prompter.x)}px`;
    prompterHost.style.top = `${Math.round(state.prompter.y)}px`;
    prompterHost.style.width = `${Math.round(state.prompter.width)}px`;
    prompterHost.style.height = `${Math.round(state.prompter.height)}px`;
    prompterHost.style.setProperty("--hcr-prompter-opacity", String(state.prompter.opacity / 100));
    if (prompterOpacityInput) {
      prompterOpacityInput.value = String(state.prompter.opacity);
    }
    if (promptTextEl && promptTextEl.value !== state.prompter.text) {
      promptTextEl.value = state.prompter.text;
    }
  }

  function constrainToViewport() {
    const minSize = 168;
    const maxSize = Math.max(minSize, Math.min(window.innerWidth, window.innerHeight));
    const size = clamp(Math.max(state.width, state.height), minSize, maxSize);
    state.width = size;
    state.height = size;
    state.x = clamp(state.x, 0, Math.max(0, window.innerWidth - size));
    state.y = clamp(state.y, 0, Math.max(0, window.innerHeight - size));
  }

  function constrainPrompterToViewport() {
    state.prompter.width = clamp(state.prompter.width, 280, Math.max(280, window.innerWidth));
    state.prompter.height = clamp(state.prompter.height, 180, Math.max(180, window.innerHeight));
    state.prompter.x = clamp(state.prompter.x, 0, Math.max(0, window.innerWidth - state.prompter.width));
    state.prompter.y = clamp(state.prompter.y, 0, Math.max(0, window.innerHeight - state.prompter.height));
  }

  function setStatus(message) {
    if (host?.hasAttribute("recording")) {
      statusEl.textContent = "";
      return;
    }
    statusEl.textContent = message;
    if (message) {
      window.clearTimeout(setStatus.timer);
      setStatus.timer = window.setTimeout(() => {
        if (!isRecorderLive()) {
          statusEl.textContent = "";
        }
      }, 3200);
    }
  }

  function readStoredState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function persistState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // sessionStorage can be unavailable on some pages.
    }
    notifyOverlayState();
  }

  function notifyOverlayState() {
    try {
      chrome.runtime.sendMessage({
        type: "HCR_OVERLAY_STATE",
        ok: true,
        visible: state.visible,
        recordMicrophone: Boolean(state.recordMicrophone),
        recordArea: state.recordArea === "region" ? "region" : "tab",
        cropAspect: normalizeCropAspect(state.cropAspect)
      }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_error) {
      // The popup may already be gone.
    }
  }

  function bindChromeMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "HCR_PING") {
        sendResponse({ ok: true });
        return true;
      }

      if (message?.type === "HCR_GET_OVERLAY_STATE") {
        sendResponse({
          ok: true,
          visible: state.visible,
          recordMicrophone: Boolean(state.recordMicrophone),
          recordArea: state.recordArea === "region" ? "region" : "tab",
          cropAspect: normalizeCropAspect(state.cropAspect),
          ...getRecordingState()
        });
        return true;
      }

      if (message?.type === "HCR_SET_RECORD_AREA") {
        sendResponse(setRecordArea(message.recordArea));
        return true;
      }

      if (message?.type === "HCR_STEP_BACK_REGION") {
        sendResponse(stepBackRegionSelection());
        return true;
      }

      if (message?.type === "HCR_SET_CROP_ASPECT") {
        sendResponse(setCropAspect(message.cropAspect));
        return true;
      }

      if (message?.type === "HCR_TOGGLE_MICROPHONE") {
        toggleMicrophone()
          .then((recordMicrophone) => sendResponse({ ok: true, recordMicrophone }))
          .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
      }

      if (message?.type === "HCR_TOGGLE_OVERLAY") {
        state.visible = !state.visible;
        applyState();
        persistState();
        syncCameraPreview();
        sendResponse({ ok: true, visible: state.visible });
        return true;
      }

      if (message?.type === "HCR_RESET_OVERLAY") {
        const prompter = { ...state.prompter };
        state = { ...DEFAULT_STATE, prompter };
        applyState();
        applyPrompterState();
        persistState();
        syncCameraPreview();
        sendResponse({ ok: true });
        return true;
      }

      if (message?.type === "HCR_TOGGLE_PROMPTER") {
        state.prompter.visible = !state.prompter.visible;
        applyPrompterState();
        persistState();
        sendResponse({ ok: true, visible: state.prompter.visible });
        return true;
      }

      if (message?.type === "HCR_START_RECORDING") {
        startRecording(message)
          .then(() => sendResponse({ ok: true, ...getRecordingState() }))
          .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
      }

      if (message?.type === "HCR_TOGGLE_PAUSE") {
        togglePauseRecording()
          .then((recordingState) => sendResponse({ ok: true, ...recordingState }))
          .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
      }

      if (message?.type === "HCR_PAUSE_RECORDING") {
        sendResponse({ ok: true, ...pauseRecordingIfNeeded() });
        return true;
      }

      if (message?.type === "HCR_STOP_RECORDING") {
        stopRecording();
        sendResponse({ ok: true, ...getRecordingState() });
        return true;
      }

      if (message?.type === "HCR_CANCEL_RECORDING") {
        cancelRecording()
          .then((recordingState) => sendResponse({ ok: true, ...recordingState }))
          .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
      }

      return false;
    });
  }

  window.addEventListener("pagehide", () => {
    pageUnloading = true;
    if (!isRecorderLive() && !host?.hasAttribute("recording")) {
      return;
    }
    cancelRecording();
  });

  window.addEventListener("resize", () => {
    constrainToViewport();
    constrainPrompterToViewport();
    constrainCropRect();
    applyState();
    applyPrompterState();
    persistState();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || isRecorderLive() || state.recordArea !== "region") {
      return;
    }
    if (isTypingTarget(event)) {
      return;
    }
    event.preventDefault();
    stepBackRegionSelection();
  }, true);

  function isTypingTarget(event) {
    return event.composedPath().some((node) => {
      if (!(node instanceof Element)) {
        return false;
      }
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
