// docs/master/evidencias/scrum1500h/aplicar.cjs — SCRUM-1500h
//
// Aplica las correcciones EN SITIO: cada una nombra fichero, línea y el trozo exacto que tiene
// que estar UNA vez en esa línea. Si una sola no casa, no se escribe NINGÚN fichero (todo o nada).
// No añade ni quita líneas: sólo cambia el contenido de líneas que ya existen.
//
//   node docs/master/evidencias/scrum1500h/aplicar.cjs --seco    (no escribe; dice qué haría)
//   node docs/master/evidencias/scrum1500h/aplicar.cjs           (escribe)
//
// Se corre UNA vez sobre el árbol sin corregir. Sobre el ya corregido cae entero, a propósito:
// los trozos viejos ya no están. Lo que demuestra que quedó en sitio es `en-sitio.cjs`.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const SECO = process.argv.includes('--seco');

const F = 'el 13-oct-2026';
const P = 'SCRUM-1500h, decisión del fundador en SCRUM-1500 c.18993';
const PS = 'SCRUM-1500h, con la revisión del fundador que pide la regla 10 (SCRUM-1500 c.18993)';
// Copiado de SCRUM-1500 c.18919 (lo medido y lo NO medido), como manda el permiso.
const M = 'Medido en SCRUM-1500d (Jira c.18919): hay una tabla que la emisión llena y que ningún proceso vacía — el esquema tiene el modelo, sellar una factura deja su alta en `pending`, y el único código que la sacaría de ahí existe, tiene tests y no lo llama ni lo carga nadie: ni un cron, ni una ruta, ni el arranque.';
const NM = 'NO medido: ninguna base de datos (ni si la tabla existe en producción, staging o dev, ni cuántas filas tiene) ni el valor de `SIF_ENABLED` en Railway.';
// Copiado de SCRUM-1500 c.18986 y c.18993 (las DOS mitades), releído sobre el árbol el 13-oct-2026.
const C = 'Medido en SCRUM-1500g (Jira c.18986) y vuelto a leer el 13-oct-2026: hay UN cliente, `src/modules/fiscal/verifactu/sif.client.ts` —538 líneas, sobre SOAP, con opciones de mTLS que le llegan de fuera y una sola llamada de red, dentro de `enviarSobre`—, y NADIE lo llama: 0 importaciones de valor, y `enviarSobre` tiene 1 definición y 0 llamadas en `src/`.';
const CNM = 'NO medido: el cliente no se ha ejecutado, y tampoco ninguna base de datos ni el valor de `SIF_ENABLED` en Railway.';
const R = 'el código de reintentos existe (`sif.cola.ts`: `MAX_INTENTOS`, `backoffS` y el paso a `manual_review`) y nada lo ejecuta: el proceso no carga ese fichero y `procesarObligado` tiene 0 llamadas (Jira c.18919)';
const SOAP = `[Corregido ${F}, ${P}: aquí decía «Cero clientes SOAP/mTLS contra la AEAT», que es falso como «no existe ningún cliente» desde SCRUM-1127 y sigue siendo cierto como «nada envía». ${C} ${CNM}]`;

const SKILL = ['.claude/skills/yaqu-verifactu-sif/SKILL.md', '.agents/skills/yaqu-verifactu-sif/SKILL.md'];
const LEGAL = 'docs/legal/';

