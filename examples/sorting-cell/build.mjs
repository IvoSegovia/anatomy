import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as MODEL from "./model.mjs";
import { makeCell } from "./cell.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 760;
const H = 440;
const AZ = 58;
const EL = 30;
const TAU0 = 7.6;

const C = MODEL.CELL;
const cell = makeCell(k, G, C);
const P = cell.cameraFor(AZ, EL, W, H);
const M = MODEL.at(TAU0);
const items = cell.sortItems(cell.staticItems(P).concat(cell.dynamicItems(P, M, {})), P);
const body = `<g data-view transform="translate(0 0)">${items.map((it) => `<g class="cl-item" data-id="${it.id}" data-group="${it.group}">${it.svg}</g>`).join("")}</g>`;

const svg = k.figureSvg({
  width: W,
  height: H,
  className: "cl-svg",
  label:
    "Celda robótica de clasificación documental en isométrico. Un alimentador suelta hojas sobre una cinta de dos bandas con catorce rodillos; pasan bajo un escáner de línea iluminado por dos barras LED, se detienen en un tope y un brazo SCARA con ventosas las deja en tres bandejas: Pólizas, Procedimientos y Revisión manual.",
  body,
});

const namesOf = (src) => [...src.matchAll(/^export (?:const|function|let) (\w+)/gm)].map((m) => m[1]);
const kitSrc = readFileSync(join(HERE, "..", "..", "kit", "iso-kit.mjs"), "utf8");
const latheSrc = readFileSync(join(HERE, "..", "..", "kit", "lathe.mjs"), "utf8");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8");
const cellSrc = readFileSync(join(HERE, "cell.mjs"), "utf8");
const strip = (src) => src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const script =
  kitScript() +
  `\nconst K = { ${namesOf(kitSrc).join(", ")} };\n` +
  `const G = (() => {${strip(latheSrc)}\nreturn { ${namesOf(latheSrc).join(", ")} };})();\n` +
  `const MODEL = (() => {${strip(modelSrc)}\nreturn { ${namesOf(modelSrc).join(", ")} };})();\n` +
  `const makeCell = (() => {${strip(cellSrc)}\nreturn makeCell;})();\n` +
  readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify({ W, H, AZ, EL, tau0: TAU0 }));

const CSS = readFileSync(join(HERE, "sorting-cell.css"), "utf8");
const chip = (g, n, label) => `<button type="button" class="cl-btn" data-group-btn="${g}" aria-pressed="false"><span>${n}</span>${label}</button>`;
const controls = `<div class="cl-panel">
<div class="cl-row">
  <div class="cl-set" role="group" aria-label="Cámara">
    <button type="button" class="cl-btn" data-act="left" aria-label="Girar 45° a la izquierda">⟲</button>
    <button type="button" class="cl-btn" data-act="right" aria-label="Girar 45° a la derecha">⟳</button>
    <button type="button" class="cl-btn" data-act="reset">Vista inicial</button>
    <button type="button" class="cl-btn" data-act="wire" aria-pressed="false">Alámbrico</button>
  </div>
  <div class="cl-set">
    <button type="button" class="cl-btn" data-act="pause" aria-pressed="false">Pausa</button>
    <label class="cl-speed">Velocidad <input type="range" min="0.25" max="3" step="0.25" value="1" data-speed aria-label="Velocidad de la celda"> <output data-speed-out>1,00× · 0,25 m/s</output></label>
  </div>
</div>
<div class="cl-row">
  <div class="cl-set" role="group" aria-label="Inspeccionar mecanismo">
    ${chip("cinta", "01", "Cinta")}${chip("escaner", "02", "Escáner")}${chip("brazo", "03", "Brazo")}${chip("bandejas", "04", "Bandejas")}${chip("control", "05", "Control")}
  </div>
  <button type="button" class="cl-btn cl-follow" data-act="follow" aria-pressed="false">Seguir documento</button>
</div>
<div class="cl-info" data-info></div>
</div>`;

const html =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig 1",
    title: "Celda de clasificación documental",
    hint: "Arrastra para girar · clic para inspeccionar",
    readout: "",
    keys: [
      { mark: "lit", label: "La hoja que se sigue, o la última clasificada" },
      { mark: "raised", label: "Brazo SCARA y escáner: lo que decide y mueve" },
      { mark: "flat", label: "Bandas, rodillos y pilas de salida" },
    ],
    caption:
      "Una hoja A4 (297 × 210 mm) sale del alimentador cada 3,2 s y viaja a 0,25 m/s sobre dos bandas. Bajo el escáner, una cámara de línea a 300 ppp lee 3 508 líneas en 1,19 s, a unas 2 950 líneas por segundo; el clasificador decide póliza o procedimiento y, si su confianza no llega al 80 %, la manda a revisión manual. Un tope neumático la retiene y el brazo SCARA, con eslabones de 260 y 230 mm, la recoge con cuatro ventosas y la deposita en su bandeja en 2,05 s, antes de que llegue la siguiente: 1 125 documentos por hora a velocidad nominal. Arrastra para girar la celda, haz clic en un mecanismo o usa 1–5 para inspeccionarlo, F para seguir un documento, + y − para la velocidad.",
    body: `<div class="iso-stage cl-stage" tabindex="0" role="group" aria-label="Celda de clasificación. Flechas izquierda y derecha giran la escena, arriba y abajo la inclinan; teclas 1 a 5 inspeccionan cinta, escáner, brazo, bandejas y control; F sigue un documento; espacio pausa; más y menos cambian la velocidad; W alterna la vista alámbrica.">${svg}<span class="cl-sr" role="status" aria-live="polite" data-status></span></div>`,
  }) +
  controls;

const page = k.pageHtml({ title: "Celda de clasificación documental", theme: THEME, body: html, script, width: 820 }).replace('<html lang="en">', '<html lang="es">');
const name = THEME === "light" ? "sorting-cell-light.html" : "sorting-cell.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `scale ${P.scale.toFixed(3)}`);
