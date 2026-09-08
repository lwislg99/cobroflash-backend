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
import { censar, autoprueba, clave } from './_huerfanos-en-modulos-vivos.mjs';
import { CATEGORIAS, DECLARADOS, paresDeclarados } from './_huerfanos-declarados.mjs';
import {
  censarAlcance, quienLoImporta, llamadasEnTests, autoprueba as autopruebaAlcance,
  ALCANZABLE, NO_ALCANZABLE, NO_SE_PUDO_DETERMINAR,
} from './_alcance-desde-entradas.mjs';
import { clasificador, consejoPara } from './_export-que-sobra.mjs';

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
 *
 * **7 → 8 · 11-ago-2026 · SCRUM-359 (H4).** `src/modules/jobs/domain/ventanaDeFirma.ts`: la
 * ventana verificable de los tres relojes, construida y probada con 16 tests, que **nadie puede
 * llamar todavía** por dos gates que no son míos. ① Guardar dos de los tres relojes necesita
 * columnas nuevas y `prisma/schema.prisma` es del fundador — el diff está preparado en
 * `docs/master/SCRUM-359.md` §4. ② Cablearlo obliga a añadir una escritura al endpoint que
 * SELLA, y en el diff eso no se distingue de tocar el sellado (regla 38): va con GO explícito.
 *
 * Cablearlo a la fuerza para que este número no subiera habría sido justo lo que la cabecera de
 * arriba prohíbe, y además saltándose un STOP. **Baja a 7 el commit que le ponga consumidor**, que
 * es el paso 3 de `docs/master/SCRUM-359.md` §5.
 */
