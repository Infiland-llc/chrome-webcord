(function () {
  if (window.__HTML_CAMERA_RECORDER__) {
    return;
  }
  window.__HTML_CAMERA_RECORDER__ = true;

  const STORAGE_KEY = "hcr.overlay";
  const DEFAULT_STATE = {
    visible: true,
    x: 24,
    y: 96,
    width: 260,
    height: 190,
    radius: 24,
    shape: "rounded",
    borderWidth: 0,
    borderColor: "#ffffff"
  };

  const ICONS = {
    record: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l4.5-2.5v9L15 14"></path><rect x="3" y="6" width="12" height="12" rx="2"></rect></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.03.03a2 2 0 1 1-2.83 2.83l-.03-.03A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .58V20a2 2 0 1 1-4 0v-.05a1.7 1.7 0 0 0-1-.58 1.7 1.7 0 0 0-1.88.34l-.03.03a2 2 0 1 1-2.83-2.83l.03-.03A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-.58-1H4a2 2 0 1 1 0-4h.05a1.7 1.7 0 0 0 .58-1 1.7 1.7 0 0 0-.34-1.88l-.03-.03a2 2 0 1 1 2.83-2.83l.03.03A1.7 1.7 0 0 0 9 4.63c.34-.12.68-.32 1-.58V4a2 2 0 1 1 4 0v.05c.32.26.66.46 1 .58a1.7 1.7 0 0 0 1.88-.34l.03-.03a2 2 0 1 1 2.83 2.83l-.03.03A1.7 1.7 0 0 0 19.37 9c.12.34.32.68.58 1H20a2 2 0 1 1 0 4h-.05c-.26.32-.46.66-.55 1Z"></path></svg>',
    hide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>'
  };

  let state = { ...DEFAULT_STATE };
  let host;
  let shadow;
  let video;
  let placeholder;
  let statusEl;
  let recordDot;
  let recordButton;
  let radiusInput;
  let borderWidthInput;
  let borderColorInput;
  let settingsPanel;
  let previewFrame;
  let cameraStream;
  let displayStream;
  let mixedStream;
  let audioContext;
  let mediaRecorder;
  let chunks = [];
  let recordingMime = "";

  boot();

  async function boot() {
    state = { ...DEFAULT_STATE, ...(await readStoredState()) };
    buildOverlay();
    applyState();
    bindChromeMessages();
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
      <div class="toolbar" data-drag-handle title="拖拽移动摄像头浮窗">
        <button class="icon-button record-button" type="button" title="开始录制" aria-label="开始录制">${ICONS.record}</button>
        <button class="icon-button camera-button" type="button" title="打开或关闭摄像头" aria-label="打开或关闭摄像头">${ICONS.camera}</button>
        <span class="spacer"></span>
        <button class="icon-button settings-button" type="button" title="调整蒙版" aria-label="调整蒙版">${ICONS.settings}</button>
        <button class="icon-button hide-button" type="button" title="隐藏浮窗" aria-label="隐藏浮窗">${ICONS.hide}</button>
      </div>
      <div class="preview-frame" data-shape="rounded">
        <video autoplay muted playsinline></video>
        <div class="placeholder">点击摄像头按钮开启预览</div>
        <div class="record-dot" hidden></div>
        <div class="status"></div>
      </div>
      <form class="settings" hidden>
        <label class="field">
          圆角
          <input class="radius-input" type="range" min="0" max="96" step="1" value="24">
        </label>
        <label class="field">
          边框
          <input class="border-width-input" type="range" min="0" max="12" step="1" value="0">
        </label>
        <label class="field">
          边框颜色
          <input class="border-color-input" type="color" value="#ffffff">
        </label>
        <div class="field">
          形状
          <div class="segmented" role="group" aria-label="蒙版形状">
            <button type="button" data-shape="square">直角</button>
            <button type="button" data-shape="rounded">圆角</button>
            <button type="button" data-shape="circle">圆形</button>
          </div>
        </div>
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
    radiusInput = shadow.querySelector(".radius-input");
    borderWidthInput = shadow.querySelector(".border-width-input");
    borderColorInput = shadow.querySelector(".border-color-input");
    settingsPanel = shadow.querySelector(".settings");
    previewFrame = shadow.querySelector(".preview-frame");

    shadow.querySelector(".camera-button").addEventListener("click", toggleCamera);
    shadow.querySelector(".settings-button").addEventListener("click", () => {
      settingsPanel.hidden = !settingsPanel.hidden;
    });
    shadow.querySelector(".hide-button").addEventListener("click", () => {
      state.visible = false;
      applyState();
      persistState();
    });
    recordButton.addEventListener("click", toggleRecording);
    previewFrame.addEventListener("dblclick", () => {
      if (mediaRecorder?.state === "recording") {
        stopRecording();
      }
    });
    radiusInput.addEventListener("input", () => {
      state.radius = Number(radiusInput.value);
      state.shape = "rounded";
      applyState();
      persistState();
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
        state.shape = button.dataset.shape;
        if (state.shape === "square") {
          state.radius = 0;
        } else if (state.shape === "rounded" && state.radius === 0) {
          state.radius = 24;
        }
        applyState();
        persistState();
      });
    });

    bindDrag(shadow.querySelector("[data-drag-handle]"));
    bindResize(shadow.querySelector(".resize-handle"));
  }

  function bindDrag(handle) {
    let start = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) {
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
        width: state.width,
        height: state.height
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }
      state.width = clamp(start.width + event.clientX - start.pointerX, 168, window.innerWidth);
      state.height = clamp(start.height + event.clientY - start.pointerY, 122, window.innerHeight);
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

  async function toggleCamera() {
    if (cameraStream) {
      stopCamera();
      setStatus("摄像头已关闭");
      return;
    }

    await startCamera();
  }

  async function startCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      video.srcObject = cameraStream;
      placeholder.hidden = true;
      setStatus("摄像头已开启");
    } catch (error) {
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
    placeholder.hidden = false;
  }

  async function toggleRecording() {
    if (mediaRecorder?.state === "recording") {
      stopRecording();
      return;
    }

    await startRecording();
  }

  async function startRecording() {
    try {
      if (!cameraStream) {
        await startCamera();
      }

      setStatus("请选择当前标签页或窗口");
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          cursor: "always"
        },
        audio: true
      });

      mixedStream = await createRecordingStream(displayStream, cameraStream);
      recordingMime = chooseRecordingMime();
      chunks = [];

      mediaRecorder = new MediaRecorder(mixedStream, recordingMime ? { mimeType: recordingMime } : undefined);
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      });
      mediaRecorder.addEventListener("stop", saveRecording, { once: true });
      displayStream.getVideoTracks()[0]?.addEventListener("ended", stopRecording, { once: true });

      mediaRecorder.start(1000);
      setRecordingUi(true);
      recordButton.dataset.recording = "true";
      recordButton.title = "停止录制";
      recordButton.setAttribute("aria-label", "停止录制");
      recordButton.innerHTML = ICONS.stop;
      recordDot.hidden = false;
      const extension = recordingMime.startsWith("video/mp4") ? "MP4" : "WebM";
      setStatus(`正在录制 ${extension}`);
    } catch (error) {
      cleanupRecordingStreams();
      setStatus(error.name === "NotAllowedError" ? "录制权限被取消" : "无法开始录制");
      throw error;
    }
  }

  async function createRecordingStream(screenStream, camStream) {
    const output = new MediaStream();
    screenStream.getVideoTracks().forEach((track) => output.addTrack(track));

    const audioTracks = [
      ...screenStream.getAudioTracks(),
      ...camStream.getAudioTracks()
    ];

    if (audioTracks.length === 0) {
      return output;
    }

    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    audioTracks.forEach((track) => {
      const sourceStream = new MediaStream([track]);
      const source = audioContext.createMediaStreamSource(sourceStream);
      source.connect(destination);
    });
    destination.stream.getAudioTracks().forEach((track) => output.addTrack(track));

    return output;
  }

  function stopRecording() {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
    } else {
      saveRecording();
    }
  }

  function saveRecording() {
    if (chunks.length > 0) {
      const mimeType = recordingMime || chunks[0].type || "video/webm";
      const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `html-camera-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus(`已保存 ${extension.toUpperCase()} 文件`);
    } else {
      setStatus("没有录到可保存的数据");
    }

    recordButton.dataset.recording = "false";
    recordButton.title = "开始录制";
    recordButton.setAttribute("aria-label", "开始录制");
    recordButton.innerHTML = ICONS.record;
    recordDot.hidden = true;
    setRecordingUi(false);
    cleanupRecordingStreams();
  }

  function setRecordingUi(isRecording) {
    host.toggleAttribute("recording", isRecording);
    settingsPanel.hidden = true;
  }

  function cleanupRecordingStreams() {
    mediaRecorder = null;
    chunks = [];
    recordingMime = "";
    if (displayStream) {
      displayStream.getTracks().forEach((track) => track.stop());
      displayStream = null;
    }
    if (mixedStream) {
      mixedStream.getTracks().forEach((track) => {
        if (!displayStream?.getTracks().includes(track) && !cameraStream?.getTracks().includes(track)) {
          track.stop();
        }
      });
      mixedStream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  }

  function chooseRecordingMime() {
    const candidates = [
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E"',
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
  }

  function applyState() {
    if (!host) {
      return;
    }

    constrainToViewport();
    host.hidden = !state.visible;
    host.style.left = `${Math.round(state.x)}px`;
    host.style.top = `${Math.round(state.y)}px`;
    host.style.width = `${Math.round(state.width)}px`;
    host.style.height = `${Math.round(state.height)}px`;
    host.style.setProperty("--hcr-radius", `${state.radius}px`);
    host.style.setProperty("--hcr-border-width", `${state.borderWidth}px`);
    host.style.setProperty("--hcr-border-color", state.borderColor);
    previewFrame.dataset.shape = state.shape;
    radiusInput.value = String(state.radius);
    borderWidthInput.value = String(state.borderWidth);
    borderColorInput.value = state.borderColor;
    shadow.querySelectorAll("[data-shape]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.shape === state.shape));
    });
  }

  function constrainToViewport() {
    state.width = clamp(state.width, 168, Math.max(168, window.innerWidth));
    state.height = clamp(state.height, 122, Math.max(122, window.innerHeight));
    state.x = clamp(state.x, 0, Math.max(0, window.innerWidth - state.width));
    state.y = clamp(state.y, 0, Math.max(0, window.innerHeight - state.height));
  }

  function setStatus(message) {
    statusEl.textContent = message;
    if (message) {
      window.clearTimeout(setStatus.timer);
      setStatus.timer = window.setTimeout(() => {
        if (mediaRecorder?.state !== "recording") {
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
      if (message?.type === "HCR_TOGGLE_OVERLAY") {
        state.visible = !state.visible;
        applyState();
        persistState();
        sendResponse({ ok: true, visible: state.visible });
        return true;
      }

      if (message?.type === "HCR_RESET_OVERLAY") {
        state = { ...DEFAULT_STATE, visible: true };
        applyState();
        persistState();
        sendResponse({ ok: true });
        return true;
      }

      if (message?.type === "HCR_STOP_RECORDING") {
        stopRecording();
        sendResponse({ ok: true, recording: mediaRecorder?.state === "recording" });
        return true;
      }

      return false;
    });
  }

  window.addEventListener("resize", () => {
    constrainToViewport();
    applyState();
    persistState();
  });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
