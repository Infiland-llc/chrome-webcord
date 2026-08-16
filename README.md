# Chrome Webcord

Chrome Webcord is a Manifest V3 extension that adds a draggable camera overlay to ordinary web pages or local HTML files, then records the page activity together with the camera window.

## Features

- Floating camera preview injected into supported pages
- Drag-and-drop positioning
- Resizable camera window
- Adjustable mask shape: square, rounded rectangle, or circle
- Configurable corner radius, border width, and border color
- Clean recording mode that hides controls, shadows, handles, and status text
- Current-tab recording without Chrome's screen/window picker, using `chrome.tabCapture`
- Optional fixed-region recording inside the current tab's visible viewport
- Mixed audio from the captured tab and camera microphone
- Separate floating control panel with start/stop controls that is not part of the captured tab
- Draggable semi-transparent teleprompter with opacity control, scrollable text, and copy support
- Cross-tab workflow: keep recording the selected tab while switching to other tabs
- Screen/window recording through Chrome's desktop capture picker
- MP4 output when the installed Chrome build supports MP4 recording, with WebM fallback

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. For local `file://` HTML pages, open the extension details page and enable **Allow access to file URLs**.

## Usage

1. Open a normal website or an HTML file.
2. Use the floating camera button to start camera preview.
3. Drag the toolbar to move the overlay, or drag the lower-right corner to resize it.
4. Open the settings button to change mask shape, corner radius, border width, or border color.
5. Click the extension icon and choose **Open floating control panel**.
6. Pick the target tab in the floating panel.
7. Choose **Current tab** to record the selected tab without Chrome's screen/window picker.
8. Choose **Screen/window** to use Chrome's desktop capture picker.
9. Use the teleprompter in the floating panel while recording. It is separate from the captured tab.
10. Stop recording from the floating panel or by double-clicking the camera preview.

Chrome does not allow extensions to inject scripts into browser-internal pages such as `chrome://extensions`, the Chrome Web Store, or extension gallery pages.

Chrome also does not allow an extension to silently capture the whole desktop or an arbitrary OS-level window/region. This extension records the selected tab directly, and screen/window recording uses Chrome's required desktop capture picker.

The floating control panel and teleprompter are not rendered into current-tab recordings because they live in a separate extension window. If you record an entire screen, any visible real window on that screen can be captured by the operating-system-level source.

## Test

The project includes a local demo page:

```text
demo/test-page.html
```

Automated smoke tests are available in:

```text
tools/smoke-test.js
```

Run the test with Node.js and Playwright available:

```bash
node tools/smoke-test.js
```

The smoke test validates extension injection, drag, resize, mask switching, clean recording UI, and the recording save flow.