/** cambia: el trozo `viejo` (una vez en la línea) por `nuevo`. anade: pega `cola` al final. */
const OPS = [
  // ── la skill obligatoria, en sus dos copias ────────────────────────────────────────────
  ...SKILL.flatMap((f) => [
    { f, l: 51, viejo: '`TiempoEsperaEnvio` sólo aparece dentro del XSD de la AEAT, no en código nuestro.',
      nuevo: `[Corregido ${F}, ${PS}: aquí decía «\`TiempoEsperaEnvio\` sólo aparece dentro del XSD de la AEAT, no en código nuestro», y es falso: lo nombran tres ficheros de \`src/modules/fiscal/verifactu/\` —\`sif.client.ts\` lo lee de la respuesta, \`sif.cola.ts\` fija su suelo de 60 s y \`sif.procesador.ts\` lo usa como espera por obligado— (SCRUM-1500g, Jira c.18986). «Ningún código mantiene esa conversación» sigue siendo cierto sólo como «nada se ejecuta»: \`procesarObligado\` y \`enviarSobre\` tienen 0 llamadas en \`src/\` (SCRUM-1500d, Jira c.18919). ${NM}]` },
    { f, l: 64, viejo: 'no hay cola que pausar ni nada pendiente que remitir al reanudar.',
      nuevo: `[Corregido ${F}, ${PS}: aquí decía «no hay cola que pausar ni nada pendiente que remitir al reanudar», y que lo único que hace la bandera es viajar en el sobre de auditoría; es falso desde el 30-sep-2026 (SCRUM-1296). ${M} \`procesarObligado\` (\`sif.procesador.ts\`) también lee \`SIF_ENABLED\`, para dejar la cola en pausa, pero tiene 0 llamadas: hoy la bandera sigue sin pausar nada que esté en marcha, y lo pendiente de remitir son las altas en \`pending\`. ${NM}]` },
    { f, l: 83, viejo: 'no hay envío, ni reintentos, ni ese estado (auditoría, eslabones 8 y 9).',
      nuevo: `no hay envío. [Corregido ${F}, ${PS}: aquí seguía «ni reintentos, ni ese estado (auditoría, eslabones 8 y 9)», y es falso desde el 30-sep-2026 (SCRUM-1296): \`manual_review\` está en el enum del esquema, y ${R}; sus tests NO se han corrido hoy. Falta quien lo ejecute. ${NM}]` },
    { f, l: 88, viejo: 'hay envío, y el documento',
      nuevo: `hay envío [Nota del 13-oct-2026, ${PS}: el máster, Parte U1.3 (S1-D), dice que hay 3 registros aceptados en pruebas (SCRUM-1110, SCRUM-1296); con qué se enviaron NO está medido. Desde \`src/\` nada envía: \`enviarSobre\` tiene 0 llamadas (Jira c.18919)], y el documento` },
  ]),
  // ── la otra skill fiscal (no tiene copia en .agents/) ──────────────────────────────────
  { f: '.claude/skills/verifactu/SKILL.md', l: 46, viejo: '**Los dos que NO existen:**',
    nuevo: '**Los dos que NO existen:** *(el 8 existe a medias desde el 30-sep-2026: ver su corchete)*' },
  { f: '.claude/skills/verifactu/SKILL.md', l: 48, viejo: '8. ⛔ La **cola de envío**',
    nuevo: `8. ⛔ La **cola de envío** — [Corregido ${F}, ${PS}: aquí figuraba, sin más, entre «los dos que NO existen», y es falso desde el 30-sep-2026 (SCRUM-1296). ${M} Falta quien la vacíe. ${NM}]` },
  // ── el comentario del código, su gemelo del test y la cita del asesor ──────────────────
  { f: 'src/modules/invoicing/domain/modoVisible.ts', l: 21, viejo: 'Cero clientes SOAP/mTLS contra', nuevo: 'Nada envía a' },
  { f: 'src/modules/invoicing/domain/modoVisible.ts', l: 22, viejo: '// la AEAT. [Corregido el 8-oct-2026',
    nuevo: `// la AEAT. ${SOAP} [Corregido el 8-oct-2026` },
  { f: 'tests/scrum298-modo-visible.test.mjs', l: 9, viejo: 'existe**: cero clientes SOAP/mTLS contra la AEAT. [Corregido el 8-oct-2026',
    nuevo: `existe**: nada envía a la AEAT. ${SOAP} [Corregido el 8-oct-2026` },
  { f: LEGAL + 'PREGUNTAS_ASESOR.md', l: 461, viejo: 'el corchete de dentro es del propio comentario)*',
    nuevo: 'los corchetes de dentro son del propio comentario; puesta al día otra vez el 13-oct-2026, SCRUM-1500h, decisión del fundador en SCRUM-1500 c.18993, al corregirse en él «Cero clientes SOAP/mTLS contra la AEAT»)*' },
  { f: LEGAL + 'PREGUNTAS_ASESOR.md', l: 463, viejo: 'Cero clientes SOAP/mTLS contra la AEAT. [Corregido el 8-oct-2026',
    nuevo: `Nada envía a la AEAT. ${SOAP} [Corregido el 8-oct-2026` },
  // ── el comentario del fichero que se sirve al navegador (corto: se sirve) ──────────────
  { f: 'public/dashboard/js/settingsView.js', l: 195, viejo: '(sin cliente SOAP/mTLS, sin cola de remisión)',
    nuevo: `(nada envía a la AEAT) [Corregido ${F}, ${P}: aquí decía «sin cliente SOAP/mTLS, sin cola de remisión», y las dos mitades eran falsas como «no existe»: hay un cliente (\`sif.client.ts\`) que nadie llama y una cola que la emisión llena y ningún proceso vacía. Sigue siendo cierto que nada envía. El detalle y lo NO medido, en \`src/modules/invoicing/domain/modoVisible.ts\`.]` },
  // ── la cabecera del test de la cola ────────────────────────────────────────────────────
  { f: 'tests/scrum1127-sif-cola.test.mjs', l: 3, viejo: '// Sin base (la tabla `VfSubmission` NO existe: ver `docs/master/SCRUM-1127.md`) y sin red.',
    nuevo: `// Sin base y sin red. [Corregido ${F}, ${P}: aquí decía «(la tabla \`VfSubmission\` NO existe: ver \`docs/master/SCRUM-1127.md\`)», cierto al escribirse y falso desde el 30-sep-2026 (SCRUM-1296): el esquema tiene \`model VfSubmission\`. Este test sigue sin usar base. NO medido: si la tabla existe en producción, staging o dev.]` },
  // ── docs/legal ─────────────────────────────────────────────────────────────────────────
  { f: LEGAL + 'AUDITLOG_FISCAL_CONTRATO.md', l: 300, viejo: 'sin `VfSubmission` en el',
    nuevo: `nada envía; [Corregido ${F}, ${P}: aquí decía «sin \`VfSubmission\` en el schema», falso desde el 30-sep-2026 (SCRUM-1296). ${M} ${NM}] —` },
  { f: LEGAL + 'AUDITLOG_FISCAL_CONTRATO.md', l: 301, viejo: 'schema — SCRUM-200 §7).', nuevo: 'SCRUM-200 §7).' },
  { f: LEGAL + 'AUDITLOG_FISCAL_CONTRATO.md', l: 777, viejo: 'sin `VfSubmission` en el schema',
    nuevo: `nada envía; [Corregido ${F}, ${P}: aquí decía «sin \`VfSubmission\` en el schema», falso desde el 30-sep-2026 (SCRUM-1296). ${M} ${NM}]` },
  { f: LEGAL + 'SEMAFORO_MAPA_EMISION.md', l: 295, viejo: '🔴 **No existe.** No hay tabla ni columna de respuesta | Sin `VfSubmission` en el schema |',
    nuevo: `🔴 **No hay respuesta guardada, porque nada envía.** | [Corregido ${F}, ${P}: aquí decía «No existe. No hay tabla ni columna de respuesta · Sin \`VfSubmission\` en el schema», falso desde el 30-sep-2026 (SCRUM-1296): el esquema tiene \`model VfSubmission\`, con las columnas \`csv\`, \`estadoRegistro\` y \`lastError\` (leído en \`prisma/schema.prisma\` el 13-oct-2026; qué escribe en ellas el procesador NO se ha leído). ${M} ${NM}] |` },
  { f: LEGAL + 'SEMAFORO_MAPA_EMISION.md', l: 296, viejo: '🔴 **No existe.** Sin estado, sin reintentos | ídem |',
    nuevo: `🔴 **Nada lo ejecuta.** | [Corregido ${F}, ${P}: aquí decía «No existe. Sin estado, sin reintentos · ídem», falso desde el 30-sep-2026 (SCRUM-1296): el esquema tiene el estado (\`status\`: \`pending\`, \`sent\`, \`accepted\`, \`rejected\`, \`manual_review\`) y el contador \`attempts\`, y ${R}. Hoy sólo se puede escribir \`pending\`. ${NM}] |` },
  { f: LEGAL + 'SEMAFORO_MAPA_EMISION.md', l: 302, viejo: 'máster que aún no existe en el schema.',
    nuevo: `esquema desde el 30-sep-2026 (SCRUM-1296), que la emisión llena y ningún proceso vacía. [Corregido ${F}, ${P}: aquí decía «\`VfSubmission\` es un modelo del máster que aún no existe en el schema». ${M} ${NM}]` },
  { f: LEGAL + 'SEMAFORO_CALIBRACION.md', l: 199, viejo: 'sin tabla, sin envío, cero llamadas de red.',
    nuevo: `sin envío. [Corregido ${F}, ${P}: aquí decía «sin tabla, sin envío, cero llamadas de red». «Sin tabla» es falso desde el 30-sep-2026 (SCRUM-1296). ${M} Y «cero llamadas de red» es cierto como «nada envía» y falso como «no hay código que llame». ${C} ${NM}]` },
  { f: LEGAL + 'AUDITORIA_CAMINO_EMISION.md', l: 151, viejo: '| **INEXISTENTE** | no hay envío que gobernar |',
    nuevo: `| **EL CÓDIGO EXISTE Y NADA LO EJECUTA** | Corregido ${F} (${P}): aquí decía «INEXISTENTE · no hay envío que gobernar». Desde el 30-sep-2026 (SCRUM-1296) ${R}. «No hay envío que gobernar» sigue siendo cierto. NO medido: sus tests no se han corrido hoy, ni ninguna base de datos, ni el valor de \`SIF_ENABLED\` en Railway. |` },
  { f: LEGAL + 'AUDITORIA_CAMINO_EMISION.md', l: 225, viejo: 'instrumentos y el control positivo — no por creerse el comentario.',
    nuevo: `instrumentos y el control positivo — no por creerse el comentario. [Corregido ${F}, ${P}: lo que esta auditoría confirmó es que nada envía, y eso sigue en pie. «Cero clientes SOAP/mTLS» es falso como «no existe ningún cliente» desde SCRUM-1127. ${C} ${CNM} El comentario de \`modoVisible.ts\` se corrigió ese mismo día y dice ahora «Nada envía a la AEAT».]` },
  // ── los dos inventarios de agosto: NO se reclasifican; nota fechada al lado ────────────
  { f: LEGAL + 'INVENTARIO_AFIRMACIONES_VERIFACTU.md', l: 107, viejo: '— la FSM de una entidad que no existe**',
    nuevo: `— la FSM de una entidad que no existe** *(Nota del 13-oct-2026, ${P}: este inventario es del 19-ago-2026 y NO se reclasifica. Que la entidad o la cola «no existe» o «no está en el esquema» —aquí y en las líneas 25, 70, 112 y 120— era cierto entonces y es falso desde el 30-sep-2026 (SCRUM-1296). ${M} ${NM})*` },
  { f: LEGAL + 'INVENTARIO_AFIRMACIONES_VERIFACTU.md', l: 411, viejo: 'Correcto en el hecho; el paréntesis',
    nuevo: `*(Nota del 13-oct-2026, ${P}: «sin VfSubmission en el schema» —aquí y en las citas de las líneas 406 y 408— era cierto el 19-ago-2026 y es falso desde el 30-sep-2026 (SCRUM-1296); la entrada NO se reclasifica. ${M} ${NM})* Correcto en el hecho; el paréntesis` },
  { f: LEGAL + 'INVENTARIO_AFIRMACIONES_VERIFACTU.md', l: 416, tiene: 'Nota del 8-oct-2026, SCRUM-1500f',
    cola: ` *(Nota del 13-oct-2026, ${P}: y «Cero clientes SOAP/mTLS contra la AEAT», de esta misma cita, es falso como «no existe ningún cliente» desde SCRUM-1127 y sigue siendo cierto como «nada envía». ${C} ${CNM})*` },
  { f: LEGAL + 'INVENTARIO_AFIRMACIONES_SKILLS.md', l: 143, tiene: '> No hay envío, no hay cola y no hay interruptor',
    cola: ` *(Nota del 13-oct-2026, ${P}: medido el 20-ago-2026 y NO reclasificado. Que la cola o la entidad \`VfSubmission\` «no existe», «no aparece» o «no está en el esquema» —aquí y en las líneas 49, 144, 156, 169, 175, 181, 186, 303 y 335— era cierto entonces y es falso desde el 30-sep-2026 (SCRUM-1296). ${M} «No hay envío» sigue siendo cierto. ${NM})*` },
  { f: LEGAL + 'INVENTARIO_AFIRMACIONES_SKILLS.md', l: 229, viejo: 'que dice que no hay clientes SOAP/mTLS.',
    nuevo: `que dice que no hay clientes SOAP/mTLS. *(Nota del 13-oct-2026, ${P}: ese comentario se corrigió el 13-oct-2026. Como «no existe ningún cliente» era falso desde SCRUM-1127; como «nada envía» sigue siendo cierto. ${C} ${CNM})*` },
  // ── fuera de docs/legal ────────────────────────────────────────────────────────────────
  { f: 'docs/RUNBOOKS.md', l: 76, viejo: 'que nunca se construyó (cero tabla',
    nuevo: `que nunca se construyó [13-oct-2026, ${P}: eso era cierto el 23-sep-2026; desde el 30-sep-2026 (SCRUM-1296) la tabla existe, la emisión la llena y ningún proceso la vacía (SCRUM-1500d, Jira c.18919); sigue sin haber envío. ${NM}] (cero tabla` },
  { f: 'docs/equipo/puesto-j1.md', l: 16, viejo: 'sin tabla, sin envío, cero llamadas de red,',
    nuevo: `sin envío [Corregido ${F}, ${P}: aquí decía «sin tabla, sin envío, cero llamadas de red». Desde el 30-sep-2026 (SCRUM-1296) hay tabla: la emisión la llena y ningún proceso la vacía (SCRUM-1500d, Jira c.18919). Y hay un cliente SOAP, \`src/modules/fiscal/verifactu/sif.client.ts\`, que nadie llama (SCRUM-1500g, Jira c.18986). ${NM}],` },
  { f: 'docs/SIF_SPEC_NOTES.md', l: 77, viejo: 'esa cola no', nuevo: 'esa cola' },
  { f: 'docs/SIF_SPEC_NOTES.md', l: 78, viejo: '> está en `prisma/schema.prisma`.',
    nuevo: `> existe en \`prisma/schema.prisma\` y nadie la vacía. [Corregido ${F}, ${P}: aquí decía «esa cola no está en \`prisma/schema.prisma\`», falso desde el 30-sep-2026 (SCRUM-1296; este mismo fichero lo dice más abajo, en «Actualizado el 30-sep-2026»). ${M} ${NM}]` },
  { f: 'docs/sql/scrum-825-borrado-de-documentos-de-prueba.sql', l: 14, tiene: 'la cola de envío y el envío NO EXISTEN.',
    cola: ` [Nota del 13-oct-2026, ${P}: cierto el 8-sep-2026, cuando se escribió este guion. Desde el 30-sep-2026 (SCRUM-1296) la cola existe a medias: la emisión la llena y ningún proceso la vacía (SCRUM-1500d, Jira c.18919). El envío sigue sin existir. ${NM}]` },
];

