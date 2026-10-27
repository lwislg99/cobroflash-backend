// docs/master/evidencias/SCRUM-1404/censo-scrum205-por-efecto.mjs — SCRUM-1404
//
// LOS DOS HUECOS QUE LA ENTREGA DE PR-1 DECLARÓ SIN MEDIR, medidos EJECUTANDO:
//
//   (1) qué vigila de verdad `tests/scrum205-fallo-de-sellado-no-entrega.test.mjs` (sus tres
//       afirmaciones) y si ve el camino del reintento;
//   (2) el caso ④ de `tests/scrum1404b-el-reintento-del-sellado.test.mjs`, mutado DONDE TOCA: en el
//       literal que escribe `selladoEstado.ts`, y no en la constante del módulo del reintento.
//
// 🔴 `selladoEstado.ts` es camino de emisión y el guard es un guard: NINGUNO DE LOS DOS SE TOCA.
// Lo que se muta es un ESPEJO: una copia de `src/`, de `dist/`, de los tests y de la lista de
// declaradas, dentro de `dist/` (que git ignora, y desde donde node encuentra `node_modules`). Los
// tests del espejo son idénticos byte a byte a los del árbol (se comprueba por sha256 antes de
// juzgar nada) y leen SU `src/`, porque calculan la raíz desde su propia carpeta.
//
//   node docs/master/evidencias/SCRUM-1404/censo-scrum205-por-efecto.mjs     (después de compilar)
//
// Cada mutación lleva escrito, ANTES de correr, qué caso tiene que caer (o que se espera MUDA, y
// entonces es un límite del instrumento que se quiere enseñar, no un fallo). El veredicto compara lo
// esperado con lo visto: ACIERTA o SORPRESA. Una mutación cuya ancla no casa exactamente una vez es
// CIEGA y no se juzga.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const ESPEJO = path.join(RAIZ, 'dist', `_espejo-1404-${process.pid}`);
const G = 'tests/scrum205-fallo-de-sellado-no-entrega.test.mjs';
const P = 'tests/scrum205-un-solo-punto-de-sellado.test.mjs';
const T = 'tests/scrum1404b-el-reintento-del-sellado.test.mjs';
const SELLADO = 'src/modules/invoicing/domain/selladoEstado.ts';
const REINTENTO = 'src/modules/invoicing/domain/reintentoSellado.ts';
const LIB = 'src/lib/invoicing.ts';
const SELLADO_JS = 'dist/modules/invoicing/domain/selladoEstado.js';

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const enRaiz = (r) => path.join(RAIZ, r);
const enEspejo = (r) => path.join(ESPEJO, r);

