const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 480;
const panelState = {
  windowId: null,
  targetTabId: null
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "HCR_GET_TAB_STREAM_ID") {
    handleGetTabStreamId(sender, sendResponse);
    return true;
  }

  if (message?.type === "HCR_OPEN_PANEL") {
    openPanel(message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_TOGGLE_PANEL") {
    togglePanel(message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_GET_RECORDABLE_TABS") {
    getRecordableTabs()
      .then((tabs) => sendResponse({ ok: true, tabs, targetTabId: panelState.targetTabId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_SET_TARGET_TAB") {
    panelState.targetTabId = Number(message.tabId);
    sendResponse({ ok: true, targetTabId: panelState.targetTabId });
    return true;
  }

  if (message?.type === "HCR_PANEL_START") {
    startFromPanel(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_PANEL_STOP") {
    sendToTarget({ type: "HCR_STOP_RECORDING" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_PANEL_CANCEL") {
    sendToTarget({ type: "HCR_CANCEL_RECORDING" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_TOGGLE_PAUSE") {
    sendToTarget({ type: "HCR_TOGGLE_PAUSE" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_GET_OVERLAY_STATE") {
    sendToTarget({ type: "HCR_GET_OVERLAY_STATE" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_TOGGLE_OVERLAY") {
    sendToTarget({ type: "HCR_TOGGLE_OVERLAY" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_SET_RECORD_AREA") {
    sendToTarget({ type: "HCR_SET_RECORD_AREA", recordArea: message.recordArea }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_TOGGLE_MICROPHONE") {
    sendToTarget({ type: "HCR_TOGGLE_MICROPHONE" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_PANEL_TOGGLE_OVERLAY") {
    sendToTarget({ type: "HCR_TOGGLE_OVERLAY" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_PANEL_TOGGLE_PROMPTER") {
    sendToTarget({ type: "HCR_TOGGLE_PROMPTER" })
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_PANEL_RESET_OVERLAY") {
    sendToTarget({ type: "HCR_RESET_OVERLAY" })
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_RECORDING_STATE") {
    if (sender.tab) {
      chrome.runtime.sendMessage({
        type: "HCR_RECORDING_STATE",
        ok: true,
        recording: Boolean(message.recording),
        paused: Boolean(message.paused),
        elapsedMs: Number(message.elapsedMs) || 0
      }).catch(() => undefined);
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === panelState.windowId) {
    panelState.windowId = null;
  }
});

async function togglePanel(tabId) {
  if (panelState.windowId) {
    try {
      await chrome.windows.remove(panelState.windowId);
      panelState.windowId = null;
      return { ok: true, open: false };
    } catch (_error) {
      panelState.windowId = null;
    }
  }

  const result = await openPanel(tabId);
  return { ...result, open: true };
}

async function openPanel(tabId) {
  if (tabId) {
    panelState.targetTabId = Number(tabId);
  }

  const url = chrome.runtime.getURL("panel.html");
  if (panelState.windowId) {
    try {
      await chrome.windows.update(panelState.windowId, { focused: true });
      return { ok: true, windowId: panelState.windowId };
    } catch (_error) {
      panelState.windowId = null;
    }
  }

  const windowInfo = await chrome.windows.create({
    url,
    type: "popup",
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    focused: true
  });
  panelState.windowId = windowInfo.id;
  return { ok: true, windowId: windowInfo.id };
}

async function getRecordableTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((tab) => tab.id && canInject(tab.url || ""))
    .map((tab) => ({
      id: tab.id,
      title: tab.title || tab.url || `Tab ${tab.id}`,
      url: tab.url || "",
      active: tab.active
    }));
}

async function startFromPanel(message) {
  const mode = message.mode || "tab";
  if (message.tabId) {
    panelState.targetTabId = Number(message.tabId);
  }
  const tabId = await getTargetTabId();
  await ensureContentScript(tabId);

  if (mode === "screen") {
    return startDesktopCapture(tabId);
  }

  const result = await sendToTarget({ type: "HCR_START_RECORDING", mode: "tab" });
  await reopenActionPopup(tabId);
  return result;
}

async function reopenActionPopup(tabId) {
  if (typeof chrome.action?.openPopup !== "function") {
    return;
  }
  let windowId;
  try {
    const tab = await chrome.tabs.get(tabId);
    windowId = tab.windowId;
  } catch (_error) {
    return;
  }
  const open = () => chrome.action.openPopup(windowId ? { windowId } : {}).catch(() => undefined);
  await open();
}

function startDesktopCapture(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error || !tab) {
        resolve({ ok: false, error: error?.message || "Target tab was not found." });
        return;
      }

      chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab", "audio"], tab, (streamId, options) => {
        if (!streamId) {
          resolve({ ok: false, error: "Screen capture was cancelled." });
          return;
        }

        chrome.tabs.sendMessage(
          tabId,
          {
            type: "HCR_START_RECORDING",
            mode: "desktop",
            streamId,
            canRequestAudioTrack: Boolean(options?.canRequestAudioTrack)
          },
          (response) => {
            const sendError = chrome.runtime.lastError;
            resolve(sendError ? { ok: false, error: sendError.message } : normalizeResponse(response));
          }
        );
      });
    });
  });
}

async function sendToTarget(message, tabId) {
  if (tabId) {
    panelState.targetTabId = Number(tabId);
  }
  const targetTabId = await getTargetTabId();
  await ensureContentScript(targetTabId);
  return chrome.tabs.sendMessage(targetTabId, message).then(normalizeResponse);
}

async function getTargetTabId() {
  if (panelState.targetTabId) {
    return panelState.targetTabId;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !canInject(tab.url || "")) {
    throw new Error("No recordable target tab is selected.");
  }

  panelState.targetTabId = tab.id;
  return tab.id;
}

async function ensureContentScript(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!canInject(tab.url || "")) {
    throw new Error("The selected tab cannot be recorded by this extension.");
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: "HCR_PING" });
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content.js"]
    });
  }
}

function handleGetTabStreamId(sender, sendResponse) {
  const tabId = sender.tab?.id || panelState.targetTabId;
  if (!tabId) {
    sendResponse({ ok: false, error: "No active tab was found for recording." });
    return;
  }

  chrome.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId }, (streamId) => {
    const error = chrome.runtime.lastError;
    if (error || !streamId) {
      sendResponse({
        ok: false,
        error: error?.message || "Chrome could not create a tab capture stream."
      });
      return;
    }

    sendResponse({ ok: true, streamId });
  });
}

function normalizeResponse(response) {
  if (response?.ok === false) {
    return response;
  }
  return response || { ok: true };
}

function canInject(url) {
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
