// tests/scrum411-exports-inalcanzables.test.mjs — SCRUM-411 · el trinquete de lo inalcanzable.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO CORRE EN LA SUITE Y NO ES UN INFORME
//
// El censo vivía en un scratchpad. **Un censo que no corre es una foto, no un mecanismo**: no
// impide que el número crezca. Aquí el número tiene tope y solo puede BAJAR.
//
// Lo que hay detrás: un módulo de dominio sin llamadores pasa todos los tests, entra verde y desde
// fuera es indistinguible de una función entregada — así se cerraron en falso `cambiarFlagFiscal`
// (SCRUM-218) y `borrarMerchant` (SCRUM-244, RGPD-1), los dos con su ticket CERRADO.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analizar, exportsDe, nombresImportados } from './_alcance-dominio.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const R = analizar(RAIZ);

/**
 * EL TRINQUETE. Medido el 9-ago-2026 contra `origin/main` = 8037a7a.
 *
 * ⚠️ SOLO PUEDE BAJAR. Sube = alguien ha entregado dominio nuevo que nadie puede alcanzar, y ese
 * es el caso que este fichero existe para que no vuelva a descubrirse por casualidad.
 *
 * **8 → 7 · 10-ago-2026 · SCRUM-423.** Sale `src/modules/jobs/domain/entregaPendiente.ts`, el motor
 * de C6 (SCRUM-305): construido, probado y en verde, y lo importaba ÚNICAMENTE su propio test —
 * ningún profesional lo había visto nunca. Ya está cableado a «Qué falta para cobrar» a través de
 * `entregaDelTrabajo.ts`, que nace alcanzable desde `jobs.routes.ts`.
 *
 * 🔴 Y fue ESTE número el que lo destapó, no una revisión a ojo: es lo que convirtió «C6 está
 * Finalizada» en «C6 tiene un cierre en falso». Por eso baja en el mismo commit que lo arregla —
 * un tope con holgura habría dejado el hallazgo sin constancia.
 *
 * **7 → 8 · 10-ago-2026 · SCRUM-458. SUBE, y eso es un hallazgo, no un trámite.** Entra
 * `src/modules/jobs/domain/precarga.service.ts`: el paquete de precarga de H1 fase 2, construido y
 * probado, que **nadie puede llamar todavía** porque el encargo dice literalmente «esta fase no
 * tiene superficie» — el consumidor es la fase siguiente.
 *
 * 🔴 SE SUBE CON SU FECHA Y SU MOTIVO EN VEZ DE CABLEARLO A LA FUERZA, y el número queda como lo
 * que es: **la constancia de que hay dominio entregado que ningún profesional puede alcanzar**. Si
 * la fase siguiente no llega, esto sigue aquí acusando. Lo que este trinquete impide no es que el
 * número suba: es que suba **sin que nadie se entere**, que es como se descubrió el cierre en falso
 * de C6. **Baja a 7 el commit que le ponga consumidor.**
 *
 * **8 → 7 · 10-ago-2026 · SCRUM-460.** Ése es este commit: `precarga.service.ts` ya se alcanza
 * desde `GET /admin/precarga` (`precargaAdmin.routes.ts`, montado en `app.ts`). El número estuvo
 * en 8 exactamente lo que duró la deuda, que es para lo que sirve.
 */
const MODULOS_DOMINIO_INALCANZABLES_MAX = 7;

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-411 · SUELO: hay módulos de dominio que auditar', () => {
  assert.ok(R.modulosDominio >= 50,
    `🔴 solo se han encontrado ${R.modulosDominio} módulos de dominio. «Ningún inalcanzable» y «no ` +
    'supe mirar» dan el mismo verde: si el detector se rompió, arréglalo antes de creerte el tope.');
  assert.ok(R.alcanzables >= 100,
    `🔴 solo ${R.alcanzables} ficheros alcanzables desde las entradas: el grafo no se está ` +
    'recorriendo, y entonces TODO saldría inalcanzable.');
});

test('SCRUM-411 · SUELO: sin árbol que mirar, el análisis lo DICE en vez de reventar', () => {
  // Probado, no prometido. Y aprendido fallando: la primera versión lanzaba `ENOENT` aquí, y un
  // analizador que revienta dentro de la suite hace caer un test con un error que **no nombra el
  // problema real**. Ahora devuelve ceros MARCADOS (`sinSrc`), y es el suelo de arriba —que exige
  // ≥50 módulos— quien convierte ese cero en rojo.
  const vacio = analizar(path.join(RAIZ, 'tests'));
  assert.equal(vacio.sinSrc, true, '🔴 el análisis de un árbol sin `src/` no se declara como tal.');
  assert.equal(vacio.modulosDominio, 0);
  assert.equal(vacio.inalcanzables.length, 0,
    '🔴 sin módulos de dominio el análisis devuelve inalcanzables: está midiendo otra cosa.');
  // Y la consecuencia, que es lo que de verdad protege: ese cero NO pasa el suelo real.
  assert.ok(!(vacio.modulosDominio >= 50),
    '🔴 un árbol vacío pasaría el suelo: entonces el suelo no es un suelo.');
});

