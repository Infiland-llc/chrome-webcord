chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "HCR_GET_TAB_STREAM_ID") {
    return false;
  }

  const tabId = sender.tab?.id;
  if (!tabId) {
    sendResponse({ ok: false, error: "No active tab was found for recording." });
    return true;
  }

  chrome.tabCapture.getMediaStreamId(
    {
      targetTabId: tabId,
      consumerTabId: tabId
    },
    (streamId) => {
      const error = chrome.runtime.lastError;
      if (error || !streamId) {
        sendResponse({
          ok: false,
          error: error?.message || "Chrome could not create a tab capture stream."
        });
        return;
      }

      sendResponse({ ok: true, streamId });
    }
  );

  return true;
});
