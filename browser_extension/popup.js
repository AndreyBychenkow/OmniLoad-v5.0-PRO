const urlInput = document.getElementById("urlInput");
const pasteBtn = document.getElementById("pasteBtn");
const downloadBtn = document.getElementById("downloadBtn");
const proTopBtn = document.getElementById("proTopBtn");
const proBox = document.getElementById("proBox");
const proKeyInput = document.getElementById("proKeyInput");
const activateBtn = document.getElementById("activateBtn");
const proMsg = document.getElementById("proMsg");

const progressBox = document.getElementById("progressBox");
const pTitle = document.getElementById("pTitle");
const pStage = document.getElementById("pStage");
const pPct = document.getElementById("pPct");
const pFill = document.getElementById("pFill");
const ctrlRow = document.getElementById("ctrlRow");
const pauseBtn = document.getElementById("pauseBtn");
const cancelBtn = document.getElementById("cancelBtn");

const LOCAL_SERVER = "http://127.0.0.1:8000";
const PRO_MODES = new Set(["best_mp4", "1080p", "720p", "480p", "audio_mp3"]);
const buyProLink = document.getElementById("buyProLink");
const hwidSpan = document.getElementById("hwidSpan");
const copyHwidBtn = document.getElementById("copyHwidBtn");
const copyCardBtn = document.getElementById("copyCardBtn");

let isPro = false;
let currentHwid = "";
let remainingText = "";
let trialExpired = false;
let trialRemText = "24ч";
let selectedMode = "360p";
let currentTask = null;

const BTN_LABELS = {
  best_mp4: "⬇️ Скачать видео (Лучшее MP4)",
  "1080p": "⬇️ Скачать видео (1080p MP4)",
  "720p": "⬇️ Скачать видео (720p MP4)",
  "480p": "⬇️ Скачать видео (480p MP4)",
  "360p": "⬇️ Скачать видео (360p — Бесплатно 24ч)",
  audio_mp3: "🎵 Скачать только звук (MP3)",
};

function updateProUI() {
  if (isPro) {
    proTopBtn.textContent = remainingText ? `👑 PRO (${remainingText})` : "👑 PRO ✓";
    proTopBtn.classList.add("active");
    proBox.classList.remove("show");
  } else {
    proTopBtn.textContent = "👑 Купить PRO";
    proTopBtn.classList.remove("active");
    if (PRO_MODES.has(selectedMode)) {
      selectedMode = "360p";
    }
    if (trialExpired) {
      proBox.classList.add("show");
    }
  }

  document.querySelectorAll("#qRow .q-btn").forEach((btn) => {
    const mode = btn.getAttribute("data-mode");
    if (mode === "best_mp4") btn.textContent = (isPro ? "🎬 " : "🔒 ") + "Лучшее";
    if (mode === "1080p") btn.textContent = (isPro ? "📺 " : "🔒 ") + "1080p";
    if (mode === "720p") btn.textContent = (isPro ? "📱 " : "🔒 ") + "720p";
    if (mode === "480p") btn.textContent = (isPro ? "📹 " : "🔒 ") + "480p";
    if (mode === "360p") {
      if (isPro) btn.textContent = "📹 360p";
      else if (trialExpired) btn.textContent = "🔒 360p";
      else btn.textContent = "📹 360p (24ч)";
    }
    if (mode === "audio_mp3") btn.textContent = (isPro ? "🎵 " : "🔒 ") + "MP3";
  });

  document.querySelectorAll("#qRow .q-btn").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-mode") === selectedMode);
  });
  if (!isPro && trialExpired && selectedMode === "360p") {
    downloadBtn.textContent = "🔒 Активировать PRO (24ч пробный период истёк)";
  } else if (isPro && selectedMode === "360p") {
    downloadBtn.textContent = "⬇️ Скачать видео (360p MP4)";
  } else {
    downloadBtn.textContent = BTN_LABELS[selectedMode] || "⬇️ Скачать";
  }
}

function selectModeBtn(mode) {
  if (!isPro && (PRO_MODES.has(mode) || trialExpired)) {
    proBox.classList.add("show");
    proKeyInput.focus();
    return;
  }
  selectedMode = mode;
  document.querySelectorAll("#qRow .q-btn").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-mode") === mode);
  });
  downloadBtn.textContent = BTN_LABELS[selectedMode] || "⬇️ Скачать";
}

document.querySelectorAll("#qRow .q-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectModeBtn(btn.getAttribute("data-mode") || "360p");
  });
});

proTopBtn.addEventListener("click", () => {
  if (!isPro) {
    proBox.classList.toggle("show");
  }
});

