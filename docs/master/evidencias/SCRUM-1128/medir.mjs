// medir.mjs — SCRUM-1128 · las tres comprobaciones del enunciado, POR EFECTO, sobre el árbol REAL.
//
// Uso:  node medir.mjs <BASE>
//   <BASE>/hoy            ← `git archive origin/main` de src/, prisma/schema.prisma, las 4 páginas
//                            públicas, el guard y sus tres tests. NO se modifica: es el estado de hoy.
//   <BASE>/guard-viejo.mjs ← el guard ANTES de SCRUM-1128 (`git show 32da2be5^:scripts/_guard-…`).
//   <BASE>/node_modules/typescript ← copia, para que el guard resuelva `typescript` fuera del repo.
//   <BASE>/sha-main.txt   ← `git rev-parse origin/main` en el momento de sacar la copia.
// La receta que monta <BASE> (cinco órdenes) está en docs/master/SCRUM-1128.md, §1128b «Reproducir».
//
// Cada escenario es una COPIA de <BASE>/hoy con una modificación declarada. Nada se escribe en el
// repositorio: los flags y el camino de emisión de verdad no se tocan (límites del ticket).
// Sale 0 si las tres comprobaciones dan lo esperado, 1 si alguna no, 2 si el instrumento está ciego.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BASE = path.resolve(process.argv[2] ?? '');
const HOY = path.join(BASE, 'hoy');
if (!fs.existsSync(path.join(HOY, 'src', 'core', 'flags.ts'))) {
  console.log('CIEGO: no existe <BASE>/hoy/src/core/flags.ts'); process.exit(2);
}
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const nuevo = await import(pathToFileURL(path.join(HOY, 'scripts', '_guard-afirmacion-fiscal.mjs')).href);
const viejo = await import(pathToFileURL(path.join(BASE, 'guard-viejo.mjs')).href);

// Las frases: las tres que nombra el ticket («ya está construida», «cumple», «conforme/validado por la AEAT»).
const FRASES = [
  ['B', 'La facturación VeriFactu ya está construida.'],
  ['C', 'YaQu ya cumple con VeriFactu.'],
  ['C', 'Nuestra facturación es conforme a la AEAT.'],
  ['C', 'Facturación validada por la AEAT.'],
];
// Control de que «deja de bloquear» no es «se ha apagado»: la familia A no caduca nunca.
const FRASE_A = 'Facturación VeriFactu en certificación.';

const veredicto = (guard, construido) => FRASES.map(([fam, f]) => {
  const r = guard.comprobar({ paginas: [{ ruta: 'x', html: `<p>${f}</p>` }], envioConstruido: construido });
  const familia = /\[familia ([ABC])\]/.exec(r.salida)?.[1] ?? '-';
  return { frase: f, esperada: fam, bloquea: !r.ok, familia };
});

const LLAMANTE = `// Llamante SIMULADO (SCRUM-1128, sólo en la copia de medición): el enganche que D2 dejó sin hacer.
import { enviarSobre } from '../../modules/fiscal/verifactu/sif.client';
import { procesarObligado } from '../../modules/fiscal/verifactu/sif.procesador';

export async function remitirPendientes(nif: string, params: any) {
  return procesarObligado(nif, async (p) => enviarSobre({ ...params, cuerpoSoap: p.cuerpoSoap }) as any);
}
`;
const POR_REFERENCIA = `import { enviarSobre } from '../../modules/fiscal/verifactu/sif.client';
import { procesarObligado } from '../../modules/fiscal/verifactu/sif.procesador';
export const remitirPendientes = (nif: string) => procesarObligado(nif, enviarSobre as any);
`;