// SCRUM-294 (fase B): BAJA de 8 a 7. `criterioCaja` deja de ser inalcanzable -- lo consume
// `devengoPorCaja.ts`, que decide que fecha devenga, y ese lo consume el libro de registro.
// El trinquete solo baja: si alguien cablea otro, baja otra vez en el mismo commit.
//
// 🔴 7 → 8 · 12-ago-2026 · SCRUM-500. SUBIDA A CONCIENCIA, y es la tercera del mismo bloque
// fiscal: `src/modules/invoicing/domain/suplidos.ts` se une a `retencionIrpf.ts` (A2) y
// `recargoEquivalencia.ts` (A3) — las tres construidas, probadas y sin llamador POR EL MISMO
// GATE, que no es deuda: cablear cualquiera de ellas cambia la base o el total que se SELLAN, y
// eso es camino de emisión (regla 38), con GO explícito del fundador y el diff delante.
//
// ⚠️ Y este número subiendo dice algo que conviene no perder: **el bloque fiscal A2/A3 lleva tres
// piezas esperando el mismo permiso**. Si en vez de subirlo se hubiera cableado a la fuerza para
// no tocar el trinquete, se habría saltado un STOP para que un contador quedara bonito — que es
// exactamente lo que la cabecera de arriba prohíbe.
//
// **Baja a 7 el commit que le ponga consumidor**, y ese commit es el cable de A2-c.
//
// ✅ 8 → 7 · 13-ago-2026 · SCRUM-293 (③a). ÉSTE es ese commit, y baja por la pieza que lo dejó
// dicho: sale `src/modules/invoicing/domain/retencionIrpf.ts`. Lo alcanza `src/app.ts`, que importa
// `tiposDeRetencionOrdenados()` para mandarle a la pantalla las opciones del CUBO.
//
// ⚠️ Y baja SIN tocar el camino de emisión, que es lo que hacía falta medir antes de creérselo: el
// cable no cablea `bloqueRetencion` ni `leerTipoRetencion` —los dos que cambiarían lo que se
// SELLA— sino la lista de rótulos que la Configuración necesita para pintar el selector. El STOP de
// la regla 38 sigue exactamente donde estaba; lo que se ha entregado es la pantalla donde el
// profesional DECLARA su tipo, no la aplicación del tipo a una factura.
//
// Quedan 7, y de las tres del bloque fiscal que SCRUM-500 nombró juntas siguen dos esperando el
// mismo GO: `recargoEquivalencia.ts` (A3) y `suplidos.ts`. **Bajan cuando les llegue el suyo.**
// 🔴 7 → 8 · 2-sep-2026 · SCRUM-652 (T3 fase B). SUBIDA A CONCIENCIA, y el motivo es un GATE que
// no es mío: entra `src/modules/jobs/domain/parteTrabajo.ts` —el parte de trabajo, con su sello sin
// precios y sus dos candados— construido y probado con 12 tests, y **sin llamador todavía**.
//
// No es deuda ni olvido: el parte necesita dónde vivir, y eso es `prisma/schema.prisma`, que es del
// fundador. El diff está preparado en `docs/master/SCRUM-652.md`. Cablearlo a la fuerza para que
// este número no subiera habría sido saltarse un STOP para que un contador quedara bonito — que es
// justo lo que prohíbe la cabecera de arriba.
//
// **Baja a 7 el commit que le ponga consumidor**, y ese commit es el que persista el parte.
//
// 🔴 8 → 9 · 2-sep-2026 · SCRUM-655. SEGUNDA SUBIDA DEL MISMO DÍA, y las dos entradas se
// conservan porque son dos módulos distintos esperando dos gates distintos. Entra
// `src/modules/quotes/domain/revision.ts` — la revisión de un presupuesto (el «P2004226.1») y
// cuál está vigente, construido y probado, SIN llamador por el mismo tipo de gate: `Quote` tiene
// `quoteNumber Int?` y NO tiene campo de revisión, y `prisma/schema.prisma` es del fundador. El
// diff va preparado en `docs/master/SCRUM-655.md`.
//
// ⚠️ El número se RECUENTA al mezclar, no se suma: mi entrada decía «7 → 8» antes de mezclar y
// main ya había subido a 8 por su cuenta. Los dos éramos «el octavo»; el censo dice cuántos hay.
//
// **Baja el commit que le ponga consumidor**, y hay DOS pendientes: el parte y la revisión.
// 🔴 9 → 8 · 2-sep-2026 · SCRUM-652 (T3 fase C). BAJA, y baja por el motivo por el que subió:
// **`parteTrabajo.ts` YA TIENE CONSUMIDOR**. Es literalmente lo que decía su propia entrada de
// arriba — «Baja a 7 el commit que le ponga consumidor, y ese commit es el que persista el parte»
// —, y este es ese commit: `src/modules/jobs/app/routes/partes.routes.ts` lo importa y lo ejerce
// (sella al firmar, aplica los dos candados, y sirve al técnico lo que `lineasParaElTecnico` deja
// pasar), montado en `/admin/partes`.
//
// ⚠️ BAJA A 8, NO A 7, y la diferencia no es un descuido: cuando se escribió aquella nota el censo
// estaba en 8 y el parte era el octavo. Después entró `revision.ts` (SCRUM-655) y subió a 9, y
// **ése sigue esperando su gate**. El número se RECUENTA sobre el árbol de hoy; no se resta de
// cabeza sobre una foto vieja. Queda UNO pendiente, y es la revisión del presupuesto.
//
// 🔴 9 → 10 · 2-sep-2026 · SCRUM-683. TERCERA subida por el MISMO gate y con la misma forma: entra
// `src/modules/jobs/domain/parteDictado.ts` —el dictado del técnico convertido en las dos listas
// del parte, con la regla INVERTIDA respecto al motor de presupuestos: una cantidad que el texto
// no dice NO APARECE— construido y probado con 13 tests, y **sin llamador todavía**.
//
// Su consumidor sería la pantalla del parte, que es SCRUM-652 fase C y la está haciendo OTRA
// sesión ahora mismo; el encargo dice explícitamente «solo el DOMINIO, sin pantalla». Cablearlo
// desde aquí sería editar sus ficheros mientras ella los edita, y hacerlo para que este contador
// no subiera es exactamente lo que prohíbe la cabecera de arriba.
//
// **Baja cuando `parteDictado.ts` tenga consumidor**, y ése es el commit que lo cablee a la
// pantalla del parte. Sin cifra a propósito: una frase que nombra el módulo no caduca, y una que
// lleva número sí — es lo que le pasó a la nota de fase B, que prometía un 7 que nunca llegó.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ 2-sep-2026 · LOS DOS BLOQUES DE ARRIBA SON DE ESTE MISMO MERGE, y van en direcciones
// contrarias desde la misma base de 9: SCRUM-683 SUMA `parteDictado.ts` (entra sin llamador) y
// SCRUM-652 fase C RESTA `parteTrabajo.ts` (ya lo tiene). Se conservan los dos porque los dos
// son ciertos y hablan de módulos distintos.
//
// 🔴 EL NÚMERO NO SE ELIGE NI SE SUMA: se RECUENTA. Ejecutado `analizar()` —el mismo que usa
// este fichero— sobre el árbol YA MEZCLADO: **126 módulos de dominio, 288 alcanzables, 9
// inalcanzables**. Nueve, y `parteTrabajo.ts` ya NO está entre ellos.
//
// Coinciden el 10 de un lado y el 8 del otro en dar 9 al mezclarse, pero eso se sabe DESPUÉS de
// contar. Es la tercera vez en el día que este contador se resuelve así, y las dos anteriores lo
// dejaron escrito: «los dos éramos el octavo; el censo dice cuántos hay».
//
// Quedan DOS esperando su gate: `parteDictado.ts` (la pantalla del parte) y `revision.ts` (el
// campo de revisión en el esquema).
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 9 → 8 · 2-sep-2026 · SCRUM-655 fase B. BAJA, y baja por donde su propia entrada decía:
// **`revision.ts` YA TIENE CONSUMIDOR**. El gate que lo tenía parado ERA CIERTO Y HA CAÍDO —
// `prisma/schema.prisma` trae `revision Int @default(0)` desde SCRUM-674, comprobado en el árbol
// y no leído del acta que decía lo contrario—. Lo consume `src/modules/system/quoteAdmin.ts`
// (`getQuoteDetailAdmin`), que es lo que sirve `GET /admin/quotes/:id`: la pantalla del
// presupuesto ya puede contestar QUÉ REVISIONES HAY y CUÁL ESTÁ VIGENTE.
//
// ⚠️ Y el número se RECUENTA, no se resta: ejecutado `analizar()` sobre este árbol da **126
// módulos de dominio, 289 alcanzables, 8 inalcanzables**. Ocho, y `revision.ts` ya no está.
//
// Queda UNO de los que esperaban gate: `parteDictado.ts` (la pantalla del parte, otra sesión).
// ✅ 9 → 8 · 2-sep-2026 · SCRUM-683 (cableado). BAJA, y baja por lo que su propia entrada dejó
// dicho: **`parteDictado.ts` YA TIENE CONSUMIDOR**, y es la pantalla del parte, como estaba
// escrito. El cable: `partes.routes.ts` → `POST /admin/partes/:id/dictado`, que ordena el dictado
// con `suggestLineasDeParte` y devuelve la propuesta SIN escribir nada en el parte.
//
// ⚠️ Y baja RECONTADO, no restado: ejecutado `analizar()` sobre el árbol de hoy → **126 módulos de
// dominio, 289 alcanzables, 8 inalcanzables**. La entrada de arriba prometía «baja cuando
// `parteDictado.ts` tenga consumidor» y NO prometía un número, que es justo por lo que no ha hecho
// falta corregirla: una frase que nombra el módulo no caduca.
//
// Queda UNO esperando su gate: `revision.ts`, el campo de revisión en el esquema.//
// ⚠️ 2-sep-2026 · SEGUNDA VEZ EN EL DÍA CON ESTE CONTADOR, y la misma forma: los DOS bloques de
// arriba bajan de 9 a 8, y NO son el mismo 8 — SCRUM-683 saca `parteDictado.ts` y SCRUM-655 fase
// B saca `revision.ts`. Cada uno contó sobre su árbol y en el suyo tenía razón.
//
// 🔴 Elegir un lado habría dejado el tope UNO POR ENCIMA de lo real, que es como un trinquete
// deja de proteger sin que nadie lo note. RECONTADO ejecutando `analizar()` sobre el árbol YA
// MEZCLADO: **126 módulos de dominio, 290 alcanzables, 7 inalcanzables.**
//
// Y con esto **se vacía la cola de los que esperaban gate**: ni `parteDictado.ts` ni
// `revision.ts` están ya en la lista. Los 7 que quedan son los de siempre — el bloque fiscal y
// los motores de oficina— y ninguno es de hoy.
// ═══════════════════════════════════════════════════════════════════════════════════════
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