// ── CONTROLES ────────────────────────────────────────────────────────────────────────────────

const esInalcanzable = (frag) => R.inalcanzables.some((m) => m.modulo.includes(frag));
const huerfanosDe = (frag) => (R.modulos.find((m) => m.modulo.includes(frag))?.huerfanos ?? []);

test('SCRUM-411 · CONTROL POSITIVO: los cuatro conocidos salen', () => {
  for (const frag of ['retencionIrpf', 'recargoEquivalencia', 'criterioCaja', 'flagFiscal.service']) {
    assert.ok(esInalcanzable(frag),
      `🔴 «${frag}» NO sale como inalcanzable, y se midió que lo es. El detector no mide lo que dice medir.`);
  }
});

test('SCRUM-411 · CONTROL NEGATIVO: invoiceNumber.service NO sale', () => {
  assert.ok(!esInalcanzable('invoiceNumber.service'),
    '🔴 el camino de emisión sale como inalcanzable: el detector marca de más y su lista deja de ' +
    'poder atenderse.');
});

test('SCRUM-411 · 🔴 EL CONTROL QUE ME CORRIGIÓ: un módulo vivo por una CONSTANTE esconde una función muerta', () => {
  // La primera versión de este censo daba `borradoMerchant.ts` por vivo porque `barridoDemo.ts`
  // importa de él — pero importa DOS CONSTANTES, y `borrarMerchant` no lo importa nadie. Si este
  // test desaparece, el censo vuelve a mentir exactamente por ahí.
  const huerfanos = huerfanosDe('borradoMerchant');
  assert.ok(huerfanos.includes('borrarMerchant'),
    '🔴 `borrarMerchant` (SCRUM-244, RGPD-1) no sale como huérfano. Su fichero está VIVO porque ' +
    '`barridoDemo` le importa dos constantes; la función no la alcanza nadie.\n\n' +
    '  LA ALCANZABILIDAD POR FICHERO MIENTE: el veredicto es por EXPORT y por ALCANCE, nunca por ' +
    'módulo.');
  // Y la otra cara: ese mismo módulo NO puede salir como inalcanzable entero, porque sí tiene
  // exports vivos. Sin esto, «todo huérfano» daría verde igual.
  assert.ok(!esInalcanzable('borradoMerchant'),
    '🔴 `borradoMerchant.ts` sale como módulo inalcanzable, y dos de sus constantes SÍ se usan.');
});

test('SCRUM-411 · el analizador distingue export de TIPO (no cuenta) de export con valor', () => {
  const codigo = `
    export type Cosa = { a: number };
    export interface Otra { b: string }
    export const VALOR = 1;
    export function hacer() { return 2; }
  `;
  const exps = exportsDe('sintetico.ts', codigo);
  assert.deepEqual(exps.sort(), ['VALOR', 'hacer'],
    '🔴 los tipos e interfaces se están contando como exports: nunca tendrán llamador en tiempo de ' +
    'ejecución y el censo saldría inflado con ruido que no se puede atender.');
});

test('SCRUM-411 · un `import * as` da el módulo por vivo entero, y se declara', () => {
  // No se puede saber qué se usa de un namespace, así que se prefiere NO acusar. Queda dicho
  // porque es un punto ciego: un módulo importado así podría estar muerto y no saldría.
  const nombres = nombresImportados('sintetico.ts', `import * as x from './y'; x.hacer();`);
  assert.ok(nombres.has('*'), '🔴 el analizador no reconoce `import * as`: daría por muerto lo que se usa por el namespace.');
});

// ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-411 · los módulos de dominio inalcanzables NO crecen', (t) => {
  const lista = R.inalcanzables.map((m) => m.modulo).sort();
  t.diagnostic(`inalcanzables: ${lista.length}/${R.modulosDominio} · exports huérfanos en módulos vivos: ${R.exportsHuerfanosEnModulosVivos}`);

  assert.ok(lista.length <= MODULOS_DOMINIO_INALCANZABLES_MAX,
    `🔴 HAY DOMINIO NUEVO QUE NADIE PUEDE ALCANZAR: ${lista.length} módulos y el tope es ` +
    `${MODULOS_DOMINIO_INALCANZABLES_MAX}.\n\n   ${lista.join('\n   ')}\n\n` +
    '  Un módulo de dominio sin llamadores pasa todos los tests y entra verde, así que su ticket se\n' +
    '  cierra y el cableado que falta deja de estar en ninguna lista. Si es una pieza a medio\n' +
    '  construir, dilo en su entrada; si es código muerto, retíralo con su motivo. Lo que no vale\n' +
    '  es que entre en silencio.');

  assert.equal(lista.length, MODULOS_DOMINIO_INALCANZABLES_MAX,
    `🔴 el tope (${MODULOS_DOMINIO_INALCANZABLES_MAX}) ya no coincide con la realidad ` +
    `(${lista.length}). Si has cableado uno, BAJA el tope en el mismo commit: así queda constancia ` +
    'de la mejora — un tope con holgura es el descuadre silencioso.');
});
