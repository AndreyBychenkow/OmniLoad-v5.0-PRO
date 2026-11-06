const LOCAL_SERVER = "http://127.0.0.1:8000";

let pollingTimers = new Map();

async function isLocalServerRunning() {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${LOCAL_SERVER}/api/system-info`, { signal: controller.signal });
    clearTimeout(id);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function tryExtractVkDirect(rawUrl) {
  const mVid = rawUrl.match(/(?:video|clip)(-?\d+_\d+)/i);
  if (!mVid) return null;
  const videoId = mVid[1];
  let listId = "";
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl);
    listId = u.searchParams.get("list") || "";
  } catch (e) {}

  const params = new URLSearchParams();
  params.set("act", "show");
  params.set("al", "1");
  params.set("video", videoId);
  if (listId) params.set("list", listId);

  for (const host of ["https://vkvideo.ru", "https://vk.ru", "https://vk.com"]) {
    try {
      const resp = await fetch(`${host}/al_video.php?act=show`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: params.toString(),
      });
      const data = await resp.json();
      for (const item of data?.payload?.[1] || []) {
        if (item?.player?.params?.[0]) {
          return { videoId, playerParams: item.player.params[0] };
        }
      }
    } catch (err) {}
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_DOWNLOAD") {
    handleStartDownload(msg.url, msg.mode)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === "PAUSE_DOWNLOAD") {
    handleControlAction("pause", msg.taskId)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === "RESUME_DOWNLOAD") {
    handleControlAction("resume", msg.taskId)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === "CANCEL_DOWNLOAD") {
    handleControlAction("cancel", msg.taskId)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function handleControlAction(action, taskId) {
  if (!taskId) return { ok: false, error: "Нет активной задачи" };
  const res = await fetch(`${LOCAL_SERVER}/api/${action}/${taskId}`, {
    method: "POST",
  });
  const task = await res.json();
  if (!res.ok) {
    throw new Error(task.detail || "Ошибка управления загрузкой");
  }

  const updated = {
    task_id: taskId,
    server: LOCAL_SERVER,
    status: task.status,
    paused: Boolean(task.paused),
    cancelled: Boolean(task.cancelled),
    title: task.title,
    progress: task.progress || 0,
    stage_text: task.stage_text || "",
    speed_str: task.speed_str || "",
    error: task.error || "",
    filename: task.filename || "",
  };
  await chrome.storage.local.set({ activeTask: updated });

  if (action === "cancel" && pollingTimers.has(taskId)) {
    clearInterval(pollingTimers.get(taskId));
    pollingTimers.delete(taskId);
  }
  return { ok: true, state: updated };
}

async function handleStartDownload(rawUrl, mode) {
  const isVk = /(?:vk\.com|vk\.ru|vkvideo\.ru)/i.test(rawUrl) && /(?:video|clip)(-?\d+_\d+)/i.test(rawUrl);
  const alive = await isLocalServerRunning();

  let urlToSend = rawUrl;
  let customTitle = "";

  if (isVk) {
    const vkData = await tryExtractVkDirect(rawUrl);
    if (vkData && vkData.playerParams) {
      const p = vkData.playerParams;
      customTitle = p.md_title || "VK_Video_" + vkData.videoId;

      let order = ["url2160", "url1440", "url1080", "url720", "url480", "url360", "url240"];
      if (mode === "1080p") order = ["url1080", "url720", "url480", "url360", "url240"];
      else if (mode === "720p") order = ["url720", "url480", "url360", "url240"];
      else if (mode === "480p") order = ["url480", "url360", "url240"];
      else if (mode === "360p") order = ["url360", "url240"];
      else if (mode === "audio_mp3") order = ["url720", "url480", "url360", "url1080", "url240"];

      for (const k of order) {
        if (p[k]) {
          urlToSend = p[k];
          break;
        }
      }
    }
  }

  if (!alive) {
    throw new Error(
      "Программа OmniLoad.exe ещё не запущена на ПК! Запустите OmniLoad.exe один раз (после запуска окно программы можно закрыть — расширение продолжит работать в фоне)."
    );
  }

  const res = await fetch(`${LOCAL_SERVER}/api/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: urlToSend, mode, custom_title: customTitle }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Не удалось запустить загрузку");
  }

  const taskState = {
    task_id: data.task_id,
    server: LOCAL_SERVER,
    status: "downloading",
    paused: false,
    cancelled: false,
    title: data.title || "Подготовка видео...",
    progress: 5,
    stage_text: "Сохранение на Рабочий стол...",
  };
  await chrome.storage.local.set({ activeTask: taskState });

  startBackgroundPolling(LOCAL_SERVER, data.task_id);
  return { ok: true, direct: false, state: taskState };
}

function startBackgroundPolling(server, taskId) {
  if (pollingTimers.has(taskId)) return;

  const timer = setInterval(async () => {
    try {
      const res = await fetch(`${server}/api/status/${taskId}`);
      if (!res.ok) {
        clearInterval(timer);
        pollingTimers.delete(taskId);
        return;
      }
      const task = await res.json();
      await chrome.storage.local.set({
        activeTask: {
          task_id: taskId,
          server,
          status: task.status,
          paused: Boolean(task.paused),
          cancelled: Boolean(task.cancelled),
          title: task.title,
          progress: task.progress || 0,
          stage_text: task.stage_text || "Загрузка...",
          speed_str: task.speed_str || "",
          error: task.error || "",
          filename: task.filename || "",
        },
      });

      if (task.status === "completed" || task.status === "error" || task.status === "cancelled") {
        clearInterval(timer);
        pollingTimers.delete(taskId);
      }
    } catch (e) {}
  }, 550);

  pollingTimers.set(taskId, timer);
}
