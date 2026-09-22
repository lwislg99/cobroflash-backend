// scripts/clasificar-fallo-automerge.mjs
//
// «No pude armar el auto-merge PORQUE HAY CONFLICTO» y «no pude armar y no sé por qué» no
// son el mismo suceso y no pueden dar el mismo color. Esto decide cuál de los dos es.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE: `pr-automatico.yml` pintaba de ROJO cualquier fallo al armar. El 8-sep-2026
// se puso rojo con el PR #1178, y el motivo era legítimo: el PR tenía conflictos, y GitHub no
// deja armar auto-merge sobre un PR en conflicto. El workflow hizo lo correcto —lo intentó, no
// pudo, y lo dijo con nombre y número— y aun así quedó marcado como avería. Un conflicto es
// una situación NORMAL: marcarla como fallo fabrica un rojo falso, y un rojo falso se aprende
// a ignorar, que es como se pierde el rojo verdadero.
//
// 🔴 POR QUÉ NO SE MIRA EL TEXTO DEL ERROR. La tentación es buscar «conflict» en el mensaje de
// `gh`. Eso es la avería clásica de esta casa: un discriminador por subcadena depende de una
// cadena que nadie prometió mantener, y el día que GitHub reescriba el mensaje el guard se
// vuelve mudo sin que nadie se entere. Aquí se mira el ESTADO DEL PR, que es un enum.
//
// LO QUE SE MIDIÓ (8-sep-2026) para poder escribir esto:
//   · La doc REST de GitHub sobre `mergeable`: «true / false / null», y —literal— «If the
//     value is null, then GitHub has started a background job to compute the mergeability.
//     After giving the job time to complete, resubmit the request.» O sea que `null`/`UNKNOWN`
//     NO significa «no hay conflicto»: significa «todavía no lo sé». Medido en vivo sobre 16
//     PR abiertos del repo: 13 devolvían `mergeable=null` en la primera petición.
//   · `gh pr view --json` acepta `mergeable` y `mergeStateStatus`, que es por donde entra el
//     enum en vez de la prosa.
//
// TRES VOCABULARIOS PARA EL MISMO HECHO, y por eso se normaliza en vez de comparar a pelo:
// GraphQL dice `CONFLICTING`, el `mergeStateStatus` dice `DIRTY`, y REST dice `mergeable:false`.
// Los tres son «hay conflicto». Normalizar un enum NO es adivinar por subcadena: es traducir
// tres nombres conocidos del mismo estado.
//
// FALLA CERRADO: solo salen VERDES los estados que esta función reconoce como benignos. Un
// valor que no conozca —porque GitHub añada uno nuevo, o porque se lea mal— cae a ROJO. Es la
// mitad que impide que «arreglar el rojo falso» acabe apagando el rojo entero.

import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Estados en los que NO poder armar el auto-merge es lo esperable, no una avería. */
const BENIGNOS = {
  CONFLICTING: 'el PR tiene CONFLICTOS con la base — GitHub no permite armar auto-merge ahí',
  CLEAN: 'el PR ya está limpio y no queda ningún check obligatorio por esperar — no hay nada que armar',
};

/** `mergeable` llega como enum de GraphQL, o como booleano si viene de REST. */
function normalizarMergeable(v) {
  if (v === false) return 'CONFLICTING';
  if (v === true) return 'MERGEABLE';
  if (v === null || v === undefined) return 'UNKNOWN';
  return String(v).toUpperCase();
}

function normalizarEstado(v) {
  if (v === null || v === undefined) return 'UNKNOWN';
  return String(v).toUpperCase();
}