test('SCRUM-411 · CONTROL POSITIVO: los conocidos salen', () => {
  // SCRUM-294 (fase B): `criterioCaja` sale de esta lista -- ya NO es inalcanzable.
  // SCRUM-293 (③a): `retencionIrpf` sale también, y NO se borra su renglón — se le da la vuelta
  // justo debajo. Ver el porqué allí.
  for (const frag of ['recargoEquivalencia', 'flagFiscal.service']) {
    assert.ok(esInalcanzable(frag),
      `🔴 «${frag}» NO sale como inalcanzable, y se midió que lo es. El detector no mide lo que dice medir.`);
  }
});

test('SCRUM-411 · 🔴 SCRUM-293 (③a): `retencionIrpf` YA NO es inalcanzable, y se dice por dónde', () => {
  // ⚠️ ESTA DECLARACIÓN ESTÁ DADA LA VUELTA, NO BORRADA, y la diferencia es el guard entero.
  //
  // Hasta ③a este módulo era el ejemplar de libro de «motor sin superficie»: construido, probado y
  // con CERO llamadores, esperando el GO del camino de emisión (regla 38). Lo declaraba el control
  // positivo de arriba. Hoy `src/app.ts` importa `tiposDeRetencionOrdenados()` para mandarle al
  // navegador las opciones del CUBO —sin ese cable la pantalla tendría que escribir los porcentajes
  // a mano, que es justo lo que el cubo existe para impedir—, así que el módulo se alcanza.
  //
  // 🔴 SI SE HUBIERA BORRADO EL RENGLÓN Y YA, desconectar el cable mañana habría dejado el módulo
  // inalcanzable OTRA VEZ sin que nada lo dijera por su nombre: solo lo habría acusado el tope
  // numérico de abajo, y un número no nombra al que se cayó. Al revés SÍ tiene sujeto — y ese es el
  // caso que hay que cazar, porque un motor fiscal que se queda sin pantalla no da ningún síntoma.
  assert.ok(!esInalcanzable('retencionIrpf'),
    '🔴 `retencionIrpf` ha vuelto a ser INALCANZABLE. Eso significa que alguien ha desconectado el ' +
    'cable de ③a: `src/app.ts` ya no importa `tiposDeRetencionOrdenados()`.\n\n' +
    '  No es cosmética. Sin ese import la pantalla de Configuración se queda sin las opciones del\n' +
    '  cubo y el selector de retención se pinta VACÍO — el profesional no puede declarar que retiene,\n' +
    '  y «no lo ha dicho» y «dice que no retiene» vuelven a ser el mismo estado.\n\n' +
    '  Si el cable se ha retirado A CONCIENCIA, este test vuelve a ser un control positivo (arriba) y\n' +
    '  el tope de abajo sube a 8 con su motivo. Lo que no vale es que se caiga en silencio.');
});

