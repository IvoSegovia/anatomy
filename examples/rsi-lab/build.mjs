// Construye rsi-lab.html: una página autónoma (sin red, sin dependencias) con el kit Anatomy,
// los modelos ejecutables y la escena incrustados. Uso: node examples/rsi-lab/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ISO_CSS } from "../../kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(HERE, "view", "main.mjs");

// ---- Mini empaquetador ESM: cada módulo se envuelve en una función y devuelve sus exportaciones.
const modules = new Map();
const order = [];
const idOf = (file) => "__m_" + relative(join(HERE, "..", ".."), file).replace(/[^a-zA-Z0-9]/g, "_");

function load(file) {
  if (modules.has(file)) return;
  const source = readFileSync(file, "utf8");
  const imports = [];
  const importRe = /^import\s+(.+?)\s+from\s+"(.+?)";\s*$/gm;
  let match;
  while ((match = importRe.exec(source))) imports.push({ clause: match[1].trim(), from: resolve(dirname(file), match[2]) });
  modules.set(file, null);
  for (const dep of imports) load(dep.from);
  const exportsList = [];
  let code = source.replace(importRe, "");
  code = code.replace(/^export\s+(async\s+function|function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exportsList.push(name);
    return `${kind} ${name}`;
  });
  code = code.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (_, names) => {
    for (const part of names.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [local, as] = part.split(/\s+as\s+/);
      exportsList.push(as ? `${as}: ${local}` : local);
    }
    return "";
  });
  if (/^export\s/m.test(code)) throw new Error(`exportación no soportada en ${file}`);
  const bindings = imports
    .map(({ clause, from }) => {
      const ns = clause.match(/^\*\s+as\s+(\w+)$/);
      if (ns) return `const ${ns[1]} = ${idOf(from)};`;
      const named = clause.match(/^\{([^}]*)\}$/);
      if (!named) throw new Error(`import no soportado: ${clause}`);
      const parts = named[1].split(",").map((s) => s.trim()).filter(Boolean).map((part) => {
        const [name, as] = part.split(/\s+as\s+/);
        return as ? `${name}: ${as}` : name;
      });
      return `const { ${parts.join(", ")} } = ${idOf(from)};`;
    })
    .join("\n");
  modules.set(file, `const ${idOf(file)} = (() => {\n${bindings}\n${code}\nreturn { ${exportsList.join(", ")} };\n})();`);
  order.push(file);
}
load(ENTRY);
const bundle = order.map((file) => modules.get(file)).join("\n");

const css = readFileSync(join(HERE, "view", "style.css"), "utf8");
const page = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anatomía de la automejora recursiva</title>
<meta name="description" content="Experiencia interactiva: del Transformer al sistema que mejora cómo se mejora. Cálculos locales verificables, simulaciones conceptuales declaradas.">
<style>${ISO_CSS}${css}</style>
</head>
<body class="iso" data-theme="dark">
<div id="app"></div>
<noscript>Esta experiencia necesita JavaScript.</noscript>
<script type="module">
${bundle.replace(/<\/(script)/gi, "<\\/$1")}
</script>
</body>
</html>
`;
const out = join(HERE, "rsi-lab.html");
writeFileSync(out, page);
console.log(`escrito ${relative(process.cwd(), out)} · ${(page.length / 1024).toFixed(0)} KB · ${order.length} módulos`);
