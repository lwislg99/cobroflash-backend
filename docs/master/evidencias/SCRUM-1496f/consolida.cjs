// SCRUM-1496f · J3 (jv-j3ak), 23-oct-2026 · junta las salidas de los lectores y comprueba los controles.
// Se corre en el directorio de trabajo que tiene lotes/ y salida/. Salida 0 = controles bien; 2 = un control
// falló o NO SE VE (fila ausente = CIEGO, nunca verde: cicatriz ②, el positivo sembrado se comprueba quitándolo).
const fs = require("fs");
const lotes = fs.readdirSync("lotes").filter((f) => /^lote-[AN]\d\d\.md$/.test(f)).sort();
const esperadas = new Set();
for (const f of lotes) for (const m of fs.readFileSync("lotes/" + f, "utf8").matchAll(/^## (SCRUM-\d+)/gm)) esperadas.add(m[1]);
const VER = ["TERMINADO", "PARCIAL", "SIN EMPEZAR", "ESPERA", "NO HE PODIDO MIRAR"];
const filas = [];
let todo = "";
for (const f of lotes) {
  const nn = f.slice(5, 8);
  const ruta = `salida/veredicto-lote-${nn}.md`;
  if (!fs.existsSync(ruta)) { console.log("SIN SALIDA", nn); continue; }
  const t = fs.readFileSync(ruta, "utf8");
  todo += `\n\n## lote-${nn}\n\n` + t.trim();
  for (const l of t.split("\n")) {
    const m = l.match(/^\|\s*\**(SCRUM-\d+)\**[^|]*\|/);
    if (!m) continue;
    const c = l.split("|").map((s) => s.trim());
    const v = c[3].replace(/\*/g, "").toUpperCase();
    const clase = VER.find((x) => v.startsWith(x)) || "?" + v.slice(0, 20);
    filas.push({ k: m[1], clase, lote: nn, falta: c[6] || "", otro: c[7] || "" });
  }
}
fs.writeFileSync("veredictos-por-lote.md", todo.trim() + "\n");
const ks = filas.map((f) => f.k);
const faltan = [...esperadas].filter((k) => !ks.includes(k));
const sobran = ks.filter((k) => !esperadas.has(k));
const dup = ks.filter((k, i) => ks.indexOf(k) !== i);
console.log(`población: ${esperadas.size} esperadas · ${filas.length} filas · ${new Set(ks).size} únicas · faltan [${faltan.join(" ")}] · sobran [${sobran.join(" ")}] · repetidas [${dup.join(" ")}]`);
const de = (k) => filas.find((f) => f.k === k);
const CONTROLES = [
  ["SCRUM-99998", (f) => f.clase === "TERMINADO", "sembrado: TERMINADO (entró bajo otro número)"],
  ["SCRUM-99997", (f) => f.clase === "SIN EMPEZAR", "sembrado: SIN EMPEZAR"],
  ["SCRUM-99996", (f) => f.clase === "TERMINADO" && /1550/.test(f.otro + f.falta), "sembrado: TERMINADO bajo SCRUM-1550"],
];
let mal = faltan.length + sobran.length + dup.length > 0;
for (const [k, ok, dice] of CONTROLES) {
  const f = de(k);
  const r = !f ? "CIEGO (sin fila)" : ok(f) ? "✅" : `❌ salió ${f.clase}`;
  if (r !== "✅") mal = true;
  console.log(`control ${k} · ${dice} → ${r}`);
}
for (const k of ["SCRUM-1574", "SCRUM-1514"]) { const f = de(k); console.log(`control real ${k} → ${f ? f.clase + " · " + f.otro.slice(0, 120) : "CIEGO (sin fila)"}`); }
const reales = filas.filter((f) => !/^SCRUM-9999\d$/.test(f.k) && f.k !== "SCRUM-1574");
const n = (k) => +k.slice(6);
for (const c of VER.concat(filas.some((f) => f.clase.startsWith("?")) ? ["?"] : [])) {
  const xs = reales.filter((f) => (c === "?" ? f.clase.startsWith("?") : f.clase === c)).map((f) => n(f.k)).sort((a, b) => a - b);
  console.log(`${c} (${xs.length}): ${xs.join(" ")}`);
}
const bajoOtro = reales.filter((f) => /SCRUM-\d+/.test(f.otro) && !/^no\b/i.test(f.otro)).map((f) => `${n(f.k)}→${(f.otro.match(/SCRUM-\d+/g) || []).join(",")}`);
console.log(`con «entró bajo otro número» (${bajoOtro.length}): ${bajoOtro.join(" ")}`);
fs.writeFileSync("filas.json", JSON.stringify(filas, null, 1));
process.exit(mal ? 2 : 0);