test('SCRUM-411 · 🔴 SCRUM-655 (fase B): `revision.ts` YA NO es inalcanzable, y se dice por dónde', () => {
  // ⚠️ DADA LA VUELTA, NO BORRADA — el mismo trato que `retencionIrpf` justo arriba, y por el mismo
  // motivo: si se borrase el renglón, desconectar el cable mañana dejaría el módulo inalcanzable
  // otra vez y sólo lo acusaría el tope numérico, que NO NOMBRA al que se cayó.
  //
  // 🔴 Y aquí lo que se cae en silencio no es un motor de cálculo: es la respuesta a «cuál de
  // estas versiones es la buena». Sin este cable, la pantalla del presupuesto vuelve a enseñar UNA
  // versión sin decir que hay otras — y el profesional le cobra al cliente por un documento que el
  // cliente ya había pedido cambiar.
  assert.ok(!esInalcanzable('quotes/domain/revision'),
    '🔴 `revision.ts` ha vuelto a ser INALCANZABLE: alguien ha quitado el cable de la fase B.\n\n' +
    '  `src/modules/system/quoteAdmin.ts` ya no importa `vistaDeRevisiones`, así que\n' +
    '  `GET /admin/quotes/:id` deja de llevar `revisiones` y `vigenteId`. La pantalla no puede\n' +
    '  contestar cuáles hay ni cuál está vigente, y lo hace SIN FALLAR: enseña la versión que\n' +
    '  pidió y calla las demás.\n\n' +
    '  Si el cable se ha retirado A CONCIENCIA, este test vuelve a ser un control positivo (arriba)\n' +
    '  y el tope de abajo sube a 9 con su motivo. Lo que no vale es que se caiga en silencio.');
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

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SEGUNDA POBLACIÓN — exports huérfanos DENTRO de módulos vivos
//
// Todo lo de arriba cuenta MÓDULOS enteros que nadie alcanza: 8, con tope. Un módulo está vivo en
// cuanto UNO de sus exports tiene llamador, así que dentro de un módulo vivo caben funciones que no
// llama nadie — y ésa es una población distinta, de 190, que hasta hoy no vigilaba nadie. Por ahí
// se coló `borrarMerchant` (RGPD-1, ticket CERRADO, y la promesa está en la página de privacidad).
//
// 🔴 AQUÍ EL GUARD NO ES UN NÚMERO, y el porqué está entero en `_huerfanos-declarados.mjs`: con 190
// y una base viva, un tope o bloquea trabajo legítimo o se sube sin mirar. Lo que se vigila es que
// **nadie entre en esta población en silencio**. Se AÑADE una población; el tope de arriba no se
// toca, y `_alcance-dominio.mjs` tampoco.
// ═════════════════════════════════════════════════════════════════════════════════════════

const C = censar(RAIZ);
const DECLARADOS_PARES = paresDeclarados();

/** El veredicto del trinquete: qué entró sin declarar, y qué está declarado y ya no toca. */
const nuevosSinDeclarar = (filas, pares) => filas.filter((f) => !pares.has(clave(f.modulo, f.nombre)));
const declaracionesCaducadas = (filas, pares) => {
  const vivos = new Set(filas.map((f) => clave(f.modulo, f.nombre)));
  return [...pares.keys()].filter((k) => !vivos.has(k));
};
/** 🔴 Con FICHERO Y LÍNEA: un guard que obliga a buscar a mano lo que ha cazado se acaba apagando. */
const nombrar = (filas) => filas.map((f) => `   ${f.modulo}:${f.linea}  ${f.nombre}`).join('\n');

/**
 * 🔴 SCRUM-494 · Y CON EL CONSEJO QUE TOCA A CADA UNO.
 *
 * El mensaje de un guard **no es documentación: es la instrucción que la siguiente persona va a
 * ejecutar.** Este trinquete cazó `metodoDeclarado` minutos después de nacer —la detección es
 * buena y no se toca— pero le dijo que lo DECLARARA, y la respuesta correcta era quitarle el
 * `export`: su consumidor real estaba dentro de su módulo y de fuera solo entraba su test.
 *
 * Aconsejar «declara» a un ayudante de test llena el registro de ruido y lo deja de señalar lo que
 * importa. Así que el consejo se calcula por export, no se escribe una vez para todos.
 */
const clasificarExport = clasificador(RAIZ);
const nombrarConConsejo = (filas) => filas.map((f) => {
  const c = clasificarExport(f.modulo, f.nombre);
  return `   ${f.modulo}:${f.linea}  ${f.nombre}\n     → ${consejoPara(c)}`;
}).join('\n\n');

// ── AUTOPRUEBA · antes de creerse ningún número ──────────────────────────────────────────

test('SCRUM-411 · 🔴 AUTOPRUEBA: el detector se prueba sobre fuente SINTÉTICA antes de creerse su número', () => {
  // Un censo medido solo contra el repo real no distingue «no hay huérfanos nuevos» de «me he
  // quedado ciego»: las dos salen como una lista que no crece. Así que primero se le da un árbol
  // con la respuesta conocida de antemano y se comprueba que la acierta EXACTA.
  const a = autoprueba();
  assert.ok(a.ok,
    '🔴 el detector NO acierta sobre fuente sintética, así que su número sobre el repo real no vale ' +
    `nada.\n   esperaba: ${a.esperados.join(', ')}\n   vio:      ${a.vistos.join(', ')}`);
  assert.ok(a.plantadoConLinea,
    '🔴 el huérfano plantado no sale con su línea correcta: el trinquete no podría nombrarlo.');
  assert.ok(a.noMarcaAlVivo,
    '🔴 CONTROL NEGATIVO: marca como huérfano un export que SÍ importa una ruta alcanzable.');
  assert.ok(a.noMarcaAlIndirecto,
    '🔴 CONTROL NEGATIVO (el que importa): marca un export cuyo llamante es INDIRECTO —lo importa ' +
    'otro módulo de dominio que a su vez es alcanzable—. Ahí es donde se equivoca un detector ' +
    'ingenuo, y con ese fallo la lista se llena de ruido y deja de poder atenderse.');
  assert.ok(a.distingueEjecutado,
    '🔴 no distingue «el `export` sobra pero el código lo ejecuta su módulo» de «esto no lo corre ' +
    'nadie». Sin esa señal, los 190 no se pueden clasificar y el censo vuelve a ser un número.');
});

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-411 · SUELO 2ª población: cero huérfanos es CEGUERA, no limpieza', () => {
  assert.ok(C.total >= 100,
    `🔴 el censo de huérfanos devuelve ${C.total}, y el 12-ago-2026 eran 190 en 66 módulos vivos. ` +
    'Una caída así no es que se hayan cableado 90 funciones en un día: es que el detector se ha ' +
    'roto. «Cero» y «no supe mirar» nunca son el mismo número — arréglalo antes de creerte la lista.');
  assert.ok(C.modulosConHuerfanos >= 30,
    `🔴 solo ${C.modulosConHuerfanos} módulos vivos con huérfanos: el censo está mirando otra cosa.`);
});

