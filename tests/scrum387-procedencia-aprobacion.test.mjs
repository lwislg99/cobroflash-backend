// tests/scrum387-procedencia-aprobacion.test.mjs — SCRUM-387
//
// «APROBADO POR EL FUNDADOR» ES HOY UNA CADENA QUE PUEDE ESCRIBIR CUALQUIERA.
//
// La regla 30 dice que la microcopy la aprueba SOLO el fundador. Pero la regla vive en la cabeza
// de quien la respeta: en el repo, «aprobado» es texto libre, y una vez escrito es
// **indistinguible de una aprobación real**. Ya produjo una contradicción medible — seis
// identificadores marcados como aprobados el 6-ago frente a cinco distintos que el fundador
// aprobó ese mismo día, y cuatro de cinco no coincidían.
//
// Y el coste no es cosmético: esos ids se guardan en una columna. Cambiarlos después de migrar
// obliga a reescribir filas de un documento firmado.
//
// ── QUÉ EXIGE ESTE GUARD, Y QUÉ NO ──────────────────────────────────────────────────────────
// NO valida que la aprobación sea cierta —eso no lo puede saber un test— sino que sea
// **RASTREABLE**: que diga DÓNDE consta. Con eso, comprobarla cuesta un clic en vez de una
// arqueología por el historial.
//
// Procedencia rastreable = un ticket (`SCRUM-<n>`) o un documento (`docs/…`) en el mismo bloque
// de comentario. Una FECHA SOLA no vale: «aprobado el 5-ago» no dice dónde mirar, y es
// exactamente la forma que tenían las seis marcas contradictorias.
//
// ── EL TRINQUETE, Y POR QUÉ ES BIDIRECCIONAL ────────────────────────────────────────────────
// Las marcas sin procedencia que ya existen NO se pueden arreglar aquí: reescribir una
// atribución de aprobación es afirmar algo sobre el fundador que esta sesión no sabe (regla 30).
// Así que se congelan y se cuentan. El número **no puede subir** —código nuevo nace con
// procedencia— y **tampoco puede bajar en silencio**: si alguien arregla una, el test cae y
// obliga a bajar la cifra, que es como queda constancia de la mejora (patrón SCRUM-243/273/275).
//
// ⚠️ SE MIRAN COMENTARIOS, NO EL FICHERO ENTERO. La marca es una convención de comentario; un
// `grep` sobre el fuente casaría el texto de pantalla que dice «presupuesto aprobado», que es
// lenguaje de dominio y no tiene nada que ver. Se extraen con el escáner de TypeScript.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { bloquesDeComentario, censarProcedencia } from './_procedencia-aprobacion.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIRS = ['src', 'public'];

// La MARCA de aprobación: «aprobad{o,a,os,as} por el fundador». No basta «aprobado» a secas —
// «presupuesto aprobado» es el dominio del producto, no una atribución al fundador.
const MARCA = /aprobad[oa]s?\s+por\s+el\s+fundador/i;
// Procedencia RASTREABLE: un ticket o un documento. Una fecha sola no dice dónde mirar.
const PROCEDENCIA = /SCRUM-\d+|docs\/[\w./ -]+/i;

/**
 * 🔴 EL CENSO VIVE AHORA EN `_procedencia-aprobacion.mjs` (SCRUM-921c) — y este fichero NO
 * cambia de comportamiento: mismas `DIRS`, misma `MARCA`, misma `PROCEDENCIA`, mismo 17.
 *
 * Se extrajo porque SCRUM-921 midió que el caso de una autorización inventada se le escapó a
 * este guard por DOS ejes A LA VEZ —vivía en `tests/`, que no recorre, y decía «el fundador
 * DECIDE», que su marca no reconoce— y la fase c amplía los dos. Copiar este censo para
 * tocarle los parámetros a la copia habría dejado dos censos del mismo hecho que se
 * desincronizan en cuanto uno mejore, que es la familia de defectos que esta casa persigue.
 *
 * Lo que lee (comentarios con el parser, no con `createScanner` a pelo) y por qué, está en la
 * cabecera de ese módulo, con la medición de SCRUM-814 que lo obligó.
 *
 *     🔒 Un solo censo, dos preguntas.
 */
function censar() {
  return censarProcedencia(RAIZ, { dirs: DIRS, marca: MARCA, procedencia: PROCEDENCIA });
}


// ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────────
// Marcas de aprobación SIN procedencia rastreable que había cuando se encendió el guard.
// Solo puede BAJAR, y bajarlo obliga a tocar esta línea: así la mejora queda escrita.
// SCRUM-404 (7-ago-2026): 10 → 9. Al reescribir el fallo de firma en `albaranDetailView.js`, el
// `'No se pudo firmar: ' + e.message` —texto suelto, sin ticket detrás— pasó a ser un marcador
// `[PENDIENTE microcopy oficial · …]` con su ticket. Una marca menos sin procedencia.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-814 (7-sep-2026): 9 → 17, Y SUBE. Es la única subida legítima de este número, y hay
// que leerla al revés de como se lee normalmente.
//
// NO han aparecido ocho marcas nuevas: han aparecido ocho que YA ESTABAN y que el censo no
// podía ver. El lector de comentarios usaba `ts.createScanner` a pelo y se descarrilaba en el
// primer template literal con `${}` de cada fichero — desde ahí, ciego (ver
// `bloquesDeComentario`). Todo lo que estuviera detrás de un `$executeRaw` o de cualquier
// plantilla con sustituciones no se contaba.
//
// Las OCHO que estaban tapadas, enumeradas y no contadas:
//     public/dashboard/js/albaranDetailView.js:155
//     public/dashboard/js/homeView.js:643
//     public/dashboard/js/jobDetailView.js:302
//     public/dashboard/js/jobDetailView.js:385
//     public/dashboard/js/reportsView.js:940
//     src/modules/fiscal/librosAeat/librosAeat.ts:183
//     src/modules/jobs/domain/parteDictado.ts:401
//     src/modules/system/app/routes/invoicesAdmin.routes.ts:1116
//
// Ninguna es de SCRUM-814: son deuda vieja que el instrumento no alcanzaba. Este número NO
// vuelve a subir por nada que no sea otro arreglo del instrumento, y baja según se les ponga
// su ticket o su documento.
//
// 📌 Y la lección, que vale más que el número: el fallo se manifestó como una BAJADA —de 9 a 8—,
// o sea con la forma de una mejora. Lo cazó la mitad del trinquete que vigila que no baje en
// silencio, que hasta hoy parecía la mitad menos útil.
export const SIN_PROCEDENCIA = 17;

test('SCRUM-387 · SUELO: el censo encuentra marcas de aprobación de verdad', () => {
  const { conProcedencia, sinProcedencia } = censar();
  const total = conProcedencia.length + sinProcedencia.length;
  assert.ok(total >= 20,
    `solo ${total} marcas «aprobado por el fundador» encontradas en src/ y public/: el escáner no está mirando. Cero marcas NO significa «todo limpio»`);
  assert.ok(conProcedencia.length > 0,
    'ninguna marca con procedencia: si TODAS salen sin procedencia, lo roto es el detector de procedencia, no el árbol');
});

test('SCRUM-387 · el trinquete no sube: código nuevo nace con procedencia rastreable', () => {
  const { sinProcedencia } = censar();
  assert.ok(
    sinProcedencia.length <= SIN_PROCEDENCIA,
    `han aparecido marcas «aprobado por el fundador» SIN decir dónde consta la aprobación.\n` +
    `  antes: ${SIN_PROCEDENCIA} · ahora: ${sinProcedencia.length}\n` +
    `  ${sinProcedencia.join('\n  ')}\n\n` +
    `  Añade el ticket (SCRUM-<n>) o el documento (docs/…) donde consta. Una fecha sola no vale:\n` +
    `  no dice dónde mirar, y es la forma que tenían las seis marcas que se contradijeron.`,
  );
});

test('SCRUM-387 · el trinquete tampoco baja en silencio: la mejora se escribe', () => {
  const { sinProcedencia } = censar();
  assert.ok(
    sinProcedencia.length >= SIN_PROCEDENCIA,
    `se han arreglado marcas sin procedencia (${SIN_PROCEDENCIA} → ${sinProcedencia.length}) y el número no se ha bajado.\n` +
    `  Baja SIN_PROCEDENCIA a ${sinProcedencia.length} en este fichero: si no, el trinquete deja de\n` +
    `  proteger el hueco ya cerrado y mañana vuelve a colarse una.`,
  );
});

test('SCRUM-387 · una FECHA sola no es procedencia; un ticket o un documento sí', () => {
  // El detector, probado contra casos escritos a mano — no contra el árbol, que puede cambiar.
  const evaluar = (comentario) => {
    const b = bloquesDeComentario(comentario + '\nconst x = 1;', 'prueba.ts').filter((x) => MARCA.test(x.texto));
    assert.equal(b.length, 1, `el escáner no vio la marca en: ${comentario}`);
    return PROCEDENCIA.test(b[0].texto);
  };
  assert.equal(evaluar('// Microcopy aprobada por el fundador el 5-ago-2026.'), false, 'una fecha sola no dice dónde mirar');
  assert.equal(evaluar('// Microcopy aprobada por el fundador (SCRUM-264, regla 30).'), true);
  assert.equal(evaluar('// Copy aprobado por el fundador (23-jul, docs/Sprint Scrum/SESION_ACTUAL_SCRUM-69.md)'), true);
  // Y la procedencia vale aunque vaya en otra línea del MISMO bloque:
  assert.equal(evaluar('// Los diez rótulos, aprobados por el fundador.\n// Consta en SCRUM-284.'), true);
  // …pero no si es otro comentario distinto, separado por código:
  const separado = bloquesDeComentario('// aprobado por el fundador\nconst x = 1;\n// SCRUM-284\n', 'p.ts')
    .filter((b) => MARCA.test(b.texto));
  assert.equal(PROCEDENCIA.test(separado[0].texto), false, 'un SCRUM-<n> en otro comentario, tras código, no es la procedencia de esta marca');
});

test('SCRUM-387 · «presupuesto aprobado» NO es una marca de aprobación', () => {
  // La trampa que haría inútil el guard: «aprobado» es lenguaje de dominio en este producto.
  // Si la marca casara con eso, saldrían decenas de falsos positivos y alguien lo silenciaría.
  const codigo = '// El presupuesto aprobado por el cliente pasa a Trabajo.\nconst x = 1;';
  const b = bloquesDeComentario(codigo, 'p.ts').filter((x) => MARCA.test(x.texto));
  assert.deepEqual(b, [], 'la marca ha casado con lenguaje de dominio');
});
