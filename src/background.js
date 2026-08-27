const RECORDING_TAB_KEY = "hcr.recordingTabId";
const sessionState = {
  targetTabId: null,
  recordingTabId: null
};

chrome.storage.local.remove("hcr.overlay");
chrome.storage.local.get(RECORDING_TAB_KEY).then((stored) => {
  const tabId = Number(stored[RECORDING_TAB_KEY]);
  if (tabId) {
    sessionState.recordingTabId = tabId;
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  pauseRecordingIfTabChanged(activeInfo.tabId, activeInfo.windowId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (sessionState.recordingTabId !== tabId) {
    return;
  }
  rememberRecordingTab(tabId, false);
  if (sessionState.targetTabId === tabId) {
    sessionState.targetTabId = null;
  }
  chrome.runtime.sendMessage({
    type: "HCR_RECORDING_STATE",
    ok: true,
    recording: false,
    paused: false,
    elapsedMs: 0
  }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "HCR_GET_TAB_STREAM_ID") {
    handleGetTabStreamId(sender, sendResponse);
    return true;
  }

  if (message?.type === "HCR_GET_RECORDING_LOCK") {
    sendResponse({
      ok: true,
      tabId: sender.tab?.id,
      recordingTabId: sessionState.recordingTabId
    });
    return false;
  }

  if (message?.type === "HCR_START_RECORDING") {
    startTabRecording(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_STOP_RECORDING") {
    sendToTarget({ type: "HCR_STOP_RECORDING" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_CANCEL_RECORDING") {
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
    const tabId = Number(message.tabId) || null;
    sendToTarget({ type: "HCR_GET_OVERLAY_STATE" }, tabId)
      .then((result) => sendResponse(withRecordingLock(result, tabId)))
      .catch((error) => sendResponse(withRecordingLock({ ok: false, error: error.message }, tabId)));
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

  if (message?.type === "HCR_STEP_BACK_REGION") {
    sendToTarget({ type: "HCR_STEP_BACK_REGION" }, message.tabId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "HCR_SET_CROP_ASPECT") {
    sendToTarget({ type: "HCR_SET_CROP_ASPECT", cropAspect: message.cropAspect }, message.tabId)
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

  if (message?.type === "HCR_RECORDING_STATE") {
    if (sender.tab) {
      rememberRecordingTab(sender.tab.id, Boolean(message.recording));
      chrome.runtime.sendMessage({
        type: "HCR_RECORDING_STATE",
        ok: true,
        tabId: sender.tab.id,
        recording: Boolean(message.recording),
        paused: Boolean(message.paused),
        elapsedMs: Number(message.elapsedMs) || 0
      }).catch(() => undefined);
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "HCR_OVERLAY_STATE") {
    if (sender.tab) {
      chrome.runtime.sendMessage({
        type: "HCR_OVERLAY_STATE",
        ok: true,
        tabId: sender.tab.id,
        visible: Boolean(message.visible),
        recordMicrophone: Boolean(message.recordMicrophone),
        recordArea: message.recordArea === "region" ? "region" : "tab",
        cropAspect: message.cropAspect
      }).catch(() => undefined);
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function startTabRecording(message) {
  const tabId = Number(message.tabId) || sessionState.targetTabId;
  if (sessionState.recordingTabId && tabId && sessionState.recordingTabId !== tabId) {
    return { ok: false, error: "recordingElsewhere" };
  }
  if (message.tabId) {
    sessionState.targetTabId = Number(message.tabId);
  }
  const result = await sendToTarget({ type: "HCR_START_RECORDING", mode: "tab" }, message.tabId);
  if (result?.ok && result.recording) {
    rememberRecordingTab(sessionState.targetTabId, true);
  }
  return result;
}

function withRecordingLock(result, tabId) {
  const recordingTabId = sessionState.recordingTabId;
  const resolvedTabId = Number(tabId) || sessionState.targetTabId;
  return {
    ...(result || {}),
    recordingElsewhere: Boolean(recordingTabId && resolvedTabId && recordingTabId !== resolvedTabId)
  };
}

function rememberRecordingTab(tabId, recording) {
  if (recording) {
    sessionState.recordingTabId = tabId;
    chrome.storage.local.set({ [RECORDING_TAB_KEY]: tabId }).catch(() => undefined);
    return;
  }
  if (sessionState.recordingTabId === tabId) {
    sessionState.recordingTabId = null;
    chrome.storage.local.remove(RECORDING_TAB_KEY).catch(() => undefined);
  }
}

async function pauseRecordingIfTabChanged(activeTabId, windowId) {
  const recordingTabId = sessionState.recordingTabId;
  if (!recordingTabId || activeTabId === recordingTabId) {
    return;
  }
  try {
    const recordingTab = await chrome.tabs.get(recordingTabId);
    if (recordingTab.windowId !== windowId) {
      return;
    }
    await chrome.tabs.sendMessage(recordingTabId, { type: "HCR_PAUSE_RECORDING" });
  } catch (_error) {
    // The recording tab may already be gone.
  }
}

async function sendToTarget(message, tabId) {
  if (tabId) {
    sessionState.targetTabId = Number(tabId);
  }
  const targetTabId = await getTargetTabId();
  await ensureContentScript(targetTabId);
  return chrome.tabs.sendMessage(targetTabId, message).then(normalizeResponse);
}

async function getTargetTabId() {
  if (sessionState.targetTabId) {
    return sessionState.targetTabId;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !canInject(tab.url || "")) {
    throw new Error("No recordable target tab is selected.");
  }

  sessionState.targetTabId = tab.id;
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
      files: ["src/i18n.js", "src/content.js"]
    });
  }
}

function handleGetTabStreamId(sender, sendResponse) {
  const tabId = sender.tab?.id || sessionState.targetTabId;
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