const cuantas = (texto, trozo) => texto.split(trozo).length - 1;
const porFichero = new Map();
const fallos = [];
for (const op of OPS) {
  if (!porFichero.has(op.f)) {
    const crudo = fs.readFileSync(path.join(RAIZ, op.f), 'utf8');
    porFichero.set(op.f, { lineas: crudo.split('\n'), antes: crudo.split('\n').length });
  }
  const { lineas } = porFichero.get(op.f);
  const i = op.l - 1;
  const cr = lineas[i].endsWith('\r') ? '\r' : '';
  const cuerpo = cr ? lineas[i].slice(0, -1) : lineas[i];
  if (op.viejo !== undefined) {
    const n = cuantas(cuerpo, op.viejo);
    if (n !== 1) { fallos.push(`${op.f}:${op.l} — el trozo viejo aparece ${n} veces, no 1`); continue; }
    lineas[i] = cuerpo.replace(op.viejo, () => op.nuevo) + cr;
  } else {
    if (cuantas(cuerpo, op.tiene) !== 1) { fallos.push(`${op.f}:${op.l} — no lleva el testigo «${op.tiene}»`); continue; }
    lineas[i] = cuerpo + op.cola + cr;
  }
  if (/[\r\n]/.test(op.nuevo ?? op.cola)) fallos.push(`${op.f}:${op.l} — el texto nuevo trae un salto de línea`);
}

console.log(`POBLACION: ${OPS.length} operaciones sobre ${porFichero.size} ficheros`);
if (fallos.length) {
  console.log(`NO SE ESCRIBE NADA: ${fallos.length} operación(es) no casan:`);
  for (const x of fallos) console.log('  ' + x);
  console.log('EXIT=1');
  process.exit(1);
}
for (const [f, { lineas, antes }] of porFichero) {
  if (lineas.length !== antes) throw new Error(`${f}: cambió el número de líneas`);
  if (!SECO) fs.writeFileSync(path.join(RAIZ, f), lineas.join('\n'));
  console.log(`${SECO ? 'haría' : 'escrito'}: ${f} · ${antes} líneas`);
}
console.log('EXIT=0');
