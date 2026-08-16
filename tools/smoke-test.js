const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const server = await startServer(rootDir);
  const baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    await testLoadedExtension(`${baseUrl}/demo/test-page.html`);
    await testRecordingFlow(`${baseUrl}/demo/test-page.html`);
    console.log("Smoke tests passed");
  } finally {
    await server.close();
  }
}

async function testLoadedExtension(url) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcr-extension-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${rootDir}`,
      `--load-extension=${rootDir}`,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream"
    ]
  });

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("html-camera-recorder", { timeout: 8000 });

    const initialBox = await page.locator("html-camera-recorder").boundingBox();
    assert(initialBox && initialBox.width >= 168, "overlay should be visible with a stable width");

    await dragFrom(page, initialBox.x + 130, initialBox.y + 16, 58, 42);
    const draggedLeft = await page.locator("html-camera-recorder").evaluate((host) => Number.parseFloat(host.style.left));
    assert(draggedLeft >= 50, "overlay should be draggable");

    const afterDragBox = await page.locator("html-camera-recorder").boundingBox();
    await dragFrom(page, afterDragBox.x + afterDragBox.width - 4, afterDragBox.y + afterDragBox.height - 4, 42, 36);
    const resizedBox = await page.locator("html-camera-recorder").boundingBox();
    assert(resizedBox.width > afterDragBox.width, "overlay should be resizable");

    await page.locator("html-camera-recorder .settings-button").click();
    await page.locator("html-camera-recorder [data-shape='circle']").click();
    const shape = await page.locator("html-camera-recorder").evaluate((host) => {
      return host.shadowRoot.querySelector(".preview-frame").dataset.shape;
    });
    assert(shape === "circle", "shape control should update the preview mask");
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function testRecordingFlow(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        runtime: {
          getURL: (resource) => `/${resource}`,
          lastError: null,
          sendMessage: (message, callback) => {
            if (message?.type === "HCR_GET_TAB_STREAM_ID") {
              callback({ ok: true, streamId: "fake-tab-stream-id" });
              return;
            }
            callback({ ok: false, error: "Unknown message" });
          },
          onMessage: { addListener: (listener) => { window.__hcrMessageListener = listener; } }
        },
        storage: {
          local: {
            get: (_key, callback) => callback({}),
            set: () => undefined
          }
        }
      }
    });

    function makeMediaStream() {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const context2d = canvas.getContext("2d");
      let frame = 0;
      window.setInterval(() => {
        frame += 1;
        context2d.fillStyle = frame % 2 ? "#2563eb" : "#14b8a6";
        context2d.fillRect(0, 0, canvas.width, canvas.height);
        context2d.fillStyle = "#ffffff";
        context2d.font = "24px sans-serif";
        context2d.fillText(`frame ${frame}`, 24, 96);
      }, 50);
      const stream = canvas.captureStream(30);
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const destination = audioContext.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      return stream;
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: (constraints) => {
          if (constraints?.video?.mandatory?.chromeMediaSource === "tab") {
            window.__hcrRequestedTabCapture = constraints.video.mandatory.chromeMediaSourceId;
          }
          return Promise.resolve(makeMediaStream());
        },
        getDisplayMedia: () => {
          throw new Error("getDisplayMedia should not be used for current-tab recording");
        }
      }
    });

    class FakeMediaRecorder extends EventTarget {
      constructor(stream, options = {}) {
        super();
        this.stream = stream;
        this.mimeType = options.mimeType || "video/mp4";
        this.state = "inactive";
        window.__hcrRecordedTrackCounts = {
          audio: stream.getAudioTracks().length,
          video: stream.getVideoTracks().length
        };
      }

      static isTypeSupported(mimeType) {
        return mimeType.startsWith("video/mp4") || mimeType.startsWith("video/webm");
      }

      start() {
        this.state = "recording";
        this.timer = window.setInterval(() => {
          const event = new Event("dataavailable");
          event.data = new Blob(["fake-recording"], { type: this.mimeType });
          this.dispatchEvent(event);
        }, 80);
      }

      stop() {
        if (this.state !== "recording") {
          return;
        }
        window.clearInterval(this.timer);
        const event = new Event("dataavailable");
        event.data = new Blob(["fake-recording"], { type: this.mimeType });
        this.dispatchEvent(event);
        this.state = "inactive";
        this.dispatchEvent(new Event("stop"));
      }
    }

    window.MediaRecorder = FakeMediaRecorder;

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      if (this.download) {
        window.__hcrDownloaded = {
          download: this.download,
          href: this.href
        };
        return;
      }
      originalClick.call(this);
    };
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: path.join(rootDir, "src", "content.js") });
    await page.waitForSelector("html-camera-recorder", { timeout: 5000 });

    await page.locator("html-camera-recorder .camera-button").click();
    await page.waitForFunction(() => {
      const host = document.querySelector("html-camera-recorder");
      return Boolean(host?.shadowRoot?.querySelector("video")?.srcObject);
    });

    await page.evaluate(() => new Promise((resolve) => {
      window.__hcrMessageListener({ type: "HCR_START_RECORDING", mode: "tab" }, {}, resolve);
    }));
    await page.waitForFunction(() => {
      const host = document.querySelector("html-camera-recorder");
      return host?.hasAttribute("recording") &&
        host.shadowRoot.querySelector(".record-button")?.dataset.recording === "true";
    });
    const recordingTracks = await page.evaluate(() => ({
      streamId: window.__hcrRequestedTabCapture,
      counts: window.__hcrRecordedTrackCounts
    }));
    assert(recordingTracks.streamId === "fake-tab-stream-id", "recording should request current tab capture");
    assert(recordingTracks.counts.audio > 0, "recording should include an audio track");
    assert(recordingTracks.counts.video > 0, "recording should include a video track");
    const recordingUi = await page.locator("html-camera-recorder").evaluate((host) => {
      const root = host.shadowRoot;
      return {
        toolbarDisplay: getComputedStyle(root.querySelector(".toolbar")).display,
        resizeDisplay: getComputedStyle(root.querySelector(".resize-handle")).display,
        panelShadow: getComputedStyle(root.querySelector(".panel")).boxShadow,
        panelRadius: getComputedStyle(root.querySelector(".panel")).borderRadius
      };
    });
    assert(recordingUi.toolbarDisplay === "none", "toolbar should be hidden while recording");
    assert(recordingUi.resizeDisplay === "none", "resize handle should be hidden while recording");
    assert(recordingUi.panelShadow === "none", "panel shadow should be removed while recording");
    assert(recordingUi.panelRadius === "0px", "panel corners should be removed while recording");
    await page.waitForTimeout(180);
    await page.evaluate(() => new Promise((resolve) => {
      window.__hcrMessageListener({ type: "HCR_STOP_RECORDING" }, {}, resolve);
    }));
    await page.waitForFunction(() => window.__hcrDownloaded?.download?.endsWith(".mp4"));

    const downloadName = await page.evaluate(() => window.__hcrDownloaded.download);
    assert(downloadName.startsWith("html-camera-recording-"), "recording should use the expected filename prefix");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function dragFrom(page, x, y, dx, dy) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

function startServer(directory) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const filePath = path.normalize(path.join(directory, pathname));

    if (!filePath.startsWith(directory)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-store"
      });
      response.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: server.address().port,
        close: () => new Promise((done) => server.close(done))
      });
    });
    server.on("error", reject);
  });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
