(function () {
  const status = document.getElementById("status");
  const targetTab = document.getElementById("targetTab");
  const modeTab = document.getElementById("modeTab");
  const modeScreen = document.getElementById("modeScreen");
  const startRecording = document.getElementById("startRecording");
  const stopRecording = document.getElementById("stopRecording");
  const refreshTabs = document.getElementById("refreshTabs");
  const toggleOverlay = document.getElementById("toggleOverlay");
  const prompter = document.getElementById("prompter");
  const prompterHandle = document.getElementById("prompterHandle");
  const opacity = document.getElementById("opacity");
  const promptText = document.getElementById("promptText");
  const copyPrompt = document.getElementById("copyPrompt");
  const clearPrompt = document.getElementById("clearPrompt");

  let mode = "tab";

  boot();

  async function boot() {
    bindModeButtons();
    bindPrompter();
    bindActions();
    await loadTabs();
  }

  function bindModeButtons() {
    modeTab.addEventListener("click", () => setMode("tab"));
    modeScreen.addEventListener("click", () => setMode("screen"));
  }

  function bindActions() {
    refreshTabs.addEventListener("click", loadTabs);
    targetTab.addEventListener("change", () => {
      chrome.runtime.sendMessage({ type: "HCR_SET_TARGET_TAB", tabId: Number(targetTab.value) });
    });

    startRecording.addEventListener("click", async () => {
      await sendPanelMessage({
        type: "HCR_PANEL_START",
        mode,
        tabId: Number(targetTab.value)
      }, "已开始录制。");
    });

    stopRecording.addEventListener("click", async () => {
      await sendPanelMessage({ type: "HCR_PANEL_STOP" }, "已请求停止录制。");
    });

    toggleOverlay.addEventListener("click", async () => {
      await sendPanelMessage({ type: "HCR_PANEL_TOGGLE_OVERLAY" }, "已切换摄像头浮窗。");
    });

    copyPrompt.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(promptText.value);
        setStatus("题词文本已复制。");
      } catch (_error) {
        promptText.select();
        document.execCommand("copy");
        setStatus("题词文本已复制。");
      }
    });

    clearPrompt.addEventListener("click", () => {
      promptText.value = "";
      setStatus("题词板已清空。");
    });
  }

  function bindPrompter() {
    opacity.addEventListener("input", () => {
      prompter.style.backgroundColor = `rgba(17, 24, 39, ${Number(opacity.value) / 100})`;
    });

    let start = null;
    prompterHandle.addEventListener("pointerdown", (event) => {
      const rect = prompter.getBoundingClientRect();
      start = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: rect.left,
        y: rect.top
      };
      prompterHandle.setPointerCapture(event.pointerId);
    });

    prompterHandle.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) {
        return;
      }

      const x = clamp(start.x + event.clientX - start.pointerX, 0, window.innerWidth - prompter.offsetWidth);
      const y = clamp(start.y + event.clientY - start.pointerY, 0, window.innerHeight - prompter.offsetHeight);
      prompter.style.left = `${Math.round(x)}px`;
      prompter.style.top = `${Math.round(y)}px`;
    });

    prompterHandle.addEventListener("pointerup", () => {
      start = null;
    });
    prompterHandle.addEventListener("pointercancel", () => {
      start = null;
    });
  }

  async function loadTabs() {
    const response = await chrome.runtime.sendMessage({ type: "HCR_GET_RECORDABLE_TABS" });
    if (!response?.ok) {
      setStatus(response?.error || "无法读取标签页。");
      return;
    }

    targetTab.textContent = "";
    response.tabs.forEach((tab) => {
      const option = document.createElement("option");
      option.value = String(tab.id);
      option.textContent = tab.title;
      option.title = tab.url;
      targetTab.appendChild(option);
    });

    const selected = response.targetTabId || response.tabs.find((tab) => tab.active)?.id || response.tabs[0]?.id;
    if (selected) {
      targetTab.value = String(selected);
      chrome.runtime.sendMessage({ type: "HCR_SET_TARGET_TAB", tabId: selected });
    }

    setStatus(response.tabs.length ? "目标标签页已就绪。" : "没有可录制的普通网页。");
  }

  function setMode(nextMode) {
    mode = nextMode;
    modeTab.classList.toggle("selected", mode === "tab");
    modeScreen.classList.toggle("selected", mode === "screen");
    setStatus(mode === "tab" ? "将录制所选标签页，可切换到其他 tab。" : "将打开屏幕/窗口选择器。");
  }

  async function sendPanelMessage(message, successText) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response?.ok === false) {
        throw new Error(response.error || "操作失败。");
      }
      setStatus(successText);
    } catch (error) {
      setStatus(error.message || "操作失败。");
    }
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }
})();