test('SCRUM-411 · SUELO 2ª población: sin árbol que mirar, el censo se DECLARA ciego', () => {
  const vacio = censar(path.join(RAIZ, 'tests'));
  assert.equal(vacio.sinSrc, true, '🔴 el censo de un árbol sin `src/` no se declara como tal.');
  assert.equal(vacio.total, 0);
  assert.ok(!(vacio.total >= 100), '🔴 un árbol vacío pasaría el suelo: entonces el suelo no es un suelo.');
});

// ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────

test('SCRUM-411 · 🔴 EL TEST QUE DECIDE: un huérfano NUEVO sin declarar cae NOMBRADO con fichero y línea', () => {
  // Se planta uno que no está declarado y se comprueba que el trinquete (a) lo caza y (b) lo dice
  // con fichero y línea. Sin esto, todo lo demás es un número más grande.
  //
  // ⚠️ Se comprueba que el plantado ESTÁ ENTRE los cazados, no que sea el único. Lo aprendí
  // plantando un huérfano de verdad en `soporte.ts`: con `assert.equal(nuevos.length, 1)` este test
  // fallaba diciendo «el trinquete NO caza nada» **justo cuando acababa de cazar dos**. Un rojo que
  // miente sobre su causa manda a quien lo lee a arreglar el guard en vez del código.
  const plantado = { modulo: 'src/modules/x/domain/motor.ts', nombre: 'motorHuerfano', linea: 4 };
  const nuevos = nuevosSinDeclarar([...C.filas, plantado], DECLARADOS_PARES);
  assert.ok(nuevos.some((f) => clave(f.modulo, f.nombre) === clave(plantado.modulo, plantado.nombre)),
    '🔴 el trinquete NO caza un huérfano nuevo sin declarar: no vigila nada.');
  const texto = nombrar(nuevos);
  assert.match(texto, /src\/modules\/x\/domain\/motor\.ts:4/,
    `🔴 el trinquete caza pero no NOMBRA fichero y línea. Dijo: «${texto}»`);
  assert.match(texto, /motorHuerfano/, '🔴 el trinquete no nombra el export que ha cazado.');
});