activateBtn.addEventListener("click", async () => {
  const key = proKeyInput.value.trim();
  if (!key) {
    proMsg.textContent = "⚠️ Введите ключ активации";
    return;
  }
  try {
    const res = await fetch(`${LOCAL_SERVER}/api/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      isPro = true;
      await chrome.storage.local.set({ isPro: true });
      updateProUI();
      selectModeBtn("best_mp4");
    } else {
      proMsg.textContent = "❌ " + (data.detail || "Неверный ключ!");
    }
  } catch (e) {
    proMsg.textContent = "❌ Сначала запустите OmniLoad.exe на ПК!";
  }
});

let selectedTariffName = "На Полгода (490 ₽)";
let selectedTariffCode = "H";
let baseBuyUrl = "https://t.me/OmniLoad_Vip2026_bot";
const directSellerLink = document.getElementById("directSellerLink");

function updateBuyLinkHref() {
  if (!buyProLink) return;
  buyProLink.textContent = `🤖 Оплатить: ${selectedTariffName}`;
  const cleanBase = (baseBuyUrl || "https://t.me/OmniLoad_Vip2026_bot").trim().replace(/\/+$/, "");
  const cleanHwid = (currentHwid || "00000000").replace(/-/g, "");
  const orderMsg = `Привет, Андрей! Хочу купить ключ OmniLoad PRO. Тариф: ${selectedTariffName} | Мой Код ПК: ${currentHwid}`;
  if (cleanBase.includes("t.me/") && cleanBase.toLowerCase().endsWith("bot")) {
    buyProLink.href = `${cleanBase}?start=order_${selectedTariffCode}_${cleanHwid}`;
  } else if (cleanBase.includes("t.me/") && cleanBase.split("t.me/")[1].length > 1) {
    buyProLink.href = `${cleanBase}?text=${encodeURIComponent(orderMsg)}`;
  } else {
    buyProLink.href = cleanBase;
  }
  if (directSellerLink) {
    directSellerLink.href = `https://t.me/decebell032?text=${encodeURIComponent(orderMsg)}`;
  }
}

document.querySelectorAll("#tariffGrid .t-card").forEach((card) => {
  card.addEventListener("click", async () => {
    selectedTariffName = card.getAttribute("data-tname") || "На Полгода (490 ₽)";
    selectedTariffCode = card.getAttribute("data-tcode") || "H";
    document.querySelectorAll("#tariffGrid .t-card").forEach((c) => {
      const isAct = c === card;
      c.style.background = isAct ? "#312e81" : "#0f172a";
      c.style.borderColor = isAct ? "#818cf8" : "rgba(255,255,255,0.08)";
      const ttl = c.querySelector(".t-title");
      if (ttl) ttl.style.color = isAct ? "#fbbf24" : "#cbd5e1";
    });
    updateBuyLinkHref();
    if (currentHwid) {
      try {
        await navigator.clipboard.writeText(`Тариф: ${selectedTariffName} | Мой Код ПК: ${currentHwid}`);
      } catch (e) {}
    }
  });
});

if (copyHwidBtn) {
  copyHwidBtn.addEventListener("click", async () => {
    if (!currentHwid) return;
    try {
      await navigator.clipboard.writeText(currentHwid);
      copyHwidBtn.textContent = "✅ Скопировано!";
      setTimeout(() => (copyHwidBtn.textContent = "📋 Копировать ID"), 1500);
    } catch (e) {}
  });
}

if (copyCardBtn) {
  copyCardBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("2200 1502 9743 8522");
      copyCardBtn.textContent = "✅ Скопировано!";
      setTimeout(() => (copyCardBtn.textContent = "📋 Карта"), 1500);
    } catch (e) {}
  });
}

if (buyProLink) {
  buyProLink.addEventListener("click", async () => {
    if (currentHwid) {
      try {
        await navigator.clipboard.writeText(`Тариф: ${selectedTariffName} | Мой Код ПК: ${currentHwid}`);
      } catch (e) {}
    }
  });
}

// Проверяем статус PRO с локального сервера
(async () => {
  try {
    const res = await fetch(`${LOCAL_SERVER}/api/system-info`);
    if (res.ok) {
      const data = await res.json();
      isPro = Boolean(data.is_pro);
      remainingText = data.remaining_text || "";
      trialExpired = Boolean(data.trial_expired);
      trialRemText = data.trial_remaining_text || "24ч";
      if (data.hwid) {
        currentHwid = data.hwid;
        if (hwidSpan) hwidSpan.textContent = data.hwid;
      }
      if (data.buy_url) {
        baseBuyUrl = data.buy_url;
      }
      updateBuyLinkHref();
      await chrome.storage.local.set({ isPro });
      updateProUI();
      if (isPro) selectModeBtn("best_mp4");
    }
  } catch (e) {}
})();

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  if (tab && tab.url && /^https?:\/\//i.test(tab.url)) {
    if (/(youtube\.com\/(watch|shorts)|youtu\.be\/|vk\.com\/|vk\.ru\/|vkvideo\.ru\/|tiktok\.com\/|instagram\.com\/|rutube\.ru\/|twitch\.tv\/)/i.test(tab.url)) {
      urlInput.value = tab.url;
    }
  }
});

