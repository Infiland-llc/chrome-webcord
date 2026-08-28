(function (root) {
  const STORAGE_KEY = "hcr.locale";
  const STRINGS = {
    zh: {
      record: "录制",
      stopRecord: "停止录制",
      startRecord: "开始录制",
      pause: "暂停",
      resume: "继续录制",
      cancelRecord: "取消录制",
      hideCamera: "隐藏摄像头",
      showCamera: "显示摄像头",
      muteMic: "关闭麦克风",
      unmuteMic: "开启麦克风",
      settings: "设置",
      language: "语言",
      recordArea: "录制范围",
      fullPage: "整页",
      region: "区域",
      aspectRatio: "画面比例",
      shape: "形状",
      square: "方形",
      circle: "圆形",
      border: "边框",
      borderColor: "边框颜色",
      adjustMask: "调整蒙版",
      dragCamera: "拖拽移动摄像头浮窗",
      resize: "拖拽调整大小",
      openingCamera: "正在开启摄像头...",
      cameraDenied: "摄像头权限被拒绝或不可用",
      dragRegion: "拖拽选择录制区域",
      regionTooSmall: "区域太小，已恢复整页录制",
      regionSelected: "已选择录制区域",
      regionCancelled: "已取消区域选择",
      cannotChangeAreaWhileRecording: "录制中无法更改范围",
      cannotChangeAspectWhileRecording: "录制中无法更改画面比例",
      cannotUpdateArea: "无法更新录制范围。",
      cannotUpdateAspect: "无法更新画面比例。",
      cannotUpdateRecording: "无法更新录制状态。",
      cannotToggleCamera: "无法切换摄像头。",
      cannotToggleMic: "无法切换麦克风。",
      micDenied: "麦克风权限被拒绝或不可用",
      willRecordMic: "将录制麦克风",
      willNotRecordMic: "不录制麦克风",
      noRecordingData: "没有录到可保存的数据",
      invokeExtension: "请先点扩展图标里的“录制”",
      recordingPermissionDenied: "录制权限被取消",
      cannotStartRecording: "无法开始录制",
      noCaptureSource: "没有可用的屏幕录制来源。",
      cannotCaptureTab: "无法捕获当前标签页",
      cannotCreateRegionFrame: "无法创建区域录制画面",
      videoDownloaded: "视频已下载。",
      recordingCancelled: "录制已取消。",
      recordingElsewhere: "其他页签正在录制"
    },
    en: {
      record: "Record",
      stopRecord: "Stop recording",
      startRecord: "Start recording",
      pause: "Pause",
      resume: "Resume",
      cancelRecord: "Cancel recording",
      hideCamera: "Hide camera",
      showCamera: "Show camera",
      muteMic: "Mute microphone",
      unmuteMic: "Unmute microphone",
      settings: "Settings",
      language: "Language",
      recordArea: "Record area",
      fullPage: "Full page",
      region: "Region",
      aspectRatio: "Aspect ratio",
      shape: "Shape",
      square: "Square",
      circle: "Circle",
      border: "Border",
      borderColor: "Border color",
      adjustMask: "Adjust mask",
      dragCamera: "Drag to move the camera",
      resize: "Drag to resize",
      openingCamera: "Starting camera...",
      cameraDenied: "Camera permission denied or unavailable",
      dragRegion: "Drag to select a recording region",
      regionTooSmall: "Region too small; switched back to full page",
      regionSelected: "Recording region selected",
      regionCancelled: "Region selection cancelled",
      cannotChangeAreaWhileRecording: "Can't change area while recording",
      cannotChangeAspectWhileRecording: "Can't change aspect ratio while recording",
      cannotUpdateArea: "Couldn't update recording area.",
      cannotUpdateAspect: "Couldn't update aspect ratio.",
      cannotUpdateRecording: "Couldn't update recording.",
      cannotToggleCamera: "Couldn't toggle camera.",
      cannotToggleMic: "Couldn't toggle microphone.",
      micDenied: "Microphone permission denied or unavailable",
      willRecordMic: "Microphone will be recorded",
      willNotRecordMic: "Microphone will not be recorded",
      noRecordingData: "No recording data to save",
      invokeExtension: "Click Record in the extension popup first",
      recordingPermissionDenied: "Recording permission cancelled",
      cannotStartRecording: "Couldn't start recording",
      noCaptureSource: "No screen capture source available.",
      cannotCaptureTab: "Couldn't capture the current tab",
      cannotCreateRegionFrame: "Couldn't create the region recording frame",
      videoDownloaded: "Video downloaded.",
      recordingCancelled: "Recording cancelled.",
      recordingElsewhere: "Another tab is recording"
    }
  };

  function localeFromTag(tag) {
    const lower = String(tag || "").trim().toLowerCase().replace(/_/g, "-");
    if (!lower) {
      return null;
    }
    return lower.split("-")[0] === "zh" ? "zh" : "en";
  }

  function detect() {
    try {
      const fromUi = localeFromTag(root.chrome?.i18n?.getUILanguage?.());
      if (fromUi) {
        return fromUi;
      }
    } catch (_error) {
      // chrome.i18n is missing outside extension pages.
    }
    try {
      const languages = root.navigator?.languages;
      if (Array.isArray(languages)) {
        for (const item of languages) {
          const mapped = localeFromTag(item);
          if (mapped) {
            return mapped;
          }
        }
      }
      const fromNav = localeFromTag(root.navigator?.language);
      if (fromNav) {
        return fromNav;
      }
    } catch (_error) {
      // navigator language can be unavailable in some test harnesses.
    }
    return "en";
  }

  function normalize(locale) {
    if (locale === "zh" || locale === "en") {
      return locale;
    }
    return localeFromTag(locale) || detect();
  }

  function t(locale, key) {
    const pack = STRINGS[normalize(locale)] || STRINGS.zh;
    return pack[key] || STRINGS.zh[key] || key;
  }

  function apply(tree, locale) {
    if (!tree?.querySelectorAll) {
      return;
    }
    const lang = normalize(locale);
    if (tree === document || tree === document.documentElement) {
      document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    }
    tree.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = t(lang, key);
      }
    });
    tree.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) {
        return;
      }
      const text = t(lang, key);
      el.title = text;
      el.setAttribute("aria-label", text);
    });
    tree.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key) {
        el.setAttribute("aria-label", t(lang, key));
      }
    });
    tree.querySelectorAll("[data-locale]").forEach((el) => {
      el.setAttribute("aria-pressed", String(el.getAttribute("data-locale") === lang));
    });
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        const api = root.chrome?.storage?.local;
        if (!api?.get) {
          resolve({});
          return;
        }
        const result = api.get(key);
        if (result && typeof result.then === "function") {
          result.then((value) => resolve(value || {})).catch(() => resolve({}));
          return;
        }
        api.get(key, (value) => resolve(value || {}));
      } catch (_error) {
        resolve({});
      }
    });
  }

  async function load() {
    const stored = await storageGet(STORAGE_KEY);
    const value = stored[STORAGE_KEY];
    if (value === "zh" || value === "en") {
      return value;
    }
    return detect();
  }

  async function save(locale) {
    const lang = normalize(locale);
    try {
      await root.chrome?.storage?.local?.set?.({ [STORAGE_KEY]: lang });
    } catch (_error) {
      // storage can be unavailable in tests or restricted pages.
    }
    return lang;
  }

  root.HCR_I18N = {
    STORAGE_KEY,
    STRINGS,
    detect,
    normalize,
    t,
    apply,
    load,
    save
  };
})(typeof window !== "undefined" ? window : globalThis);