test('SCRUM-411 · 🔴 CONTROL POSITIVO: los 190 de hoy, DECLARADOS, no hacen ruido', (t) => {
  t.diagnostic(`huérfanos en módulos vivos: ${C.total} en ${C.modulosConHuerfanos} módulos · declarados: ${DECLARADOS_PARES.size}`);
  const nuevos = nuevosSinDeclarar(C.filas, DECLARADOS_PARES);
  assert.deepEqual(nuevos.map((f) => clave(f.modulo, f.nombre)), [],
    `🔴 HAY ${nuevos.length} EXPORT(S) HUÉRFANO(S) QUE NADIE HA DECLARADO:\n\n${nombrarConConsejo(nuevos)}\n\n` +
    '  Un export sin llamador pasa todos los tests y entra verde: desde fuera es indistinguible de\n' +
    '  una función entregada, su ticket se cierra, y lo que falta deja de estar en ninguna lista.\n' +
    '  Así estuvo meses `borrarMerchant` (RGPD-1), con la promesa escrita en la página de privacidad.\n\n' +
    '  🔴 EL CONSEJO VA ARRIBA, UNO POR EXPORT, y no es el mismo para todos: declarar un ayudante de\n' +
    '  test llena el registro de ruido y lo deja de señalar lo que importa. Lo que NO vale, en\n' +
    '  ningún caso, es que entre en silencio.');
});

test('SCRUM-411 · 🔴 el trinquete AL REVÉS: una declaración que ya no corresponde a ningún huérfano también cae', () => {
  // Que el recuento BAJE es SOSPECHA, no mejora: o alguien lo cableó (y entonces la constancia de
  // la mejora va en el mismo commit) o el detector se quedó ciego. Las dos se ven igual desde fuera
  // si nadie las separa, y por eso esto es rojo y no un aviso.
  const caducadas = declaracionesCaducadas(C.filas, DECLARADOS_PARES);
  assert.deepEqual(caducadas, [],
    `🔴 HAY ${caducadas.length} DECLARACIÓN(ES) QUE YA NO CORRESPONDEN A NINGÚN HUÉRFANO:\n\n` +
    `   ${caducadas.join('\n   ')}\n\n` +
    '  Hay exactamente dos causas y ninguna es rutina:\n' +
    '   ① LO HAS CABLEADO — enhorabuena: borra su línea en ESTE MISMO commit, así el registro queda\n' +
    '     como la constancia de que la deuda duró exactamente lo que duró.\n' +
    '   ② EL DETECTOR SE HA QUEDADO CIEGO y ha dejado de verlo. Entonces la lista entera vale menos\n' +
    '     de lo que parece y esto es lo único que te va a avisar.\n\n' +
    '  Bajar sin mirar es la avería que este registro existe para impedir.');
});

// ── QUE EL REGISTRO NO SE PUDRA ──────────────────────────────────────────────────────────

test('SCRUM-411 · cada declaración lleva categoría CONOCIDA, fecha y motivo', () => {
  for (const g of DECLARADOS) {
    assert.ok(CATEGORIAS[g.cat],
      `🔴 «${g.modulo}» se declara con la categoría «${g.cat}», que no existe. Si midiendo sale una ` +
      'categoría nueva, invéntala Y explícala en `CATEGORIAS` — pero no la dejes sin definir.');
    assert.match(g.desde, /^\d{4}-\d{2}-\d{2}$/,
      `🔴 «${g.modulo}» (${g.cat}) no lleva fecha: sin ella no se puede saber cuánto lleva esperando.`);
    assert.ok(g.motivo && g.motivo.length >= 30,
      `🔴 «${g.modulo}» (${g.cat}) no declara MOTIVO. Un registro de nombres sin porqués es un tope ` +
      'numérico escrito largo, y vuelve a subirse sin mirar.');
    assert.ok(g.exports.length > 0, `🔴 «${g.modulo}» (${g.cat}) declara un grupo vacío.`);
  }
});

