import { drawWaveform } from "./waveform.js";

interface RemixDto {
  id: string;
  trackTitle: string;
  trackArtist: string;
  styleId: string;
  styleLabel: string;
  previewUrl: string;
}

interface MeDto {
  premium: boolean;
  remixesRemaining: number;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: { start_param?: string };
        ready: () => void;
        expand: () => void;
        themeParams: Record<string, string>;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback: { impactOccurred: (style: string) => void };
        close: () => void;
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
const content = document.getElementById("content")!;
const badge = document.getElementById("user-badge")!;
const canvas = document.getElementById("waveform") as HTMLCanvasElement;
const playBtn = document.getElementById("play-btn") as HTMLButtonElement;
const playHint = document.getElementById("play-hint")!;

let audio: HTMLAudioElement | null = null;

function getStartParam(): string | undefined {
  const fromTg = tg?.initDataUnsafe?.start_param;
  if (fromTg) return fromTg;
  const params = new URLSearchParams(window.location.search);
  return params.get("tgWebAppStartParam") ?? undefined;
}

function parseRemixId(startParam?: string): string | null {
  if (!startParam) return null;
  if (startParam.startsWith("remix_")) return startParam.slice(6);
  if (startParam === "daily") return null;
  return startParam;
}

function previewAudioUrl(remix: RemixDto): string {
  if (remix.previewUrl.startsWith("/")) return remix.previewUrl;
  if (remix.previewUrl.startsWith("http")) {
    try {
      const u = new URL(remix.previewUrl);
      return u.pathname;
    } catch {
      return `/api/remix/${remix.id}/preview`;
    }
  }
  return `/api/remix/${remix.id}/preview`;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (tg?.initData) {
    headers["X-Telegram-Init-Data"] = tg.initData;
  }
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function renderTrack(remix: RemixDto): void {
  content.innerHTML = `
    <div class="track-card">
      <h1>${escapeHtml(remix.trackTitle)}</h1>
      <p>${escapeHtml(remix.trackArtist)}</p>
      <span class="style-pill">${escapeHtml(remix.styleLabel)}</span>
    </div>
  `;
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function setPlayHint(text: string, isError = false): void {
  playHint.textContent = text;
  playHint.classList.toggle("error", isError);
}

function setupMainButton(remixId: string): void {
  if (!tg) return;
  tg.MainButton.text = "Сохранить ремикс";
  tg.MainButton.show();
  const onSave = async () => {
    tg!.MainButton.showProgress();
    try {
      await api(`/api/remix/${remixId}/save`, { method: "POST" });
      tg!.HapticFeedback.impactOccurred("medium");
      tg!.MainButton.hideProgress();
      tg!.close();
    } catch {
      tg!.MainButton.hideProgress();
      alert("Не удалось сохранить. Попробуйте снова.");
    }
  };
  tg.MainButton.onClick(onSave);
}

function setupPlayer(remix: RemixDto): void {
  const url = previewAudioUrl(remix);
  audio = new Audio(url);
  audio.preload = "auto";
  canvas.style.display = "block";
  playBtn.style.display = "inline-block";
  playBtn.disabled = false;
  playBtn.textContent = "▶ Слушать";
  setPlayHint("Нажмите «Слушать» для превью ремикса");

  audio.addEventListener("error", () => {
    setPlayHint("Ошибка загрузки аудио. Закройте и откройте микшер снова.", true);
    playBtn.disabled = true;
  });

  audio.addEventListener("ended", () => {
    playBtn.textContent = "▶ Слушать";
  });

  playBtn.onclick = async () => {
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
        playBtn.textContent = "⏸ Пауза";
        setPlayHint("Воспроизведение…");
        tg?.HapticFeedback.impactOccurred("light");
      } else {
        audio.pause();
        playBtn.textContent = "▶ Слушать";
        setPlayHint("Пауза");
      }
    } catch {
      setPlayHint("Нажмите «Слушать» ещё раз (Telegram может блокировать автозапуск)", true);
    }
  };

  void drawWaveform(canvas, url).catch(() => {
    /* waveform optional */
  });
}

async function init(): Promise<void> {
  tg?.ready();
  tg?.expand();

  const remixId = parseRemixId(getStartParam());

  try {
    const me = await api<MeDto>("/api/me");
    badge.textContent = me.premium
      ? "⭐ Premium"
      : me.remixesRemaining >= 0
        ? `${me.remixesRemaining} осталось`
        : "∞ ремиксов";
    badge.classList.toggle("premium", me.premium);
  } catch {
    badge.textContent = "Demo";
  }

  if (!remixId && getStartParam() === "daily") {
    try {
      const daily = await api<{
        trackTitle: string;
        trackArtist: string;
        joined: boolean;
        entryStars: number;
        winnerStars: number;
      }>("/api/daily");
      content.innerHTML = `
        <div class="track-card">
          <h1>🔥 Челлендж дня</h1>
          <p>${escapeHtml(daily.trackTitle)} — ${escapeHtml(daily.trackArtist)}</p>
          <span class="style-pill">${daily.joined ? "✅ Участвуете" : `${daily.entryStars} ⭐`}</span>
        </div>
        <p class="loading">${daily.joined ? "Отправьте аудио этого трека боту." : "Оплатите участие через /daily в боте."}</p>
      `;
    } catch {
      content.innerHTML = `<p class="error">Откройте через Telegram</p>`;
    }
    canvas.style.display = "none";
    playBtn.style.display = "none";
    if (tg) {
      tg.MainButton.text = "Назад в бот";
      tg.MainButton.show();
      tg.MainButton.onClick(() => tg!.close());
    }
    return;
  }

  if (!remixId) {
    content.innerHTML = `<p class="loading">Отправьте трек боту или откройте ремикс из карточки.</p>`;
    canvas.style.display = "none";
    playBtn.style.display = "none";
    return;
  }

  try {
    const remix = await api<RemixDto>(`/api/remix/${remixId}`);
    renderTrack(remix);
    setupMainButton(remixId);
    setupPlayer(remix);
  } catch (e) {
    content.innerHTML = `<p class="error">Ремикс не найден</p>`;
    console.error(e);
  }
}

init();
