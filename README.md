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
5. To avoid Chrome's screen/window picker, click the extension icon and use **Start recording current tab**.
6. You can also use the floating record button after the extension has been invoked for the page.
7. Stop recording by double-clicking the camera preview or using the extension popup's **Stop recording** button.

Chrome does not allow extensions to inject scripts into browser-internal pages such as `chrome://extensions`, the Chrome Web Store, or extension gallery pages.

Chrome also does not allow an extension to silently capture the whole desktop or an arbitrary OS-level window/region. This extension records the current tab directly. Region recording is limited to a selected rectangle inside the current tab viewport.

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
