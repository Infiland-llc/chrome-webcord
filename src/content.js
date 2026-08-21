(function () {
  if (window.__HTML_CAMERA_RECORDER__) {
    return;
  }
  window.__HTML_CAMERA_RECORDER__ = true;

  const STORAGE_KEY = "hcr.overlay";
  const MIN_CROP_SIZE = 40;
  const DEFAULT_STATE = {
    visible: true,
    x: 24,
    y: 96,
    width: 240,
    height: 240,
    shape: "square",
    borderWidth: 0,
    borderColor: "#ffffff",
    recordArea: "tab",
    recordMicrophone: true,
    cropRect: null,
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

  boot();

  async function boot() {
    const stored = await readStoredState();
    state = { ...DEFAULT_STATE, ...stored };
    state.shape = stored.shape === "circle" ? "circle" : "square";
    state.prompter = { ...DEFAULT_STATE.prompter, ...(stored.prompter || {}), visible: false };
    buildOverlay();
    buildPrompter();
    applyState();
    applyPrompterState();
    bindChromeMessages();
    syncCameraPreview();
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
        <button class="icon-button settings-button" type="button" title="调整蒙版" aria-label="调整蒙版">${ICONS.settings}</button>
      </div>
      <div class="preview-frame" data-shape="square" title="拖拽移动摄像头浮窗">
        <video autoplay muted playsinline></video>
        <div class="placeholder">正在开启摄像头...</div>
        <div class="record-dot" hidden></div>
        <div class="status"></div>
      </div>
      <form class="settings" hidden>
        <div class="field">
          形状
          <div class="segmented" role="group" aria-label="蒙版形状">
            <button type="button" data-shape="square">${ICONS.square}<span>方形</span></button>
            <button type="button" data-shape="circle">${ICONS.circle}<span>圆形</span></button>
          </div>
        </div>
        <label class="field">
          边框
          <input class="border-width-input" type="range" min="0" max="12" step="1" value="0">
        </label>
        <label class="field">
          边框颜色
          <input class="border-color-input" type="color" value="#ffffff">
        </label>
      </form>
      <div class="resize-handle" title="拖拽调整大小"></div>
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

    shadow.querySelector(".settings-button").addEventListener("click", () => {
      settingsPanel.hidden = !settingsPanel.hidden;
    });
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
        <strong>题词板</strong>
        <span>拖动这里移动</span>
      </div>
      <label class="field">
        透明度
        <input class="prompter-opacity" type="range" min="20" max="100" step="1" value="72">
      </label>
      <textarea class="prompter-text" spellcheck="false"></textarea>
      <div class="button-row">
        <button class="copy-prompt" type="button">复制文本</button>
        <button class="clear-prompt" type="button">清空</button>
      </div>
      <div class="prompter-resize" title="拖拽调整大小"></div>
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
        error: "录制中无法更改范围",
        recordArea: state.recordArea === "region" ? "region" : "tab"
      };
    }

    if (recordArea === "region") {
      state.recordArea = "region";
      beginRegionSelection();
      return { ok: true, recordArea: "region" };
    }

    state.recordArea = "tab";
    state.cropRect = null;
    applyState();
    persistState();
    return { ok: true, recordArea: "tab" };
  }

  function beginRegionSelection() {
    if (isRegionLocked()) {
      return;
    }

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

    layer.appendChild(box);
    document.documentElement.appendChild(layer);
    setStatus("拖拽选择录制区域");

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
        setStatus("区域太小，已恢复整页录制");
      } else {
        state.cropRect = rect;
        setStatus("已选择录制区域");
      }
      applyState();
      persistState();
    });

    window.addEventListener("keydown", cancelSelection, { once: true });

    function cancelSelection(event) {
      if (event.key !== "Escape" || !layer.isConnected) {
        return;
      }
      layer.remove();
      state.recordArea = "tab";
      state.cropRect = null;
      applyState();
      persistState();
      setStatus("已取消区域选择");
    }
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
    `;

    regionMaskShadow.append(stylesheet, root);
    bindRegionMaskPointer(root);
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

  function constrainCropRect() {
    if (!state.cropRect) {
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

    placeholder.textContent = "正在开启摄像头...";
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
      placeholder.textContent = "摄像头权限被拒绝或不可用";
      setStatus("摄像头权限被拒绝或不可用");
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
    placeholder.textContent = "正在开启摄像头...";
    placeholder.hidden = false;
  }

  async function toggleRecording() {
    if (isRecorderLive()) {
      stopRecording();
      return;
    }

    await startRecording({ mode: "tab" });
  }

  async function startRecording(options = {}) {
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
      displayStream.getVideoTracks()[0]?.addEventListener("ended", stopRecording, { once: true });

      mediaRecorder.start(1000);
      startRecordingClock();
      recordButton.dataset.recording = "true";
      recordButton.title = "停止录制";
      recordButton.setAttribute("aria-label", "停止录制");
      recordButton.innerHTML = ICONS.stop;
      recordDot.hidden = false;
      notifyRecordingState();
    } catch (error) {
      setRecordingUi(false);
      cleanupRecordingStreams();
      const message = error.message || "无法开始录制";
      setStatus(message.includes("Extension has not been invoked") ? "请先点扩展图标里的“开始录制当前页”" : (error.name === "NotAllowedError" ? "录制权限被取消" : message));
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
      throw new Error("没有可用的屏幕录制来源。");
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
    throw lastError || new Error("无法捕获当前标签页");
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
          reject(new Error(response?.error || "无法捕获当前标签页"));
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
      throw new Error("无法创建区域录制画面");
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
        reject(new Error("无法创建区域录制画面"));
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
            reject(new Error("无法创建区域录制画面"));
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
    const previous = state.recordMicrophone !== false;
    state.recordMicrophone = !previous;
    try {
      await applyMicrophoneSetting();
      persistState();
    } catch (error) {
      state.recordMicrophone = previous;
      setStatus("麦克风权限被拒绝或不可用");
      throw error;
    }
    setStatus(state.recordMicrophone ? "将录制麦克风" : "不录制麦克风");
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
    discardRecording = Boolean(discard);
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
        link.download = `html-camera-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showDownloadToast("视频已下载。");
      } else if (!discarded) {
        setStatus("没有录到可保存的数据");
      }

      recordButton.dataset.recording = "false";
      recordButton.title = "开始录制";
      recordButton.setAttribute("aria-label", "开始录制");
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
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        resolve(result[STORAGE_KEY] || {});
      });
    });
  }

  function persistState() {
    chrome.storage.local.set({ [STORAGE_KEY]: state });
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
          recordMicrophone: state.recordMicrophone !== false,
          recordArea: state.recordArea === "region" ? "region" : "tab",
          ...getRecordingState()
        });
        return true;
      }

      if (message?.type === "HCR_SET_RECORD_AREA") {
        sendResponse(setRecordArea(message.recordArea));
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
        state = { ...DEFAULT_STATE, visible: true, prompter };
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

  window.addEventListener("resize", () => {
    constrainToViewport();
    constrainPrompterToViewport();
    constrainCropRect();
    applyState();
    applyPrompterState();
    persistState();
  });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
