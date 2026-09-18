// docs/master/evidencias/scrum927b/el-que-decide.mjs — SCRUM-927b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE · ¿de verdad cambia algo convertir el aviso en un `assert`?
//
// Se le mete al conjunto congelado un par que NO cita sin testigo en ningún sitio — o sea, un
// MUERTO: una línea que perdona una deuda que ya no existe. Es exactamente lo que el trinquete
// dice vigilar.
//
//   ① ANTES (la forma vieja, con `console.log`) ... la tanda SIGUE VERDE. El aviso se imprime y
//      se pierde entre miles de líneas. **Ése era el defecto.**
//   ② DESPUÉS (con el `assert`) .................. la tanda CAE, y el mensaje NOMBRA el par.
//
// Y los dos sentidos, que sin el segundo esto no vale nada:
//   · propiedad ROTA → cae        · propiedad INTACTA → pasa
//
// La mutación se comprueba que ENTRÓ y que entró EXACTAMENTE UNA VEZ: un `replace` que no
// encuentra su texto no falla, deja el fichero igual, y entonces el «sigue verde» del ① sería el
// de un árbol intacto — que es justo lo que este banco tiene que distinguir.
//
// Cada fichero se restaura byte a byte y se verifica por SHA-256. Si algo revienta a mitad, el
// `finally` restaura igual.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CONGELADO = 'scripts/_anclas-sin-testigo.congelado.mjs';
const TEST = 'tests/scrum525d-anclas-que-apuntan.test.mjs';
// Un par que no cita en ninguna parte: en cuanto entre en la lista, es un MUERTO.
const PAR_MUERTO = 'docs/legal/NO-EXISTE-927B.md # fichero-inventado-927b.ts';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const di = (s = '') => console.log(s);

// El banco se limpia solo y SIN usar el helper de la casa: aquí no se muta nada suyo, pero la
// lección de SCRUM-864c vale igual — un banco que no se limpia a sí mismo es el chiste del ticket.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum927b-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ya no está */ } });

/** Sustituye literales en un fichero, exigiendo que cada uno entre EXACTAMENTE una vez. */
function mutar(rel, ...pares) {
  const abs = path.join(RAIZ, rel);
  const original = fs.readFileSync(abs);
  const antes = sha(original);
  let texto = original.toString('utf8');
  for (const [de, a] of pares) {
    const veces = texto.split(de).length - 1;
    if (veces !== 1) {
      throw new Error(`🔴 LA MUTACIÓN NO PUEDE ENTRAR en ${rel}: el texto aparece ${veces} veces, y `
        + 'se esperaba exactamente 1.\n   Buscaba: ' + JSON.stringify(de.slice(0, 90))
        + '\n   Sin esto, un veredicto de este banco sería el de un árbol que no cambió.');
    }
    texto = texto.replace(de, a);
  }
  fs.writeFileSync(abs, texto);
  return {
    entro: sha(fs.readFileSync(abs)) !== antes,
    restaurar: () => { fs.writeFileSync(abs, original); return sha(fs.readFileSync(abs)) === antes; },
  };
}

/** Corre el test de verdad y dice si pasó y qué escribió. */
function corre() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', path.join(RAIZ, TEST)],
    { encoding: 'utf8', cwd: RAIZ });
  return { paso: r.status === 0, salida: (r.stdout || '') + (r.stderr || '') };
}

const METER_MUERTO = [
  'export const PARES_SIN_TESTIGO_CONGELADOS = new Set([',
  "export const PARES_SIN_TESTIGO_CONGELADOS = new Set([\n  '" + PAR_MUERTO + "',",
];

let fallos = 0;

// ═══ ① ANTES · la forma vieja, con `console.log` ═════════════════════════════════════════════
di('═══ ① ANTES · el conjunto encoge y la tanda NO se entera (forma vieja: console.log) ═══');
{
  // Se devuelve el test a su forma anterior Y se le mete el muerto, en la misma mutación.
  const m = mutar(TEST,
    ['  assert.deepEqual(muertos, [],', '  if (muertos.length) console.log(`    · aviso: ENCOGIÓ en ${muertos.length}`); const NO_USADO = ('],
  );
  const m2 = mutar(CONGELADO, METER_MUERTO);
  di('   ¿ENTRÓ la mutación? ' + (m.entro && m2.entro ? 'sí, las dos (contenido distinto)' : '🔴 NO'));
  try {
    const r = corre();
    di('   ¿el conjunto tiene un MUERTO dentro? sí (' + PAR_MUERTO + ')');
    di('   ¿la tanda se entera? ' + (r.paso ? '🔴 NO — sigue VERDE con la deuda muerta dentro' : 'sí'));
    if (!r.paso) { di('   🔴 el banco no reproduce el estado anterior: revisar.'); fallos++; }
  } finally {
    di('   restaurado byte a byte: ' + (m2.restaurar() && m.restaurar() ? 'sí' : '🔴 NO'));
  }
}

// ═══ ② DESPUÉS · con el `assert` ═════════════════════════════════════════════════════════════
di('');
di('═══ ② DESPUÉS · el mismo muerto, con el `assert` puesto ═══');
{
  const m = mutar(CONGELADO, METER_MUERTO);
  di('   ¿ENTRÓ la mutación? ' + (m.entro ? 'sí (contenido distinto)' : '🔴 NO'));
  try {
    const r = corre();
    const nombra = r.salida.includes(PAR_MUERTO);
    di('   ¿la tanda CAE? ' + (r.paso ? '🔴 NO, sigue verde' : 'sí'));
    di('   ¿el mensaje NOMBRA el elemento? ' + (nombra ? 'sí' : '🔴 NO'));
    const cae = !r.paso && nombra;
    di('   VEREDICTO: ' + (cae
      ? '✅ CIERRA — lo que ayer se imprimía, hoy se exige, y dice cuál es.'
      : '🔴 NO CIERRA.'));
    if (!cae) fallos++;
  } finally {
    di('   restaurado byte a byte: ' + (m.restaurar() ? 'sí' : '🔴 NO'));
  }
}

// ═══ ③ EL OTRO SENTIDO · propiedad intacta → pasa ════════════════════════════════════════════
di('');
di('═══ ③ POST-CONDICIÓN · con el árbol intacto, sigue verde ═══');
{
  const r = corre();
  di('   la tanda pasa: ' + (r.paso ? 'sí ✅' : '🔴 NO — el árbol no se restauró bien'));
  if (!r.paso) fallos++;
}
process.exit(fallos ? 1 : 0);
