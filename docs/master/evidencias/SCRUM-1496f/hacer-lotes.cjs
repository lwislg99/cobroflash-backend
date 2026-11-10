// SCRUM-1496f · J3 (jv-j3ak), 23-oct-2026 · reparte en lotes la foto de hoy, SIN pista de censos anteriores.
// Se corre en el directorio de trabajo (fuera del árbol) que tiene tabla.md, algo.txt y nada.txt.
// Siembra tres tickets que no existen en Jira (cicatriz ②: el positivo se siembra, no se toma del árbol):
//   99998 TERMINADO por efecto bajo otro número · 99997 SIN EMPEZAR · 99996 (lote de NADA) entró bajo otro número.
// Y un control real ciego: SCRUM-1574, cerrado el 22-oct (el lector no pide el estado).
const fs = require("fs");
const luis = new Set(["SCRUM-870", "SCRUM-1092", "SCRUM-1505", "SCRUM-1506", "SCRUM-1507"]);
const SEMILLAS = {
  "SCRUM-99998": "Que `scripts/equipo/norma.mjs` acepte `--arranque` e imprima solo las secciones de arranque de `docs/equipo/00-normas-comunes.md`, y que un test caiga si una sección que no entra en el arranque no está en la tabla de A1.",
  "SCRUM-99997": "Crear `scripts/equipo/recenso-semilla-99997.mjs`, que imprima la frase «semilla 99997 sin hacer» y salga con 0.",
  "SCRUM-99996": "Una capa sobre el censo por número que, para los tickets que ese censo da por vacíos, busque por CONTENIDO con una sonda declarada por ticket (que el patrón esté, o que el defecto ya no esté) y dé tres veredictos, con un control negativo y uno positivo sembrado.",
};
const lee = (f) => fs.readFileSync(f, "utf8").trim().split("\n");
const tabla = lee("tabla.md");
const fila = (k) => tabla.find((l) => l.startsWith("| " + k + " |")) || "(sin fila: ticket sembrado, no está en el censo)";
const reparte = (keys, n, pre) => {
  const lotes = Array.from({ length: n }, () => []);
  keys.forEach((k, i) => lotes[i % n].push(k));
  return lotes.map((ks, i) => ({ nn: pre + String(i + 1).padStart(2, "0"), ks }));
};
const algo = lee("algo.txt").filter((k) => !luis.has(k)).concat(["SCRUM-1574", "SCRUM-99998", "SCRUM-99997"]);
const nada = lee("nada.txt").filter((k) => !luis.has(k)).concat(["SCRUM-99996"]);
const num = (k) => +k.slice(6);
algo.sort((a, b) => num(a) - num(b));
nada.sort((a, b) => num(a) - num(b));
fs.mkdirSync("lotes", { recursive: true });
fs.mkdirSync("salida", { recursive: true });
const todos = [...reparte(algo, 8, "A"), ...reparte(nada, 3, "N")];
for (const { nn, ks } of todos) {
  let s = `# lote-${nn} · ${ks.length} tickets\n\n`;
  if (nn.startsWith("N")) s += "Todos estos salen NADA EN MAIN por su número: la búsqueda por CONTENIDO (paso 4) es lo principal.\n\n";
  for (const k of ks) {
    s += `## ${k}\n- censo por número de hoy (c26f7d6dd): ${fila(k)}\n`;
    if (SEMILLAS[k]) s += `- SEMBRADO (no está en Jira). Enunciado: ${SEMILLAS[k]}\n`;
    s += "\n";
  }
  fs.writeFileSync(`lotes/lote-${nn}.md`, s);
  console.log(nn, ks.length, ks.map(num).join(" "));
}
const n = todos.reduce((a, l) => a + l.ks.length, 0);
console.log("total", n, "unicas", new Set(todos.flatMap((l) => l.ks)).size, "algo", algo.length, "nada", nada.length);
