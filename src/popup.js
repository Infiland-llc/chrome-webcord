(function () {
  const status = document.getElementById("status");
  const startRecording = document.getElementById("startRecording");
  const toggleOverlay = document.getElementById("toggleOverlay");
  const stopRecording = document.getElementById("stopRecording");
  const resetOverlay = document.getElementById("resetOverlay");

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("没有找到当前标签页。");
    }

    return tab;
  }

  function canInject(tab) {
    const url = tab.url || "";
    return (/^https?:\/\//.test(url) || /^file:\/\//.test(url)) && !isRestrictedPage(url);
  }

  function isRestrictedPage(url) {
    return (
      /^chrome:\/\//.test(url) ||
      /^edge:\/\//.test(url) ||
      /^about:/.test(url) ||
      /^chrome-extension:\/\//.test(url) ||
      /^https:\/\/chromewebstore\.google\.com\//.test(url) ||
      /^https:\/\/chrome\.google\.com\/webstore\//.test(url) ||
      /^https:\/\/microsoftedge\.microsoft\.com\/addons\//.test(url)
    );
  }

  function isMissingReceiver(error) {
    return String(error?.message || error).includes("Receiving end does not exist");
  }

  async function injectContentScript(tab) {
    if (!canInject(tab)) {
      throw new Error(`当前标签页禁止扩展注入：${tab.url || "未知页面"}。请先切换到要录制的网页或 HTML 页面。`);
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });
  }

  async function sendToActiveTab(message) {
    const tab = await getActiveTab();
    let response;

    try {
      response = await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      if (!isMissingReceiver(error)) {
        throw error;
      }

      try {
        await injectContentScript(tab);
        response = await chrome.tabs.sendMessage(tab.id, message);
      } catch (injectError) {
        if (/^file:\/\//.test(tab.url || "")) {
          throw new Error("请在扩展详情里开启“允许访问文件网址”，然后刷新 HTML 页面。");
        }
        if (isRestrictedPage(tab.url || "") || String(injectError?.message || injectError).includes("extensions gallery")) {
          throw new Error(`Chrome 不允许在此页面注入：${tab.url || "未知页面"}。请先切换到要录制的网页或 HTML 页面。`);
        }
        throw injectError;
      }
    }

    if (response?.ok === false) {
      throw new Error(response.error || "操作失败。");
    }

    return response;
  }

  function setStatus(text) {
    status.textContent = text;
  }

  toggleOverlay.addEventListener("click", async () => {
    try {
      await sendToActiveTab({ type: "HCR_TOGGLE_OVERLAY" });
      setStatus("已切换浮窗。");
    } catch (error) {
      setStatus(error.message || "当前页面无法注入扩展。");
    }
  });

  startRecording.addEventListener("click", async () => {
    try {
      await sendToActiveTab({ type: "HCR_START_RECORDING" });
      setStatus("已开始录制当前页。");
    } catch (error) {
      setStatus(error.message || "当前页面无法开始录制。");
    }
  });

  stopRecording.addEventListener("click", async () => {
    try {
      await sendToActiveTab({ type: "HCR_STOP_RECORDING" });
      setStatus("已请求停止录制。");
    } catch (error) {
      setStatus(error.message || "当前页面无法停止录制。");
    }
  });

  resetOverlay.addEventListener("click", async () => {
    try {
      await sendToActiveTab({ type: "HCR_RESET_OVERLAY" });
      setStatus("已重置浮窗。");
    } catch (error) {
      setStatus(error.message || "当前页面无法注入扩展。");
    }
  });
})();
