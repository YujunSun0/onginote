// 캐릭터 얼굴 이미지(public/characters/*.png)를 만든다. 얼굴을 고치면 이 파일을 고치고 다시 실행한다.
//   node scripts/character-faces.mjs
//
// 화면에 SVG를 직접 그리지 않고 이미지로 쓰는 이유: 삼성 인터넷 같은 브라우저의 강제 다크 모드가
// SVG 도형 색을 하나씩 바꾸면서 눈·코가 얼굴색과 비슷해져 사라진다. 이미지는 통째로 다뤄져서 대비가 유지된다.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const INK = "#2B1A12";
const FACES = {
  mongle: `
    <circle cx="22" cy="30" r="10" fill="#9C6F4B"/>
    <circle cx="78" cy="30" r="10" fill="#9C6F4B"/>
    <circle cx="50" cy="54" r="38" fill="#B98A63"/>
    <ellipse cx="50" cy="66" rx="22" ry="17" fill="#F3DCC4"/>
    <circle cx="37" cy="50" r="4" fill="${INK}"/>
    <circle cx="63" cy="50" r="4" fill="${INK}"/>
    <ellipse cx="50" cy="60" rx="6" ry="4.5" fill="${INK}"/>
    <path d="M44 68q6 5 12 0" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="27" cy="62" r="5" fill="#F4A58A"/>
    <circle cx="73" cy="62" r="5" fill="#F4A58A"/>`,
  yeoul: `
    <path d="M18 12L40 34L16 44Z" fill="#D9702A"/>
    <path d="M82 12L60 34L84 44Z" fill="#D9702A"/>
    <path d="M50 92C26 92 12 72 12 52C12 36 26 26 50 26C74 26 88 36 88 52C88 72 74 92 50 92Z" fill="#E8833A"/>
    <path d="M50 92C38 92 28 82 26 68C34 66 44 70 50 78C56 70 66 66 74 68C72 82 62 92 50 92Z" fill="#FFF4EA"/>
    <path d="M31 54q5 -4 10 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M59 54q5 -4 10 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="76" r="4" fill="${INK}"/>`,
  olly: `
    <path d="M20 18L36 34L22 38Z" fill="#62728A"/>
    <path d="M80 18L64 34L78 38Z" fill="#62728A"/>
    <circle cx="50" cy="56" r="38" fill="#7C8DA6"/>
    <ellipse cx="50" cy="82" rx="18" ry="8" fill="#9DACC0"/>
    <circle cx="35" cy="50" r="14" fill="#FFF8F1"/>
    <circle cx="65" cy="50" r="14" fill="#FFF8F1"/>
    <circle cx="35" cy="50" r="6" fill="${INK}"/>
    <circle cx="65" cy="50" r="6" fill="${INK}"/>
    <path d="M45 64L50 72L55 64Z" fill="#F0A13A"/>`,
  daon: `
    <circle cx="50" cy="50" r="40" fill="#5A3A2B"/>
    <ellipse cx="50" cy="58" rx="30" ry="32" fill="#F6D2B8"/>
    <path d="M20 50C20 26 34 16 50 16C66 16 80 26 80 50C70 40 60 34 50 34C42 40 30 46 20 50Z" fill="#5A3A2B"/>
    <path d="M36 60q4 -4 8 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M56 60q4 -4 8 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M44 72q6 6 12 0" stroke="#C4491B" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="31" cy="68" r="4.5" fill="#F4A58A"/>
    <circle cx="69" cy="68" r="4.5" fill="#F4A58A"/>`,
};

// 화면에서 가장 크게 쓰는 크기(120px)의 2배보다 크게 만들어 고해상도 화면에서도 선명하게
const SIZE = 256;
const out = new URL("../public/characters/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const [id, body] of Object.entries(FACES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 100 100">${body}</svg>`;
  const file = new URL(`${id}.png`, out);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(file.pathname.replace(/^\/([A-Z]:)/, "$1"));
  console.log("wrote", `public/characters/${id}.png`);
}
