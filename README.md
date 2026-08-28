# Chrome Webcord

Webcord is a Manifest V3 Chrome extension that records the **current tab** (with an optional camera overlay). It uses `chrome.tabCapture`, so there is no desktop or window picker.

It is meant for walking through a webpage, demonstrating UI, or recording a page with your face on screen. It is not a desktop recorder or a video editor.

## Features

### Recording

- Records the current tab only — no screen / window / other-app capture
- **Full page**: the visible viewport
- **Region**: a boxed area inside the viewport, with optional aspect lock (`16:9`, `4:3`, `1:1`, `3:4`, `9:16`, or `Any`)
- Optional tab audio and microphone
- Prefers **MP4**; falls back to **WebM** when the browser cannot record MP4
- **Stop** downloads the file; **Cancel** discards it and shows a toast
- Record, pause, resume, stop, and cancel from the popup, or from the in-page region dock

### Camera overlay (off by default)

- Draggable and resizable floating preview
- Shape: square or circle
- Border width and color (color is hidden when width is `0`)
- Position, shape, and border are remembered per tab in `sessionStorage`
- New tabs and same-tab refreshes reset to: camera off, microphone off, full-page recording

### Language and pages

- Chinese and English (follows Chrome UI language until you pick one)
- Works on ordinary websites and local `file://` HTML (enable **Allow access to file URLs**)
- Cannot inject into or record `chrome://` pages, the Chrome Web Store, or similar internal pages

### Recording rules

- Switching away from the recording tab **in the same window** pauses recording
- Closing the recording tab **cancels** and does not save
- Only one tab can record or pause at a time; Record is greyed out on other tabs

## Strengths

- Start recording the current page without a system capture picker
- The camera overlay is part of the page, so it is captured together with the tab
- Region + aspect ratios make it easy to cut vertical or square clips
- Stop vs cancel is explicit, so a discarded take is not saved by accident
- Permissions stay narrower than full desktop capture
- Bilingual UI; local HTML files are supported

## Limitations

- Current tab only: not the desktop, other apps, or other windows (Chrome API limit)
- Switching tabs in the same window pauses; closing the tab discards the take (no auto-save)
- A region is a viewport box, not the full scrolled document
- Internal pages and some protected / DRM content cannot be recorded
- One recording at a time
- No cloud upload, trimming, multi-camera, or system audio from other apps
- Chrome-only (`tabCapture`); load as an unpacked extension
- Overlay shape and border live on the overlay settings panel, not in the popup

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. For local `file://` HTML pages, open the extension details page and enable **Allow access to file URLs**.

## Usage

1. Open a normal website or an HTML file.
2. Click the extension icon. Recording controls are in the popup; the camera overlay stays off until you turn it on.
3. Optionally turn on the camera, then drag the preview to move it or drag the lower-right corner to resize. Overlay settings change shape and border.
4. In popup settings, choose **Full page** or **Region**. For a region, pick an aspect ratio and draw (or adjust) the box on the page.
5. Start recording. Pause, resume, cancel, or stop from the popup or the region dock. Stopping downloads the file; cancel discards it.

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