chrome.storage.local.get(["activeTask", "isPro"], (res) => {
  if (res && typeof res.isPro === "boolean") {
    isPro = res.isPro;
    updateProUI();
  }
  if (res && res.activeTask) {
    renderTaskState(res.activeTask);
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.activeTask && changes.activeTask.newValue) {
    renderTaskState(changes.activeTask.newValue);
  }
});

function renderTaskState(t) {
  if (!t) return;
  currentTask = t;
  progressBox.classList.add("show");
  pTitle.textContent = t.title || "Обработка видео...";

  if (t.status === "completed") {
    pStage.textContent = t.stage_text || "✅ Сохранено на Рабочий стол!";
    pPct.textContent = "100%";
    pFill.style.width = "100%";
    pFill.style.background = "#10b981";
    ctrlRow.classList.remove("show");
    downloadBtn.disabled = false;
  } else if (t.status === "cancelled") {
    pStage.textContent = t.stage_text || "⏹️ Скачивание отменено";
    pPct.textContent = "";
    pFill.style.width = "0%";
    ctrlRow.classList.remove("show");
    downloadBtn.disabled = false;
  } else if (t.status === "error") {
    pStage.textContent = "❌ " + (t.error || "Ошибка скачивания");
    pPct.textContent = "";
    pFill.style.width = "0%";
    ctrlRow.classList.remove("show");
    downloadBtn.disabled = false;
  } else if (t.status === "paused" || t.paused) {
    const pct = Math.round(t.progress || 5);
    pStage.textContent = t.stage_text || "⏸️ На паузе";
    pPct.textContent = `${pct}%`;
    pFill.style.width = `${Math.max(5, pct)}%`;
    pFill.style.background = "#f59e0b";
    ctrlRow.classList.add("show");
    pauseBtn.textContent = "▶️ Продолжить";
    pauseBtn.classList.add("resuming");
  } else {
    const pct = Math.round(t.progress || 5);
    pStage.textContent = (t.stage_text || "Загрузка...") + (t.speed_str ? ` • ${t.speed_str}` : "");
    pPct.textContent = `${pct}%`;
    pFill.style.width = `${Math.max(5, pct)}%`;
    pFill.style.background = "#10b981";
    ctrlRow.classList.add("show");
    pauseBtn.textContent = "⏸️ Пауза";
    pauseBtn.classList.remove("resuming");
  }
}

pauseBtn.addEventListener("click", () => {
  if (!currentTask || !currentTask.task_id) return;
  const isPaused = currentTask.status === "paused" || Boolean(currentTask.paused);
  const msgType = isPaused ? "RESUME_DOWNLOAD" : "PAUSE_DOWNLOAD";
  chrome.runtime.sendMessage(
    { type: msgType, taskId: currentTask.task_id },
    (resp) => {
      if (resp && resp.state) renderTaskState(resp.state);
    }
  );
});

cancelBtn.addEventListener("click", () => {
  if (!currentTask || !currentTask.task_id) return;
  chrome.runtime.sendMessage(
    { type: "CANCEL_DOWNLOAD", taskId: currentTask.task_id },
    (resp) => {
      if (resp && resp.state) renderTaskState(resp.state);
      downloadBtn.disabled = false;
    }
  );
});

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) urlInput.value = text.trim();
  } catch (e) {
    urlInput.focus();
  }
});

downloadBtn.addEventListener("click", () => {
  if (!isPro && (PRO_MODES.has(selectedMode) || trialExpired)) {
    proBox.classList.add("show");
    proKeyInput.focus();
    return;
  }

  const rawUrl = urlInput.value.trim();
  if (!rawUrl) {
    progressBox.classList.add("show");
    pTitle.textContent = "⚠️ Сначала вставьте ссылку на видео!";
    pStage.textContent = "";
    pPct.textContent = "";
    return;
  }

  downloadBtn.disabled = true;
  progressBox.classList.add("show");
  pTitle.textContent = "Подключение к видео...";
  pStage.textContent = "Запуск загрузки...";
  pPct.textContent = "5%";
  pFill.style.width = "5%";

  chrome.runtime.sendMessage(
    { type: "START_DOWNLOAD", url: rawUrl, mode: selectedMode },
    (resp) => {
      if (chrome.runtime.lastError) {
        pStage.textContent = "❌ " + chrome.runtime.lastError.message;
        downloadBtn.disabled = false;
        return;
      }
      if (!resp || !resp.ok) {
        pStage.textContent = "❌ " + (resp?.error || "Ошибка запуска");
        downloadBtn.disabled = false;
        return;
      }
      if (resp.state) {
        renderTaskState(resp.state);
      }
    }
  );
});
