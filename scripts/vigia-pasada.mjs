// scripts/vigia-pasada.mjs — la pasada del vigía, fuera del YAML.
//
// POR QUÉ NO VIVE DENTRO DEL WORKFLOW: la primera versión metía cuatro bloques de JavaScript
// entre comillas dentro de un `run:` de YAML. Eso ya me costó un fallo en esta misma tanda
// —una bandera de node colocada donde no era bandera— y habría costado más: comillas, saltos
// de línea y `$` que el shell expande antes de que node los vea. Aquí se puede LEER y se
// puede EJECUTAR en la tanda, que es la diferencia entre un guard y una intención.
//
// ENTRADA (las produce el workflow con `gh`, porque `gh` no existe dentro de node):
//   · prs.json      salida de `gh pr list --json …`
//   · estados.txt   una línea por PR: `numero|mergeStateStatus|nº de check-runs`
//   · $ANTES        el estado de la pasada anterior, leído del cuerpo del issue
//
// SALIDA:
//   · cuerpo.md     el cuerpo del issue, ya comprobado contra la mención
//   · veredicto.json  { empeora, nuevos, cambiados, atascados }
//   · exit 0 normal · exit 1 si el suelo no reconoce su cebo o si el cuerpo despertaría a
//     alguien. Las dos son «esta pasada no vale», no «no hay atascados».
import fs from 'node:fs';
import {
  esAsuntoDelVigia, causaDelAtasco, haEmpeorado, sueloDeLaPasada, horasDesde,
} from './vigia-atascados.mjs';
import { cuerpoNoDebeDespertar } from './puerta-avisador-rojo.mjs';

// ── EL SUELO, ANTES DE MIRAR NADA ─────────────────────────────────────────────────────────
// Si el clasificador no reconoce su propio cebo, un cero de esta pasada no significa «no hay
// atascados»: significa «no sé mirar». Y esas dos cosas no pueden dar la misma salida.
const suelo = sueloDeLaPasada();
console.log(suelo.detalle);
if (!suelo.ok) {
  console.log('::error::El suelo del vigía no reconoce su cebo. Esta pasada NO puede afirmar nada.');
  process.exit(1);
}

const prs = JSON.parse(fs.readFileSync('prs.json', 'utf8'));
const estados = new Map(
  fs.readFileSync('estados.txt', 'utf8').split('\n').filter(Boolean).map((l) => {
    const [n, e, c] = l.split('|');
    return [Number(n), { estado: e, checks: Number(c) }];
  }),
);

const ahora = Date.now();
const filas = [];
const descartados = [];
for (const p of prs) {
  const v = esAsuntoDelVigia({
    autor: p.author && p.author.login,
    draft: p.isDraft,
    etiquetas: (p.labels || []).map((l) => l.name),
    autoMerge: !!p.autoMergeRequest,
  });
  if (!v.vigilar) { descartados.push(`#${p.number} · ${v.porque}`); continue; }
  const o = estados.get(p.number) || { estado: 'UNKNOWN', checks: 0 };
  const c = causaDelAtasco(o);
  filas.push({
    numero: p.number, causa: c.causa, detalle: c.detalle,
    horas: horasDesde(p.createdAt, ahora), quieto: horasDesde(p.updatedAt, ahora),
    titulo: String(p.title || '').slice(0, 60), autor: p.author && p.author.login,
  });
}
filas.sort((a, b) => (b.horas || 0) - (a.horas || 0));

// ── EL CUERPO ─────────────────────────────────────────────────────────────────────────────
const sello = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
let b = 'Reescrito por el vigía en cada pasada. **No arregla nada: avisa.**\n\n';
b += `Última pasada: ${sello}\n\n`;
if (filas.length === 0) {
  b += '**Ningún PR atascado.**\n\n';
  b += 'Y el suelo de esta pasada dio OK, así que este cero es un cero MEDIDO: el cebo '
     + 'sintético sí sale marcado. Un cero sin esa línea al lado no se distingue de un '
     + 'instrumento ciego.\n';
} else {
  b += '| PR | causa | h. abierto | h. quieto | autor | título |\n|---|---|---|---|---|---|\n';
  for (const f of filas) {
    b += `| #${f.numero} | **${f.causa}** | ${f.horas} | ${f.quieto} | ${f.autor} | ${f.titulo} |\n`;
  }
  b += '\n';
  for (const c of [...new Set(filas.map((f) => f.causa))]) {
    b += `- **${c}** — ${filas.find((f) => f.causa === c).detalle}\n`;
  }
}
b += `\n<details><summary>Descartados a propósito (${descartados.length})</summary>\n\n`;
b += descartados.length ? descartados.map((d) => `- ${d}`).join('\n') : '- (ninguno)';
b += '\n\n</details>\n';
b += `\n<!-- vigia-atascados:estado ${JSON.stringify(filas.map((f) => ({ numero: f.numero, causa: f.causa })))} -->\n`;

// ── EL ESPEJO DE LA REGLA DEL AVISADOR ────────────────────────────────────────────────────
// Éste despierta a una PERSONA. Si el cuerpo llevara la mención despertaría además a una
// sesión que nadie llamó — y el cuerpo lleva TÍTULOS DE PR dentro, o sea texto que escribe
// otra persona. Basta un PR titulado con la mención. Se comprueba aquí, no en un README.
if (!cuerpoNoDebeDespertar(b)) {
  console.log('::error::El cuerpo del vigía contiene la mención que despierta a Claude. No se publica.');
  process.exit(1);
}

fs.writeFileSync('cuerpo.md', b);

const antes = JSON.parse(process.env.ANTES || '[]');
const r = haEmpeorado(antes, filas.map((f) => ({ numero: f.numero, causa: f.causa })));
fs.writeFileSync('veredicto.json', JSON.stringify({ ...r, atascados: filas.length }));
console.log(`atascados ${filas.length} · descartados ${descartados.length} · empeora ${r.empeora}`);
