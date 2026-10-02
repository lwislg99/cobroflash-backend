// Mutaciones de SCRUM-1334 sobre `scrum514`: la poblacion entera, las cajas y las declaradas. Cada
// una se aplica (y se comprueba que SE APLICO), se corre el test, se apunta que casos caen y se
// restaura. Al final se comprueba por CONTENIDO que el fichero ha vuelto a ser el que era.
//
// MUTA el propio fichero del guard (no hay build: es lectura pura). Se lanza a mano, con el arbol
// comiteado, y mientras corre no se mide nada mas en este arbol:
//   node tests/banco-scrum1334/mutar.mjs
//
// La BASE se corre antes. Si trae algun caso en rojo se NOMBRA y se sigue: una mutacion solo cuenta
// si tumba un caso que en la base estaba verde.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const TEST = 'tests/scrum514-aprobado-y-aplicado.test.mjs';
const F = path.join(RAIZ, TEST);

const CABECERA = 'if (h) { seccion = h[1].trim(); continue; }';

// `cae`: trozo del NOMBRE del caso que tiene que caer. Se comprueba contra la base antes de mutar.
const MUTACIONES = [
  { id: 'M1 vuelve el criterio viejo: solo las citas bajo «Texto aprobado»',
    de: CABECERA, a: CABECERA + '\n    if (!/texto\\s+aprobado/i.test(seccion)) continue;',
    cae: 'vaya bajo el encabezado que vaya' },
  { id: 'M2 las citas bajo un titulo en plural vuelven a quedarse fuera',
    de: CABECERA, a: CABECERA + '\n    if (/textos\\s+aprobados/i.test(seccion)) continue;',
    cae: 'TESTIGO REAL' },
  { id: 'M3 una seccion de las que ya se cruzaban deja de cruzarse',
    de: CABECERA, a: CABECERA + '\n    if (/partes\\s+fijas/i.test(seccion)) continue;',
    cae: 'lo que ya se cruzaba por su título se sigue cruzando' },
  { id: 'M4 lo que el codigo no pinta pasa callado',
    de: "if (c.caja !== 'cruce' || fuera.has(c.texto) || textoDelCorpus.includes(c.texto)) continue;", a: 'continue;',
    cae: 'sale en rojo y dice dónde' },
  { id: 'M5 toda linea de la ficha es poblacion, no solo las citas',
    de: "if (!m || m[1].trim() === '') continue;\n    const texto = m[1].trim();",
    a: "const texto = (m ? m[1] : linea).trim();\n    if (texto === '') continue;",
    cae: 'la prosa de una ficha que NO va en cita' },
  { id: 'M6 las citas cortas se tiran sin meterlas en ninguna caja',
    de: "if (texto.length < 4) { out.push({ texto, seccion, caja: 'corta' }); continue; }", a: 'if (texto.length < 4) continue;',
    cae: 'RECUENTO' },
  { id: 'M7 una plantilla entra en el cruce',
    de: "if (/{[^}]+}/.test(texto)) { out.push({ texto, seccion, caja: 'plantilla' }); continue; }", a: '',
    cae: 'una plantilla y una cita corta siguen fuera' },
  { id: 'M8 una declaracion vale para el texto, este en la ficha que este',
    de: 'lista.some((d) => d.ficha === ap.nombre && d.texto === u.texto)', a: 'lista.some((d) => d.texto === u.texto)',
    cae: 'una cita declarada sale del cruce SÓLO en su ficha' },
  { id: 'M9 ya no se mira que las partes fijas sigan en el fichero',
    de: 'else for (const p of fijas) if (!codigo.includes(p)) fallos.push(', a: 'else for (const p of fijas) if (false) fallos.push(',
    cae: 'una declaración con su prueba vale' },
  { id: 'M10 una declaracion sobrevive a que el codigo ya pinte la cita',
    de: 'if (textoDelCorpus.includes(d.texto)) fallos.push(', a: 'if (false) fallos.push(',
    cae: 'una declaración con su prueba vale' },
  { id: 'M11 una declaracion sobrevive a que la ficha pierda la cita',
    de: 'else if (!citasDeFicha(ficha).some((c) => c.texto === d.texto)) fallos.push(', a: 'else if (false) fallos.push(',
    cae: 'una declaración con su prueba vale' },
  { id: 'M12 un dato puede ser una frase entera',
    de: 'if (v.length > LARGO_DE_UN_DATO) fallos.push(', a: 'if (false) fallos.push(',
    cae: 'una NOTA no cuela' },
  { id: 'M13 una declaracion sin ninguna parte fija de verdad vale',
    de: 'if (!fijas.some((p) => p.trim().length >= 4)) fallos.push(', a: 'if (false) fallos.push(',
    cae: 'una NOTA no cuela' },
  { id: 'M14 una declaracion REAL deja de corresponder a su cita',
    de: "partes: [dato('3'), ' fotos'],", a: "partes: [dato('3'), ' fotografías'],",
    cae: 'cada DECLARADA sigue en su ficha' },
  { id: 'M15 una declaracion REAL nombra un fichero donde ya no se compone',
    de: "fichero: 'public/dashboard/js/customerDetailView.js',", a: "fichero: 'public/dashboard/js/jobsView.js',",
    cae: 'cada DECLARADA sigue en su ficha' },
  // ── Las notas ajenas (decision del orquestador, SCRUM-1334 comentario 18018) ──────────────────
  { id: 'M16 ya no se mira de que equipo es el fichero que usa el texto',
    de: 'else if (equipoDelPuesto(puesto) !== d.dueno) {', a: 'else if (false) {',
    cae: 'no se puede declarar ajena: se arregla' },
  { id: 'M17 un fichero del que el reparto no dice nada vale como ajeno',
    de: 'if (!puesto) fallos.push(`CIEGO:', a: 'if (false) fallos.push(`CIEGO:',
    cae: 'no se puede declarar ajena: se arregla' },
  { id: 'M18 los puestos J pasan por ser del otro equipo',
    de: "(puesto.startsWith('J') ? 'equipo de Javier' : 'equipo de Luis')", a: "('equipo de Luis')",
    cae: 'CONTROL REAL' },
  { id: 'M19 ya no se comprueba que el fichero declarado pinte una cita de la ficha',
    de: 'if (!citas.some((c) => !c.caja && c.texto !== d.texto && codigo.includes(c.texto))) {', a: 'if (false) {',
    cae: 'una nota ajena con sus tres cosas' },
  { id: 'M20 una nota ajena sin fecha vale',
    de: "if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(d.fecha || '') || Number.isNaN(Date.parse(d.fecha))) fallos.push(", a: 'if (false) fallos.push(',
    cae: 'una nota ajena con sus tres cosas' },
  { id: 'M21 una nota ajena sin dueno, o con este equipo de dueno, vale',
    de: 'if (!EQUIPOS_AJENOS.includes(d.dueno)) fallos.push(', a: 'if (false) fallos.push(',
    cae: 'una nota ajena con sus tres cosas' },
  { id: 'M22 una entrada sobrevive a que su dueno le quite el > a la nota',
    de: "if (!citas.some((c) => c.texto === d.texto)) {\n    return [...fallos, 'su ficha ya no tiene esa cita: la entrada SOBRA.",
    a: "if (false) {\n    return [...fallos, 'su ficha ya no tiene esa cita: la entrada SOBRA.",
    cae: 'una nota ajena con sus tres cosas' },
  { id: 'M23 el techo de una ficha sube sin que la lista cambie',
    de: "'2026-09-07-SCRUM-722-nuevo-albaran.md': 1,", a: "'2026-09-07-SCRUM-722-nuevo-albaran.md': 2,",
    cae: 'TRINQUETE' },
  { id: 'M24 la lista REAL crece: un texto mas declarado ajeno en una ficha con techo',
    de: "    '[PENDIENTE microcopy oficial] Nuevo albarán',\n  ]),", a: "    '[PENDIENTE microcopy oficial] Nuevo albarán',\n    'Nuevo albarán',\n  ]),",
    cae: 'TRINQUETE' },
  { id: 'M25 la nota REAL de una ficha de este equipo (728, la usa un fichero de J1) se declara ajena',
    de: 'const NOTAS_AJENAS = [',
    a: "const NOTAS_AJENAS = [\n  { ficha: '2026-09-08-SCRUM-728-serie-ocupada.md', texto: 'No se pudo crear el albarán: **API 500: internal_error**', dueno: 'equipo de Luis', fecha: '2026-10-02', usa: 'src/modules/invoicing/domain/cerrojoSaturado.ts', motivo: 'Mutacion: la nota de una ficha cuyo texto usa un fichero de J1, declarada como si fuera de otro equipo.' },",
    cae: 'cada NOTA AJENA sale NOMBRADA' },
  { id: 'M26 la caja ajena tambien saca textos del registro congelado',
    de: "(deFicha && esDe(ajenas, u) ? 'ajena' : 'cruce')", a: "(esDe(ajenas, u) ? 'ajena' : 'cruce')",
    cae: 'no saca nada del registro congelado' },
  { id: 'M27 en el reparto, el resto del directorio gana a la ruta nombrada',
    de: 'proponer(f.puesto, 2000 + r.length)', a: 'proponer(f.puesto, r.length - 2000)',
    cae: 'el lector del reparto' },
  { id: 'M28 en el reparto, un nombre que solo ACABA igual pasa por el fichero nombrado',
    de: "ruta === r || ruta.endsWith('/' + r)", a: 'ruta.endsWith(r)',
    cae: 'el lector del reparto' },
  // CONTROLES: cambian el fichero y NO el comportamiento. Tienen que salir MUDAS. Si una «cae», el
  // banco esta diciendo CAE a cualquier cosa y ninguna fila de arriba vale.
  { id: 'C1 control: cambia una palabra de un mensaje que ningun caso mira', control: true,
    de: 'Sin saberlo no la doy por ajena`);', a: 'Sin saberlo no la doy por AJENA`);' },
  { id: 'C2 control: un comentario mas', control: true,
    de: 'const NOTAS_AJENAS = [', a: '// control del banco: un comentario no cambia nada\nconst NOTAS_AJENAS = [' },
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const correr = () => spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const leer = (r) => {
  const out = r.stdout || '';
  const nombres = [...out.matchAll(/^(not ok|ok) \d+ - (.*)$/gm)].map((m) => ({ ok: m[1] === 'ok', nombre: m[2] }));
  // Un proceso que muere a medias (salida mayor que el bufer, por ejemplo) deja un TAP parcial que se
  // lee como un resultado. No lo es: se declara y no cuenta.
  const murio = r.status === null || !/^# tests \d+/m.test(out);
  return { murio, nombres, ok: nombres.filter((n) => n.ok).length, caen: nombres.filter((n) => !n.ok).map((n) => n.nombre) };
};

const original = fs.readFileSync(F, 'utf8');
const base = leer(correr());
console.log(`POBLACION: ${MUTACIONES.length} mutaciones sobre ${TEST}`);
console.log(`BASE: casos=${base.nombres.length} ok=${base.ok} caen=${base.caen.length}`);
for (const n of base.caen) console.log(`   base en rojo (no cuenta para ninguna mutacion): ${n}`);
if (base.murio || base.ok === 0) { console.log('CIEGO: la base no ha corrido'); process.exit(2); }
for (const m of MUTACIONES) {
  if (m.control) continue;
  const suyos = base.nombres.filter((n) => n.nombre.includes(m.cae));
  if (suyos.length !== 1 || !suyos[0].ok) {
    console.log(`CIEGO: «${m.cae}» no nombra exactamente UN caso VERDE de la base (${m.id})`); process.exit(2);
  }
}

let mudas = 0;
try {
  for (const m of MUTACIONES) {
    if (original.split(m.de).length !== 2) { console.log(`CIEGO ${m.id}: el texto a mutar no aparece exactamente una vez`); mudas++; continue; }
    fs.writeFileSync(F, original.replace(m.de, () => m.a));
    if (fs.readFileSync(F, 'utf8') === original) { console.log(`CIEGO ${m.id}: la mutacion no se aplico`); mudas++; continue; }
    const r = leer(correr());
    if (r.murio) { console.log('CIEGO ' + m.id + ': el test no llego al final (TAP parcial)'); mudas++; continue; }
    const nuevos = r.caen.filter((n) => !base.caen.includes(n));
    if (m.control) {
      const muda = nuevos.length === 0 && r.ok === base.ok;
      if (!muda) mudas++;
      console.log(`${muda ? 'MUDA (como debe)' : 'CAE Y NO DEBIA'} ${m.id} · ok=${r.ok} caen=${r.caen.length} (nuevos: ${nuevos.length})`);
      for (const n of nuevos) console.log(`        - ${n}`);
      continue;
    }
    const esperado = nuevos.some((n) => n.includes(m.cae));
    if (!esperado) mudas++;
    console.log(`${esperado ? 'CAE  ' : 'MUDA '} ${m.id} · ok=${r.ok} caen=${r.caen.length} (nuevos: ${nuevos.length})${r.nombres.length === 0 ? ' (el fichero no llego a correr)' : ''}`);
    for (const n of nuevos) console.log(`        - ${n}`);
  }
} finally {
  fs.writeFileSync(F, original);
}
const restaurado = fs.readFileSync(F, 'utf8') === original;
const fin = leer(correr());
const igualQueLaBase = JSON.stringify(fin.caen) === JSON.stringify(base.caen) && fin.ok === base.ok;
console.log(`RESTAURADO: ${restaurado} · tras restaurar ok=${fin.ok} caen=${fin.caen.length} · igual que la base=${igualQueLaBase}`);
const controles = MUTACIONES.filter((m) => m.control).length;
console.log(`RESULTADO: ${MUTACIONES.length - mudas} de ${MUTACIONES.length} como deben (${MUTACIONES.length - controles} mutaciones que tienen que caer en su caso, ${controles} controles que tienen que salir mudos)`);
const salida = mudas === 0 && restaurado && igualQueLaBase ? 0 : 1;
console.log(`EXIT=${salida}`);
process.exit(salida);