// 🔴 EL AGUJERO QUE TIENE CLASIFICAR POR ESTADO, Y SU TAPA.
//
// El 8-sep-2026 se midió la causa real del rojo del PR #1181, y NO era el conflicto que se
// había supuesto: era `GraphQL: Resource not accessible by integration
// (enablePullRequestAutoMerge)`, o sea PERMISOS. Ese fallo aparece SEA CUAL SEA el estado del
// PR — así que si el PR estuviese además en conflicto, una clasificación que solo mira el
// estado lo llamaría «benigno» y taparía un problema de permisos en verde. Sería cambiar un
// rojo falso por un verde falso, que es peor.
//
// De ahí este ESCALADOR. Y sobre la regla de no discriminar por subcadena: aquí la subcadena
// SOLO puede volver algo MÁS estricto, nunca más laxo. Si GitHub reescribe el mensaje, este
// patrón deja de casar y se cae al camino normal —el de estado—, que es el que ya funciona.
// Un discriminador por texto que solo endurece no puede volverse mudo a favor del verde.
const MARCAS_DE_PERMISOS = [
  'resource not accessible by integration',
  'must have admin rights',
  'permission',
];

/**
 * @param {{mergeable?: unknown, mergeStateStatus?: unknown, error?: unknown}} vista  lo que
 *        devuelve `gh pr view --json mergeable,mergeStateStatus` (ya parseado), más
 *        opcionalmente `error`: la salida de texto que dio `gh pr merge` al fallar.
 * @returns {{benigno: boolean, motivo: string, mergeable: string, estado: string}}
 */
export function clasificar(vista = {}) {
  const mergeable = normalizarMergeable(vista.mergeable);
  const estado = normalizarEstado(vista.mergeStateStatus);

  // ANTES que nada: un fallo de permisos nunca es benigno, esté el PR como esté.
  const err = String(vista.error || '').toLowerCase();
  if (err && MARCAS_DE_PERMISOS.some((m) => err.includes(m))) {
    return {
      benigno: false,
      motivo: 'el fallo es de PERMISOS, no del estado del PR: la llave que se usó no puede ' +
              'armar el auto-merge. Mirar `permissions:` del job y si hay token de App',
      mergeable, estado,
    };
  }

  // Conflicto: lo dicen dos campos distintos, y basta con que lo diga uno.
  if (mergeable === 'CONFLICTING' || estado === 'DIRTY') {
    return { benigno: true, motivo: BENIGNOS.CONFLICTING, mergeable, estado };
  }

  // Nada que esperar: el auto-merge no se puede «armar» porque no hay condición pendiente.
  if (estado === 'CLEAN') {
    return { benigno: true, motivo: BENIGNOS.CLEAN, mergeable, estado };
  }

  // No saber en qué estado está NO es un estado benigno: es no saber, y eso es rojo.
  if (mergeable === 'UNKNOWN' && estado === 'UNKNOWN') {
    return {
      benigno: false,
      motivo: 'GitHub no ha resuelto la mergeabilidad (sigue en UNKNOWN tras reintentar): ' +
              'no se puede afirmar que el fallo sea benigno',
      mergeable, estado,
    };
  }

  return {
    benigno: false,
    motivo: `el PR estaba en un estado en el que SÍ se debería haber podido armar ` +
            `(mergeable=${mergeable}, mergeStateStatus=${estado}): el fallo es real`,
    mergeable, estado,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────
// Lee el JSON de `gh pr view` por stdin. Sale 0 si el fallo era benigno, 1 si es real, para
// que el paso del workflow herede el color sin tener que interpretar nada.
// Comparación por RUTA RESUELTA, no por nombre de fichero: si esto se equivocara al
// importarse desde un test, el proceso se quedaría esperando un stdin que nadie va a cerrar y
// colgaría la tanda entera. `pathToFileURL` es exactamente la forma de no equivocarse.
const esCli = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (esCli) {
  let crudo = '';
  for await (const trozo of process.stdin) crudo += trozo;
  let vista;
  try {
    vista = JSON.parse(crudo || '{}');
  } catch {
    // Ni siquiera se pudo leer el estado: eso es no saber → rojo. Sin volcar `crudo`,
    // que puede traer cualquier cosa.
    console.log('no se pudo leer el estado del PR (JSON ilegible) → se trata como fallo real');
    process.exit(1);
  }
  const r = clasificar(vista);
  console.log(`mergeable=${r.mergeable} mergeStateStatus=${r.estado}`);
  console.log(r.benigno ? `NO ES UNA AVERÍA: ${r.motivo}` : `FALLO REAL: ${r.motivo}`);
  process.exit(r.benigno ? 0 : 1);
}