const encenderFlag = (r) => {
  const f = path.join(r, 'src', 'core', 'flags.ts');
  const antes = fs.readFileSync(f, 'utf8');
  const despues = antes.replace(/^(\s*SIF_ENABLED:\s*)false(,)/m, '$1true$2');
  if (despues === antes) throw new Error('CIEGO: no se pudo encender SIF_ENABLED en la copia');
  fs.writeFileSync(f, despues);
};
const quitarCola = (r) => {
  const f = path.join(r, 'prisma', 'schema.prisma');
  const antes = fs.readFileSync(f, 'utf8');
  const despues = antes.replace(/^model VfSubmission\b/m, 'model VfSubmissionRetirada');
  if (despues === antes) throw new Error('CIEGO: no se pudo retirar model VfSubmission en la copia');
  fs.writeFileSync(f, despues);
};
const poner = (rel, txt) => (r) => {
  fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true });
  fs.writeFileSync(path.join(r, rel), txt);
};
const RUTA_LLAMANTE = 'src/core/cron/remisionSif.ts';

const ESCENARIOS = [
  { id: 'H',  que: 'HOY: origin/main sin tocar (cola en el esquema, sin llamante, flag OFF)', cambios: [], espera: false },
  { id: 'H0', que: 'contrafactual: hoy SIN la fila VfSubmission', cambios: [quitarCola], espera: false },
  { id: 'P',  que: 'POSITIVO: llamante simulado en src/core/cron + SIF_ENABLED ON por defecto', cambios: [poner(RUTA_LLAMANTE, LLAMANTE), encenderFlag], espera: true },
  { id: 'P1', que: 'sólo el llamante (flag OFF)', cambios: [poner(RUTA_LLAMANTE, LLAMANTE)], espera: false },
  { id: 'P2', que: 'sólo el flag ON (sin llamante)', cambios: [encenderFlag], espera: false },
  { id: 'X1', que: 'AVISO: el mismo llamante pero en verifactu/sif.cron.ts + flag ON', cambios: [poner('src/modules/fiscal/verifactu/sif.cron.ts', LLAMANTE.replace(/\.\.\/\.\.\/modules\/fiscal\/verifactu\//g, './')), encenderFlag], espera: null },
  { id: 'X2', que: 'AVISO: enviarSobre pasado POR REFERENCIA (sin llamarlo) + flag ON', cambios: [poner(RUTA_LLAMANTE, POR_REFERENCIA), encenderFlag], espera: null },
  // El guard de la copia se sustituye por el de ANTES de SCRUM-1128: lo que mide esta fila son los
  // tests corridos DENTRO de la copia (importan `../scripts/_guard-…`), no las columnas del guard nuevo.
  { id: 'M',  que: 'MUTACIÓN: hoy, con el guard VIEJO puesto en su sitio (¿lo caza scrum537?)', cambios: [(r) => fs.copyFileSync(path.join(BASE, 'guard-viejo.mjs'), path.join(r, 'scripts', '_guard-afirmacion-fiscal.mjs'))], espera: null },
];

/**
 * Quién IMPORTA el cliente en `src/`: la MISMA expresión que usa
 * `tests/scrum1127-sif-client.test.mjs` («nadie en src/ llama al cliente»), replicada aquí porque
 * ese fichero exige `dist/` y la copia no lo tiene. Hoy ese test exige exactamente [sif.cola.ts].
 */
function importadoresDelCliente(raiz) {
  const fuera = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(p); continue; }
      if (!e.name.endsWith('.ts')) continue;
      const fuente = fs.readFileSync(p, 'utf8');
      if (/from\s+['"][^'"]*sif\.client['"]|require\(\s*['"][^'"]*sif\.client['"]/.test(fuente)) fuera.push(path.relative(raiz, p).replace(/\\/g, '/'));
    }
  };
  recorrer(path.join(raiz, 'src'));
  return fuera.sort();
}

/** Corre un test dentro de la copia, con entorno construido a mano (A21), y lee su TAP de fichero. */
function correr(raiz, fichero) {
  const tap = path.join(raiz, `${path.basename(fichero)}.tap`);
  fs.rmSync(tap, { force: true });
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${tap}`, fichero], { cwd: raiz, env, encoding: 'utf8' });
  const t = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const num = (k) => { const m = new RegExp(`^# ${k} (\\d+)`, 'm').exec(t); return m ? Number(m[1]) : null; };
  const caidos = [...t.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { exit: r.status, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), caidos };
}

const out = { base: BASE, main: fs.readFileSync(path.join(BASE, 'sha-main.txt'), 'utf8').trim(),
  guard_sha256: sha(path.join(HOY, 'scripts', '_guard-afirmacion-fiscal.mjs')), escenarios: [] };
let mal = 0; let ciego = 0;

for (const e of ESCENARIOS) {
  const r = path.join(BASE, `esc-${e.id}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.cpSync(HOY, r, { recursive: true });
  for (const c of e.cambios) c(r);

  const h = nuevo.envioConstruido(r);
  const v = viejo.envioConstruido(r);
  const disco = nuevo.comprobarEnDisco(r);
  const fila = {
    id: e.id, que: e.que,
    poblacion: { ficherosTs: h.ficherosLeidos, vistosAeat: h.vistosAeat, esquemaLeido: h.esquemaLeido, paginas: disco.paginasLeidas, caracteres: disco.caracteres },
    piezas: h.señales.map((s) => `${s.tipo}@${s.donde}`),
    llamantes: h.llamantes, flag: h.flag,
    importadores_del_cliente: importadoresDelCliente(r),
    construido_nuevo: h.construido, construido_viejo: v.construido,
    frases_nuevo: veredicto(nuevo, h.construido),
    frases_viejo: veredicto(viejo, v.construido),
    familiaA_bloquea: !nuevo.comprobar({ paginas: [{ ruta: 'x', html: `<p>${FRASE_A}</p>` }], envioConstruido: h.construido }).ok,
    landing: { ok: disco.ok, primera: disco.salida.split('\n')[0] },
    scrum537: correr(r, 'tests/scrum537-afirmacion-falsa.test.mjs'),
    scrum1128: correr(r, 'tests/scrum1128-envio-construido.test.mjs'),
  };
  // Con SIF_ENABLED=true en el ENTORNO del proceso que mide (sólo aquí, se restaura).
  const antes = process.env.SIF_ENABLED; process.env.SIF_ENABLED = 'true';
  fila.construido_con_env_on = nuevo.envioConstruido(r).construido;
  if (antes === undefined) delete process.env.SIF_ENABLED; else process.env.SIF_ENABLED = antes;

  if (!(h.ficherosLeidos > 100 && h.vistosAeat >= 3 && h.esquemaLeido && h.flag.leido && disco.paginasLeidas === 4)) ciego += 1;
  if (fila.scrum537.tests === null || fila.scrum1128.tests === null) ciego += 1;
  if (e.espera !== null && h.construido !== e.espera) mal += 1;
  out.escenarios.push(fila);
}

const E = Object.fromEntries(out.escenarios.map((x) => [x.id, x]));
const todas = (x, b) => x.frases_nuevo.every((f) => f.bloquea === b);
out.comprobaciones = {
  '1_hoy_la_cola_se_VE': E.H.piezas.includes('cola@prisma/schema.prisma'),
  '1_hoy_sin_llamante_y_flag_leido_OFF': E.H.llamantes.length === 0 && E.H.flag.leido && !E.H.flag.on,
  '1_hoy_SIGUE_bloqueando_las_4_frases': !E.H.construido_nuevo && todas(E.H, true),
  '1_el_criterio_VIEJO_hoy_las_dejaria_pasar': E.H.construido_viejo === true && E.H.frases_viejo.every((f) => !f.bloquea),
  '1_sin_la_fila_el_viejo_bloqueaba (la fila es lo que abria)': E.H0.construido_viejo === false && E.H0.frases_viejo.every((f) => f.bloquea),
  '2_positivo_DEJA_de_bloquear_las_4': E.P.construido_nuevo === true && todas(E.P, false),
  '2_positivo_la_familia_A_sigue_bloqueando': E.P.familiaA_bloquea === true,
  '2_una_sola_condicion_no_basta': !E.P1.construido_nuevo && !E.P2.construido_nuevo && todas(E.P1, true) && todas(E.P2, true),
  '3_scrum537_VERDE_hoy': E.H.scrum537.exit === 0 && E.H.scrum537.fail === 0 && E.H.scrum537.tests > 0,
  '3_scrum537_CAE_en_el_positivo': E.P.scrum537.exit !== 0 && E.P.scrum537.caidos.some((n) => n.includes('el hecho se DERIVA del codigo')),
  '3_scrum537_no_cae_con_una_sola_condicion': E.P1.scrum537.fail === 0 && E.P2.scrum537.fail === 0,
  'M_volver_al_criterio_viejo_HOY_tumba_scrum537_sobre_el_arbol_real': E.M.scrum537.exit !== 0 && E.M.scrum537.caidos.some((n) => n.includes('el hecho se DERIVA del codigo')),
  'X_hoy_scrum1127_ve_exactamente_la_cola_como_importador': JSON.stringify(E.H.importadores_del_cliente) === JSON.stringify(['src/modules/fiscal/verifactu/sif.cola.ts']),
  'X_los_dos_enganches_que_el_guard_NO_cuenta_los_delata_scrum1127': E.X1.importadores_del_cliente.length === 2 && E.X2.importadores_del_cliente.length === 2,
};
for (const [k, v] of Object.entries(out.comprobaciones)) if (v !== true) mal += 1;

fs.writeFileSync(path.join(BASE, 'medicion.json'), JSON.stringify(out, null, 2));

console.log(`POBLACION · origin/main ${out.main} · guard sha256 ${out.guard_sha256.slice(0, 16)} · ${ESCENARIOS.length} escenarios`);
for (const x of out.escenarios) {
  console.log(`\n[${x.id}] ${x.que}`);
  console.log(`   poblacion: ${x.poblacion.ficherosTs} .ts · ${x.poblacion.vistosAeat} menciones AEAT · esquema ${x.poblacion.esquemaLeido ? 'leido' : 'NO'} · ${x.poblacion.paginas} paginas (${x.poblacion.caracteres} car.)`);
  console.log(`   piezas: ${JSON.stringify(x.piezas)} · llamantes: ${JSON.stringify(x.llamantes)} · flag: leido=${x.flag.leido} on=${x.flag.on}`);
  console.log(`   importan sif.client (expresion de scrum1127): ${JSON.stringify(x.importadores_del_cliente)}`);
  console.log(`   construido · NUEVO=${x.construido_nuevo} · VIEJO=${x.construido_viejo} · con SIF_ENABLED=true en el entorno=${x.construido_con_env_on}`);
  console.log(`   frases (nuevo): ${x.frases_nuevo.map((f) => `${f.bloquea ? 'BLOQUEA' : 'pasa'}[${f.familia}]`).join(' ')} · familia A: ${x.familiaA_bloquea ? 'BLOQUEA' : 'pasa'}`);
  console.log(`   frases (viejo): ${x.frases_viejo.map((f) => `${f.bloquea ? 'BLOQUEA' : 'pasa'}[${f.familia}]`).join(' ')}`);
  console.log(`   landing real: ok=${x.landing.ok} · «${x.landing.primera}»`);
  for (const t of ['scrum537', 'scrum1128']) {
    const s = x[t];
    console.log(`   ${t}: exit=${s.exit} · tests ${s.tests} · pass ${s.pass} · fail ${s.fail} · skipped ${s.skipped}${s.caidos.length ? `\n      caen: ${s.caidos.join(' | ')}` : ''}`);
  }
}
console.log('\nCOMPROBACIONES');
for (const [k, v] of Object.entries(out.comprobaciones)) console.log(`   ${v === true ? 'SI ' : 'NO '} ${k}`);
console.log(`\nciegos=${ciego} · no-esperados=${mal}`);
console.log(`EXIT=${ciego ? 2 : mal ? 1 : 0}`);
process.exit(ciego ? 2 : mal ? 1 : 0);