test('SCRUM-411 · 🔴 `borrarMerchant` NO SE PUEDE BORRAR: es la especificación ejecutable del orden', () => {
  // Ha pasado por dos etiquetas equivocadas, y la segunda era mía: PROMESA_SIN_CABLE (repitiendo el
  // encargo) y SUPLANTADO_POR_UNA_COPIA. Medido, no es ninguna de las dos.
  //
  // 🔴 Y esto no es taxonomía: **una copia superada se acaba borrando**, que es la conducta correcta
  // para una copia y la que aquí destruye la única comprobación del orden de borrado seguro. La
  // etiqueta equivocada era una invitación a limpiarlo dentro de seis meses.
  const g = DECLARADOS_PARES.get('src/modules/system/domain/borradoMerchant.ts::borrarMerchant');
  assert.ok(g, '🔴 `borrarMerchant` ya no está declarado como huérfano y nadie lo ha cableado.');
  assert.equal(g.cat, 'ESPECIFICACION_EJECUTABLE_SIN_SUPERFICIE',
    '🔴 `borrarMerchant` ha cambiado de categoría, y las dos alternativas llevan a borrarlo.\n\n' +
    '  Sigue con CERO llamadores en producción — eso es cierto — pero `scrum192` y `scrum244` lo\n' +
    '  CORREN contra un prisma falso y comprueban la SECUENCIA de borrado: `event` antes que los\n' +
    '  charges, `merchant` el último, `reconciliation` antes que `charge` (la FK es RESTRICT).\n' +
    '  Con cero FK en cascada, ESE ORDEN ES LA GARANTÍA, y no está escrito en ningún otro sitio.\n' +
    '  `suprimirMerchant` no puede heredarlo: ANONIMIZA con `updateMany`, no borra.\n\n' +
    '  Si vas a reclasificarlo, MÍDELO antes — ya se ha etiquetado mal dos veces.');
});

test('SCRUM-411 · 🔴 las categorías SUMAN el total: un censo cuyas partes no suman no es un censo', (t) => {
  const porCat = new Map();
  for (const g of DECLARADOS) porCat.set(g.cat, (porCat.get(g.cat) ?? 0) + g.exports.length);
  const suma = [...porCat.values()].reduce((a, b) => a + b, 0);
  t.diagnostic([...porCat].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' · '));

  assert.equal(suma, DECLARADOS_PARES.size,
    `🔴 las categorías suman ${suma} y hay ${DECLARADOS_PARES.size} pares declarados. O un export ` +
    'está declarado dos veces, o un grupo repite un nombre: en los dos casos el reparto por ' +
    'categoría deja de poder leerse, y es lo único que este registro entrega además de la lista.');
  assert.equal(suma, C.total,
    `🔴 se declaran ${suma} y el censo mide ${C.total}. Las categorías tienen que sumar LO MEDIDO, ` +
    'no una lista que quedó de antes.');
});

