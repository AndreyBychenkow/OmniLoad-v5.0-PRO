(function () {
  if (window.__omniLoadVKInjected) return;
  window.__omniLoadVKInjected = true;

  function extractVideoInfoFromUrl() {
    const href = window.location.href;
    const mVid = href.match(/(?:video|clip)(-?\d+_\d+)/i);
    if (!mVid) return null;
    const videoId = mVid[1];
    const urlObj = new URL(href);
    let listId = urlObj.searchParams.get("list") || "";
    if (!listId) {
      const mList = href.match(/video-?\d+_\d+%2F([a-f0-9]+)/i);
      if (mList) listId = mList[1];
    }
    return { videoId, listId };
  }

  function createFloatingButton() {
    const btn = document.createElement("button");
    btn.id = "omniload-vk-fab";
    btn.innerHTML = "⚡ Скачать MP4";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "999999",
      padding: "12px 20px",
      borderRadius: "999px",
      border: "none",
      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%)",
      color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 10px 30px rgba(99, 102, 241, 0.5)",
      display: "none",
      alignItems: "center",
      gap: "8px",
      transition: "transform 0.15s ease",
    });
    btn.onmouseenter = () => (btn.style.transform = "scale(1.04)");
    btn.onmouseleave = () => (btn.style.transform = "scale(1)");
    btn.onclick = () => fetchAndShowLinks();
    document.body.appendChild(btn);
    return btn;
  }

  async function fetchAndShowLinks() {
    const info = extractVideoInfoFromUrl();
    if (!info) {
      alert("Откройте страницу конкретного видео ВКонтакте (например vkvideo.ru/video...)");
      return;
    }

    const btn = document.getElementById("omniload-vk-fab");
    if (btn) btn.innerHTML = "⏳ Получение ссылок...";

    try {
      const params = new URLSearchParams();
      params.set("act", "show");
      params.set("al", "1");
      params.set("video", info.videoId);
      if (info.listId) params.set("list", info.listId);

      const resp = await fetch("/al_video.php?act=show", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: params.toString(),
      });

      const data = await resp.json();
      const payload = data && data.payload;
      if (!payload || !Array.isArray(payload[1])) {
        throw new Error("Не удалось получить данные видео.");
      }

      let playerParams = null;
      for (const item of payload[1]) {
        if (item && item.player && item.player.params && item.player.params[0]) {
          playerParams = item.player.params[0];
          break;
        }
      }

      if (!playerParams) {
        throw new Error("Ссылки на поток не найдены. Убедитесь, что у вас есть доступ к видео.");
      }

      const title = playerParams.md_title || "VK_Video_" + info.videoId;
      const qualities = [
        ["url2160", "4K (2160p) MP4"],
        ["url1440", "2K (1440p) MP4"],
        ["url1080", "Full HD (1080p) MP4"],
        ["url720", "HD (720p) MP4"],
        ["url480", "480p MP4"],
        ["url360", "360p MP4"],
        ["url240", "240p MP4"],
        ["url144", "144p MP4"],
      ];

      const found = [];
      for (const [key, label] of qualities) {
        if (playerParams[key]) {
          found.push({ key, label, url: playerParams[key] });
        }
      }

      showModal(title, found, playerParams.hls || "");
    } catch (e) {
      alert("Ошибка: " + e.message);
    } finally {
      if (btn) btn.innerHTML = "⚡ Скачать MP4";
    }
  }

  function showModal(title, list, hlsUrl) {
    const old = document.getElementById("omniload-vk-modal");
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = "omniload-vk-modal";
    Object.assign(modal.style, {
      position: "fixed",
      inset: "0",
      zIndex: "1000000",
      background: "rgba(5, 8, 15, 0.8)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
    });

    const buttonsHtml = list.length
      ? list
          .map(
            (item, idx) => `
          <a href="${item.url}" target="_blank" download style="
            display:flex;align-items:center;justify-content:space-between;
            padding:12px 16px;margin-bottom:8px;border-radius:12px;
            background:${idx === 0 ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(255,255,255,0.08)"};
            color:#fff;text-decoration:none;font-weight:700;font-size:14px;
          ">
            <span>🎬 ${item.label} ${idx === 0 ? "(Лучшее)" : ""}</span>
            <span>⬇️ Скачать</span>
          </a>
        `
          )
          .join("")
      : `<div style="color:#fca5a5;margin-bottom:10px;">Прямые MP4 ссылки не найдены, доступен только HLS поток.</div>`;

    modal.innerHTML = `
      <div style="background:#131b2e;border:1px solid rgba(255,255,255,0.15);border-radius:20px;max-width:460px;width:100%;padding:24px;color:#fff;box-shadow:0 25px 60px rgba(0,0,0,0.65);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:17px;">⚡ OmniLoad — Скачать видео</strong>
          <button id="omniload-vk-close" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:13.5px;color:#cbd5e1;margin-bottom:16px;word-break:break-word;">${title}</div>
        <div>${buttonsHtml}</div>
        <div style="font-size:11.5px;color:#94a3b8;margin-top:10px;">
          💡 Совет: если видео открылось в новой вкладке плеера — нажмите правой кнопкой мыши по видео и выберите <b>«Сохранить видео как...» (Ctrl+S)</b>.
        </div>
      </div>
    `;

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    document.body.appendChild(modal);
    document.getElementById("omniload-vk-close").onclick = () => modal.remove();
  }

  const fab = createFloatingButton();
  setInterval(() => {
    const hasVid = Boolean(extractVideoInfoFromUrl());
    fab.style.display = hasVid ? "inline-flex" : "none";
  }, 800);
})();
