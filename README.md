# Chrome Webcord

Chrome Webcord is a Manifest V3 extension that adds a draggable camera overlay to ordinary web pages or local HTML files, then records the page activity together with the camera window.

## Features

- Floating camera preview injected into supported pages
- Drag-and-drop positioning
- Resizable camera window
- Adjustable mask shape: square, rounded rectangle, or circle
- Configurable corner radius, border width, and border color
- Clean recording mode that hides controls, shadows, handles, and status text
- Page and camera recording through browser-native `getDisplayMedia`, `getUserMedia`, and `MediaRecorder`
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
5. Click the record button.
6. In Chrome's share picker, choose the current tab or current window so the camera overlay is included.
7. Stop recording by double-clicking the camera preview or using the extension popup's **Stop recording** button.

Chrome does not allow extensions to inject scripts into browser-internal pages such as `chrome://extensions`, the Chrome Web Store, or extension gallery pages.

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