test('SCRUM-411 · `PROMESA_SIN_CABLE` puede estar VACÍA, y que lo esté es la noticia', (t) => {
  // Hoy no hay ninguno: los dos candidatos que parecían serlo resultaron estar servidos por otra
  // función. La categoría se queda DEFINIDA a propósito — es donde tiene que aterrizar el siguiente,
  // y sin ella volvería a repartirse entre las blandas. Que esté vacía se dice, no se borra.
  const cuantos = DECLARADOS.filter((g) => g.cat === 'PROMESA_SIN_CABLE')
    .reduce((a, g) => a + g.exports.length, 0);
  t.diagnostic(`PROMESA_SIN_CABLE: ${cuantos}`);
  assert.ok(CATEGORIAS.PROMESA_SIN_CABLE,
    '🔴 se ha borrado la categoría `PROMESA_SIN_CABLE` porque hoy está vacía. Es la que hace que el ' +
    'siguiente «el producto lo ofrece y no ocurre» tenga dónde caer en vez de diluirse.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// TERCERA PREGUNTA (fase 2b) — ¿LLEGA ESTO DESDE UNA ENTRADA VIVA?
//
// Las dos poblaciones de arriba contestan «¿lo importa alguien?» y «¿lo alcanza un export vivo de
// su fichero?». Con las dos, `ensureReferralCode` salía huérfano PERO ejecutado — y quedaba la
// pregunta que de verdad decide si hay defecto: **el que lo llama por dentro, ¿está vivo?**
//
// «ENTRADA VIVA» está definido en `_alcance-desde-entradas.mjs` y es la MISMA que usa la primera
// población: `src/index.ts`, `src/app.ts` y los `scripts/*.mjs` que declara `package.json`. Si dos
// mediciones partieran de entradas distintas, comparar sus números no significaría nada.
// ═════════════════════════════════════════════════════════════════════════════════════════

const A = censarAlcance(RAIZ);

test('SCRUM-411 · 🔴 AUTOPRUEBA del alcance: sobre fuente sintética, antes de creerse el número', () => {
  const a = autopruebaAlcance();
  assert.ok(a.porImport, '🔴 no ve alcanzable lo que importa directamente una ruta viva.');
  assert.ok(a.porLlamadaInterna,
    '🔴 no ve alcanzable lo que NO importa nadie pero llama por dentro un export que sí entra desde ' +
    'una entrada viva. Ése es exactamente el caso de `ensureReferralCode`: sin este salto, el ' +
    'instrumento contestaría que no llega y se abriría un ticket falso.');
  assert.ok(a.muerto, '🔴 da por alcanzable un export al que no llega nada: entonces nunca dirá que no.');
  assert.ok(a.opacoIndeterminado,
    '🔴 un módulo atado con `import * as` NO se está declarando indeterminado.');
  assert.ok(a.opacoNoEsMuerto,
    '🔴 EL SUELO: lo que no se puede determinar sale como NO_ALCANZABLE. Son opuestos — uno dice ' +
    '«no llega» y el otro «no sé», y confundirlos fabrica un defecto que no consta.');
});

test('SCRUM-411 · SUELO del alcance: el grafo se recorre de verdad', () => {
  assert.ok(A.ficherosAlcanzables >= 100,
    `🔴 solo ${A.ficherosAlcanzables} ficheros alcanzables desde las entradas vivas: el grafo no se ` +
    'está recorriendo, y entonces TODO saldría no alcanzable.');
  assert.ok(A.total >= 400, `🔴 solo ${A.total} exports censados: el instrumento está mirando otra cosa.`);
  assert.ok(A.alcanzables > A.noAlcanzables,
    '🔴 hay más exports no alcanzables que alcanzables. En una base viva eso no es un hallazgo: es ' +
    'un detector roto.');
});

test('SCRUM-411 · 🔴 LA RESPUESTA: `ensureReferralCode` SÍ llega, y por dónde', () => {
  // La pregunta era: si el llamador estuviera muerto, la cadena entera lo estaría y el defecto SÍ
  // existiría — un merchant antiguo no obtendría nunca su código de referido. Medido: no es el caso.
  const v = A.veredictos.get('src/modules/auth/domain/referral.service.ts::ensureReferralCode');
  assert.ok(v, '🔴 `ensureReferralCode` ya no está en el censo de alcance.');
  assert.equal(v.estado, ALCANZABLE,
    `🔴 «${v?.estado}» — si de verdad dejó de llegar, un merchant antiguo NO obtiene su código de ` +
    'referido y hay que abrir el ticket. Compruébalo antes de tocar este test.');

  // Y la cadena, nombrada, para que se pueda contrastar a mano contra otra medición.
  const importadores = quienLoImporta(RAIZ, 'src/modules/auth/domain/referral.service.ts', 'getReferralStats');
  assert.deepEqual(importadores, ['src/app.ts'],
    '🔴 la cadena ha cambiado. Era: `src/app.ts` (entrada) → la ruta montada `GET /admin/referral` ' +
    `→ \`getReferralStats\` → \`ensureReferralCode\`. Ahora la importan: ${importadores.join(', ') || '(nadie)'}`);
  assert.deepEqual(
    quienLoImporta(RAIZ, 'src/modules/auth/domain/referral.service.ts', 'ensureReferralCode'), [],
    '🔴 ahora alguien SÍ importa `ensureReferralCode` de fuera. Buena noticia, pero este test ' +
    'documentaba el caso contrario: actualízalo con su motivo.');
});

test('SCRUM-411 · 🔴 el falso positivo conocido sale como INDETERMINADO, no como muerto', () => {
  // `sendQuoteEmail` lo llama `quotesAdmin.routes.ts` por import DINÁMICO. El instrumento de la
  // segunda población no puede atar ese nombre y lo cuenta como huérfano (declarado). Éste, en vez
  // de acusarlo, dice que NO SABE — que es la única respuesta honesta y la que evita el ticket falso.
  const v = A.veredictos.get('src/modules/messaging/domain/email.service.ts::sendQuoteEmail');
  assert.equal(v?.estado, NO_SE_PUDO_DETERMINAR,
    `🔴 «${v?.estado}». Si sale NO_ALCANZABLE, el instrumento está afirmando que un correo de ` +
    'presupuesto no se manda, y sí se manda: lo llama un import dinámico. «No se pudo determinar» y ' +
    '«no es alcanzable» son opuestos.');
});

test('SCRUM-411 · 🔴 lo que un test CORRE no es código muerto, y se cuenta por AST', () => {
  // `grep` cuenta igual una mención en un comentario, un nombre dentro de una lista de prohibidos y
  // una llamada de verdad. Aquí se cuentan CallExpression.
  const usos = llamadasEnTests(RAIZ, 'borrarMerchant');
  const total = usos.reduce((a, u) => a + u.llamadas, 0);
  assert.equal(total, 7,
    '🔴 `borrarMerchant` ya no se ejerce 7 veces desde los tests.\n' +
    `   medido ahora: ${usos.map((u) => `${u.fichero}=${u.llamadas}`).join(' · ') || '(ninguna)'}\n` +
    '   Si BAJA, alguien está retirando la especificación ejecutable del orden de borrado seguro.');
  assert.deepEqual(usos.map((u) => u.fichero), [
    'tests/scrum192-borrado-merchant.test.mjs',
    'tests/scrum244-colgados-de-otro-modelo.test.mjs',
  ], '🔴 han cambiado los guards que lo CORREN. Son ellos los que hacen que no se pueda borrar.');
});
