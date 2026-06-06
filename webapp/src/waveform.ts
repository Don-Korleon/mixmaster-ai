export async function drawWaveform(
  canvas: HTMLCanvasElement,
  audioUrl: string
): Promise<AudioBuffer | null> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  try {
    const res = await fetch(audioUrl);
    const arrayBuffer = await res.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();

    const channel = audioBuffer.getChannelData(0);
    const step = Math.ceil(channel.length / w);
    const amp = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#6c5ce7";

    for (let i = 0; i < w; i++) {
      let min = 1;
      let max = -1;
      for (let j = 0; j < step; j++) {
        const datum = channel[i * step + j] ?? 0;
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const yMin = (1 + min) * amp;
      const yMax = (1 + max) * amp;
      ctx.fillRect(i, yMin, 1, Math.max(1, yMax - yMin));
    }

    return audioBuffer;
  } catch {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#444";
    for (let i = 0; i < w; i += 4) {
      const bar = 10 + Math.sin(i * 0.1) * 20 + Math.random() * 15;
      ctx.fillRect(i, h / 2 - bar / 2, 2, bar);
    }
    return null;
  }
}
