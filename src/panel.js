(function () {
  const status = document.getElementById("status");
  const targetTab = document.getElementById("targetTab");
  const modeTab = document.getElementById("modeTab");
  const modeScreen = document.getElementById("modeScreen");
  const startRecording = document.getElementById("startRecording");
  const stopRecording = document.getElementById("stopRecording");
  const refreshTabs = document.getElementById("refreshTabs");
  const toggleOverlay = document.getElementById("toggleOverlay");
  const togglePrompter = document.getElementById("togglePrompter");
  const resetOverlay = document.getElementById("resetOverlay");

  let mode = "tab";

  boot();

  async function boot() {
    bindModeButtons();
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

    togglePrompter.addEventListener("click", async () => {
      const response = await sendPanelMessage({ type: "HCR_PANEL_TOGGLE_PROMPTER" });
      if (response?.ok === false) {
        return;
      }
      setStatus(response?.visible ? "提词板已显示。" : "提词板已隐藏。");
    });

    resetOverlay.addEventListener("click", async () => {
      await sendPanelMessage({ type: "HCR_PANEL_RESET_OVERLAY" }, "已重置浮窗。");
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
      if (successText) {
        setStatus(successText);
      }
      return response;
    } catch (error) {
      setStatus(error.message || "操作失败。");
      return { ok: false, error: error.message };
    }
  }

  function setStatus(text) {
    status.textContent = text;
  }
})();