// ── las mutaciones, DECLARADAS ANTES DE CORRER ─────────────────────────────────────────────────
// [id, qué es, fichero del espejo, ancla, cambio, test que se corre, lo que se espera]
// `espera`: una subcadena del NOMBRE del caso que tiene que caer, o null = se espera MUDA (límite).
// `nombra`: una subcadena que el mensaje del rojo tiene que llevar (el fichero señalado).
const RETURN_PENDIENTE = 'return { estado: SELLADO_PENDIENTE, error: mensaje };';
const LLAMADA = '      const r = opciones.sellar\n';
const MUTACIONES = [
  // ① de scrum205
  { id: 'A1', que: 'el fallo de sellado devuelve «sellado» en vez del estado que bloquea', en: SELLADO, ancla: RETURN_PENDIENTE, cambio: 'return { estado: SELLADO_HECHO };', test: G, espera: '① un `sellado_fallido` registrado', nombra: 'selladoEstado.ts:' },
  { id: 'A2', que: 'el sellado cambia el nombre de la acción que registra', en: SELLADO, ancla: "action: 'sellado_fallido',", cambio: "action: 'sellado_fallado',", test: G, espera: '① un `sellado_fallido` registrado', nombra: 'ESCÁNER CIEGO' },
  { id: 'A3', que: 'LÍMITE: devuelve «sellado» y el estado bloqueante sólo queda en un comentario', en: SELLADO, ancla: RETURN_PENDIENTE, cambio: 'return { estado: SELLADO_HECHO }; // antes SELLADO_PENDIENTE', test: G, espera: null },
  { id: 'A4', que: 'el reintento vuelve a LEER la acción con el literal (el falso positivo de PR-1)', en: REINTENTO, ancla: 'action: ACCION_DEL_SELLADO_FALLIDO }', cambio: "action: 'sellado_fallido' }", test: G, espera: '① un `sellado_fallido` registrado', nombra: 'reintentoSellado.ts:' },
  // ② de scrum205
  { id: 'B1', que: 'el portón deja pasar todo', en: SELLADO, ancla: 'return estado !== SELLADO_PENDIENTE;', cambio: 'return true;', test: G, espera: '② el portón bloquea de verdad', nombra: 'NO BLOQUEA' },
  { id: 'B2', que: 'el portón bloquea también «no aplica»', en: SELLADO, ancla: 'return estado !== SELLADO_PENDIENTE;', cambio: 'return estado === SELLADO_HECHO;', test: G, espera: '② el portón bloquea de verdad', nombra: 'no_aplica' },
  { id: 'B3', que: 'LÍMITE: el predicado sigue bien pero quien genera el PDF deja de preguntarle', en: LIB, ancla: 'if (!puedeProducirDocumento(inv.vfEstado)) {', cambio: 'if (false) {', test: G, espera: null },
  // ③ de scrum205, sobre el camino del reintento
  { id: 'C1', que: 'el reintento sella, tira el resultado y entrega el PDF', en: REINTENTO, ancla: LLAMADA, cambio: `      await sellarTrasEmision(factura, f.merchant ?? {}, prisma); await ensureInvoicePdf(f.id);\n${LLAMADA}`, test: G, espera: '③ ningún llamador descarta', nombra: 'reintentoSellado.ts:' },
  { id: 'C2', que: 'el reintento sella y tira el resultado, sin entregar nada', en: REINTENTO, ancla: LLAMADA, cambio: `      await sellarTrasEmision(factura, f.merchant ?? {}, prisma);\n${LLAMADA}`, test: G, espera: '③ ningún llamador descarta', nombra: 'RATCHET' },
  { id: 'C3', que: 'LÍMITE: lo mismo que C1, pero llamando a la puerta por un alias', en: REINTENTO, ancla: LLAMADA, cambio: `      const puerta = sellarTrasEmision; await puerta(factura, f.merchant ?? {}, prisma); await ensureInvoicePdf(f.id);\n${LLAMADA}`, test: G, espera: null },
  { id: 'C4', que: 'LÍMITE: el reintento LEE el resultado, y con «sigue pendiente» entrega el PDF igual', en: REINTENTO, ancla: 'else parte.siguenPendientes.push(nombrada);', cambio: 'else { await ensureInvoicePdf(f.id); parte.siguenPendientes.push(nombrada); }', test: G, espera: null },
  // el otro fichero de scrum205: el punto único, sobre el reintento
  { id: 'P1', que: 'el reintento sella por su cuenta, sin pasar por la puerta', en: REINTENTO, ancla: LLAMADA, cambio: `      await applyVeriFactu(factura, f.merchant.taxId, prisma);\n${LLAMADA}`, test: P, espera: 'solo `sellarTrasEmision` mete una factura en la cadena', nombra: 'reintentoSellado.ts' },
  // (2) el caso ④ del test del reintento, mutado en selladoEstado.ts
  { id: 'D1', que: 'el literal de la acción cambia en selladoEstado.ts (sólo la fuente)', en: SELLADO, ancla: "action: 'sellado_fallido',", cambio: "action: 'sellado_fallado',", test: T, espera: '④ la acción que el reintento CUENTA', soloEse: true },
  { id: 'D2', que: 'el mismo cambio, en la fuente Y en su compilado', en: SELLADO, ancla: "action: 'sellado_fallido',", cambio: "action: 'sellado_fallado',", tambien: [SELLADO_JS, "action: 'sellado_fallido',", "action: 'sellado_fallado',"], test: T, espera: '④ la acción que el reintento CUENTA', soloEse: true },
  { id: 'D3', que: 'CONTROL: cambia OTRO literal del mismo registro, no la acción', en: SELLADO, ancla: "puntoDeFallo: 'emision',", cambio: "puntoDeFallo: 'emisioX',", test: T, espera: null },
  { id: 'D4', que: 'selladoEstado.ts pasa a escribir una SEGUNDA acción de auditoría', en: SELLADO, ancla: "entityType: 'invoice',", cambio: "entityType: 'invoice', ...({ action: 'otra_cosa' } as any),", test: T, espera: '④ la acción que el reintento CUENTA', soloEse: true },
  { id: 'D5', que: 'la acción deja de ser un literal: pasa a una constante con otro valor', en: SELLADO, ancla: "action: 'sellado_fallido',", cambio: "action: ['sellado_fallado'][0] as 'sellado_fallido',", test: T, espera: '④ la acción que el reintento CUENTA', soloEse: true },
];

