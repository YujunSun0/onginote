"use client";

import { CHARACTERS } from "./characters";
import { josa } from "./format";
import { LOVE_TYPES, type ReportPreview } from "./report-types";
import type { CharacterId } from "./types";

/**
 * 공유 카드 이미지 (1080×1350, 인스타 피드 비율). 브라우저에서 그린다.
 * 화면에 이미 불러온 글꼴(next/font)과 캐릭터 그림을 쓰므로 서버에 글꼴을 둘 필요가 없다.
 * 카드에는 상담 내용이 들어가지 않는다: 유형, 한 줄, 키워드만.
 */

const W = 1080;
const H = 1350;

function cssFont(variable: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 한글은 띄어쓰기가 적어서 글자 단위로 줄을 나눈다 (단어 중간에서 끊기지 않게 공백을 먼저 본다) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/(\s+)/)) {
    const next = line + word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line.trim()) lines.push(line.trim());
    line = "";
    for (const ch of word.trimStart()) {
      if (ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/.$/, "…");
    return cut;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export async function drawShareCard(content: ReportPreview, characterId: CharacterId): Promise<Blob> {
  const type = LOVE_TYPES[content.type];
  const display = cssFont("--font-jua", "sans-serif");
  const sans = cssFont("--font-noto", "sans-serif");
  await Promise.all([
    document.fonts.load(`80px ${display}`, type.name + content.keywords.join("")),
    document.fonts.load(`700 40px ${sans}`, content.headline),
    document.fonts.load(`400 40px ${sans}`, content.headline),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 배경: 유형 색
  ctx.fillStyle = type.color;
  ctx.fillRect(0, 0, W, H);
  // 안쪽 카드
  ctx.fillStyle = "#fff8f1";
  roundRect(ctx, 64, 64, W - 128, H - 128, 56);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // 캐릭터
  const img = await loadImage(`/characters/${characterId}.png`);
  if (img) {
    const size = 300;
    ctx.drawImage(img, (W - size) / 2, 130, size, size);
  }

  ctx.fillStyle = "#74645a";
  ctx.font = `500 34px ${sans}`;
  ctx.fillText("나의 연애 유형", W / 2, 500);

  ctx.fillStyle = type.color;
  ctx.font = `86px ${display}`;
  ctx.fillText(`${type.emoji} ${type.name}`, W / 2, 610);

  // 한 줄 정의
  ctx.fillStyle = "#2b1a12";
  ctx.font = `700 46px ${sans}`;
  const lines = wrap(ctx, content.headline, W - 260, 3);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 720 + i * 66));

  // 키워드 칩
  ctx.font = `44px ${display}`;
  const chips = content.keywords.slice(0, 3).map((k) => `#${k}`);
  const pad = 36;
  const gap = 20;
  const widths = chips.map((c) => ctx.measureText(c).width + pad * 2);
  let x = (W - (widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1))) / 2;
  const chipY = 720 + lines.length * 66 + 50;
  chips.forEach((c, i) => {
    ctx.fillStyle = "#ffe7d6";
    roundRect(ctx, x, chipY, widths[i], 84, 42);
    ctx.fillStyle = "#a63d14";
    ctx.fillText(c, x + widths[i] / 2, chipY + 57);
    x += widths[i] + gap;
  });

  // 유형 설명
  ctx.fillStyle = "#4a3a31";
  ctx.font = `400 34px ${sans}`;
  wrap(ctx, type.desc, W - 300, 2).forEach((l, i) => ctx.fillText(l, W / 2, chipY + 170 + i * 50));

  // 아래: 서비스 이름
  ctx.fillStyle = "#74645a";
  ctx.font = `36px ${display}`;
  ctx.fillText(`온기노트 · ${josa(CHARACTERS[characterId].name, "과", "와")} 함께한 상담으로 만든 리포트`, W / 2, H - 120);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요."))), "image/png"));
}

/** 휴대폰이면 공유 시트, 안 되면 이미지 저장 */
export async function shareOrSave(blob: Blob, title: string): Promise<"shared" | "saved" | "canceled"> {
  const file = new File([blob], "onginote-love-type.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "canceled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
}