// ── el espejo ──────────────────────────────────────────────────────────────────────────────────
function copiar(desde, hasta, filtro = () => true) {
  fs.cpSync(desde, hasta, { recursive: true, filter: (o) => filtro(path.basename(o)) });
}
function montar() {
  fs.mkdirSync(ESPEJO, { recursive: true });
  copiar(enRaiz('src'), enEspejo('src'));
  // `dist/` se copia entrada a entrada: el espejo vive dentro, y copiarlo entero sería copiarse a sí mismo.
  fs.mkdirSync(enEspejo('dist'));
  for (const e of fs.readdirSync(enRaiz('dist'))) {
    if (!e.startsWith('_espejo-1404-')) fs.cpSync(path.join(RAIZ, 'dist', e), path.join(ESPEJO, 'dist', e), { recursive: true });
  }
  fs.mkdirSync(enEspejo('tests'));
  for (const t of [G, P, T, 'tests/_bocas-de-emision.mjs']) fs.copyFileSync(enRaiz(t), enEspejo(t));
  fs.mkdirSync(enEspejo('scripts'));
  fs.copyFileSync(enRaiz('scripts/_sin-consumir-declarados.json'), enEspejo('scripts/_sin-consumir-declarados.json'));
}
function correr(test) {
  const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', test], { cwd: ESPEJO, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = r.stdout || '';
  const cuenta = (q) => Number((new RegExp(`^# ${q} (\\d+)`, 'm').exec(salida) || [])[1] ?? NaN);
  const caidos = [...salida.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { tests: cuenta('tests'), fail: cuenta('fail'), caidos, salida };
}

// ── el censo de llamadores a la puerta: MI lectura, que luego se coteja con la del guard ────────
// ⚠️ Esto NO es el guard: es su misma regla (`nombreDe(n) === 'sellarTrasEmision'`) vuelta a
// escribir. Por eso no se da por buena sola: abajo se le quitan llamadas al espejo hasta que el
// PROPIO guard dice cuántas ve, y los dos números tienen que cuadrar.
function llamadoresDeLaPuerta(raizSrc) {
  const sitios = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (!e.name.endsWith('.ts') || p.endsWith('selladoEstado.ts')) continue;
      const fuente = fs.readFileSync(p, 'utf8');
      const arbol = ts.createSourceFile(p, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const ver = (n) => {
        if (ts.isCallExpression(n)) {
          const c = n.expression;
          const nombre = ts.isPropertyAccessExpression(c) ? c.name : ts.isIdentifier(c) ? c : null;
          if (nombre && nombre.text === 'sellarTrasEmision') {
            let sub = n.parent;
            if (sub && ts.isAwaitExpression(sub)) sub = sub.parent;
            sitios.push({
              fichero: path.relative(raizSrc, p).split(path.sep).join('/'), ruta: p,
              linea: arbol.getLineAndCharacterOfPosition(n.getStart(arbol)).line + 1,
              pos: nombre.getStart(arbol), descartado: !!sub && ts.isExpressionStatement(sub),
            });
          }
        }
        ts.forEachChild(n, ver);
      };
      ver(arbol);
    }
  };
  andar(raizSrc);
  return sitios;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
const antes = { sellado: sha(enRaiz(SELLADO)), reintento: sha(enRaiz(REINTENTO)), lib: sha(enRaiz(LIB)), g: sha(enRaiz(G)), p: sha(enRaiz(P)), t: sha(enRaiz(T)) };
let sorpresas = 0;
let ciegas = 0;
try {
  montar();
  const iguales = [G, P, T, SELLADO, REINTENTO, LIB].map((r) => [r, sha(enRaiz(r)) === sha(enEspejo(r))]);
  console.log(`ESPEJO: ${iguales.length} ficheros cotejados por sha256 con el árbol · distintos ${iguales.filter(([, ok]) => !ok).length}`);
  if (iguales.some(([, ok]) => !ok)) { console.log('CIEGO: el espejo no es idéntico al árbol'); process.exit(2); }

  // La base, sin mutar: tiene que salir limpia, y con población.
  const base = {};
  for (const t of [G, P, T]) {
    base[t] = correr(t);
    console.log(`BASE · ${t} · tests ${base[t].tests} · fail ${base[t].fail}`);
  }
  if ([G, P, T].some((t) => !(base[t].tests > 0) || base[t].fail !== 0)) { console.log('CIEGO: la base no sale limpia; nada se puede juzgar'); process.exit(2); }

  // ── (1a) LA POBLACIÓN de la afirmación ③: quién llama a la puerta ─────────────────────────────
  const sitios = llamadoresDeLaPuerta(enEspejo('src'));
  const control = llamadoresDeLaPuerta(enEspejo('src')).filter((s) => s.fichero.includes('no-existe-este-fichero'));
  console.log(`\nCONTROL A CERO del censo (un fichero que no existe): ${control.length}`);
  console.log(`LLAMADAS A LA PUERTA, mi lectura: ${sitios.length} en ${new Set(sitios.map((s) => s.fichero)).size} ficheros`);
  for (const s of sitios) console.log(`  · ${s.fichero}:${s.linea}${s.descartado ? ' · DESCARTA el resultado' : ''}`);
  const delReintento = sitios.filter((s) => s.fichero.endsWith('reintentoSellado.ts'));
  console.log(`  del reintento: ${delReintento.length}`);

  // El cotejo con el guard: él sólo dice cuántas ve cuando ve menos de 8. Se le quitan al espejo
  // las del final hasta dejar 7 —SIN tocar la del reintento— y tiene que decir «veo 7».
  const UMBRAL = 8;
  const renombrar = (lista) => {
    const porFichero = new Map();
    for (const s of lista) porFichero.set(s.ruta, [...(porFichero.get(s.ruta) || []), s.pos]);
    const originales = new Map();
    for (const [ruta, posiciones] of porFichero) {
      let txt = fs.readFileSync(ruta, 'utf8');
      originales.set(ruta, txt);
      for (const pos of posiciones.sort((a, b) => b - a)) txt = `${txt.slice(0, pos)}sellarTrasEmisioX${txt.slice(pos + 'sellarTrasEmision'.length)}`;
      fs.writeFileSync(ruta, txt);
    }
    return () => { for (const [ruta, txt] of originales) fs.writeFileSync(ruta, txt); };
  };
  const veDelGuard = (r) => Number((/veo (\d+) llamadas/.exec(r.salida) || [])[1] ?? NaN);
  const ajenas = sitios.filter((s) => !s.fichero.endsWith('reintentoSellado.ts'));
  if (sitios.length >= UMBRAL && ajenas.length >= sitios.length - (UMBRAL - 1)) {
    const quitar = ajenas.slice(0, sitios.length - (UMBRAL - 1));
    let deshacer = renombrar(quitar);
    const con = correr(G);
    deshacer();
    console.log(`COTEJO 1 · quitadas ${quitar.length} ajenas, el reintento DENTRO · el guard dice que ve: ${veDelGuard(con)} (espero ${UMBRAL - 1})`);
    deshacer = renombrar([...quitar, ...delReintento]);
    const sin = correr(G);
    deshacer();
    console.log(`COTEJO 2 · las mismas y además la del reintento · el guard dice que ve: ${veDelGuard(sin)} (espero ${UMBRAL - 1 - delReintento.length})`);
    const cuadra = veDelGuard(con) === UMBRAL - 1 && veDelGuard(sin) === UMBRAL - 1 - delReintento.length;
    console.log(`COTEJO: ${cuadra ? 'CUADRA — el guard cuenta las mismas que yo, y la del reintento es una de ellas' : 'NO CUADRA'}`);
    if (!cuadra) sorpresas += 1;
    // Y sólo sin la del reintento: ¿sigue por encima del suelo? (Si no, el suelo descansaba en él.)
    deshacer = renombrar(delReintento);
    const solo = correr(G);
    deshacer();
    console.log(`SIN la llamada del reintento, nada más: fail ${solo.fail}${solo.fail ? ` · ${solo.caidos.join(' | ')}` : ' (el suelo de 8 no depende de ella)'}`);
  } else {
    console.log('COTEJO: CIEGO — no hay llamadas ajenas bastantes para bajar a 7 sin tocar el reintento');
    ciegas += 1;
  }
  const tras = llamadoresDeLaPuerta(enEspejo('src'));
  console.log(`espejo restaurado tras el cotejo: ${tras.length === sitios.length && sha(enEspejo(REINTENTO)) === antes.reintento ? 'sí' : 'NO'}`);

  // ── (1b) y (2) LAS MUTACIONES ─────────────────────────────────────────────────────────────────
  console.log(`\nPOBLACION=${MUTACIONES.length} mutaciones declaradas`);
  for (const m of MUTACIONES) {
    const cambios = [[m.en, m.ancla, m.cambio], ...(m.tambien ? [m.tambien] : [])];
    const originales = cambios.map(([r]) => fs.readFileSync(enEspejo(r), 'utf8'));
    const veces = cambios.map(([, ancla], i) => originales[i].split(ancla).length - 1);
    if (veces.some((v) => v !== 1)) { console.log(`CIEGA    · ${m.id} · ${m.que} · el ancla casa ${veces.join('/')} veces`); ciegas += 1; continue; }
    cambios.forEach(([r, ancla, cambio], i) => fs.writeFileSync(enEspejo(r), originales[i].replace(ancla, cambio)));
    const r = correr(m.test);
    cambios.forEach(([r2], i) => fs.writeFileSync(enEspejo(r2), originales[i]));
    let veredicto;
    if (!Number.isFinite(r.tests)) veredicto = 'CIEGA   ';
    else if (m.espera === null) veredicto = r.fail === 0 ? 'ACIERTA ' : 'SORPRESA';
    else {
      const cae = r.caidos.some((c) => c.includes(m.espera));
      const nombra = !m.nombra || r.salida.includes(m.nombra);
      const solo = !m.soloEse || r.fail === 1;
      veredicto = cae && nombra && solo ? 'ACIERTA ' : 'SORPRESA';
    }
    if (veredicto === 'SORPRESA') sorpresas += 1;
    if (veredicto === 'CIEGA   ') ciegas += 1;
    const visto = r.fail === 0 ? 'MUDA: no cae nada' : `caen ${r.fail}: ${r.caidos.join(' | ')}`;
    console.log(`${veredicto} · ${m.id} · ${m.que}\n           esperaba: ${m.espera === null ? 'MUDA' : `que caiga «${m.espera}»${m.nombra ? ` nombrando «${m.nombra}»` : ''}${m.soloEse ? ', y sólo ése' : ''}`}\n           visto en ${path.basename(m.test)} (${r.tests} casos): ${visto}`);
  }
} finally {
  fs.rmSync(ESPEJO, { recursive: true, force: true });
}
// ── la post-condición: el árbol de verdad no se ha movido ───────────────────────────────────────
const despues = { sellado: sha(enRaiz(SELLADO)), reintento: sha(enRaiz(REINTENTO)), lib: sha(enRaiz(LIB)), g: sha(enRaiz(G)), p: sha(enRaiz(P)), t: sha(enRaiz(T)) };
const movidos = Object.keys(antes).filter((k) => antes[k] !== despues[k]);
console.log(`\nÁRBOL DE VERDAD: ${Object.keys(antes).length} ficheros con sha256 antes y después · movidos ${movidos.length}${movidos.length ? `: ${movidos.join(', ')}` : ''} · espejo borrado: ${fs.existsSync(ESPEJO) ? 'NO' : 'sí'}`);
console.log(`sorpresas ${sorpresas} · ciegas ${ciegas}`);
const mal = sorpresas + ciegas + movidos.length;
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
