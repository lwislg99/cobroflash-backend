// src/modules/expenses/domain/retencionPracticadaEntrada.ts — SCRUM-1721 · pieza ③ de SCRUM-1066 c.21634.
//
// La ENTRADA de la retención de IRPF que el profesional PRACTICA al pagar un gasto (111/115), tal y
// como llega en el cuerpo de `POST /admin/expenses` y `PUT /admin/expenses/:id`. Hasta SCRUM-1721
// la ruta no leía estos campos (medido por J1 en SCRUM-1066 c.21634 con
// `docs/master/evidencias/scrum1066/sonda-1066g-retencion-por-la-ruta.mjs`): el servicio los
// aceptaba y nadie se los pasaba, y el borrador del 111/115 salía a cero.
//
// LOS DOS CAMPOS DEL CUERPO (solo códigos de error; los textos de la pantalla son de S2):
//   · `retencionPracticadaTipo`  — 15 · 7 · 19, la lista CONGELADA de J1
//                                   (`TIPOS_RETENCION_PRACTICADA_VALIDOS`, SCRUM-1721 c.21660).
//   · `retencionPracticadaCuota` — el importe retenido, ≥ 0, con dos decimales como su columna.
//
// En la edición `undefined` es «no lo mandes» y `null` es «bórralo», igual que el desglose de IVA
// (SCRUM-324 E3): abrir el modal y guardar no puede borrar la retención. Un vacío (`''`) cuenta
// como `null`: es lo que deja un campo de formulario sin rellenar.
//
// ⚠️ La opción «No» (pieza ④, `retencionPracticadaDeclarada = false`) NO está aquí a propósito:
// `tests/scrum1103-retencion-practicada-en-gastos.test.mjs:81` fija que `declarada` no es
// parámetro de alta, y re-anclar esa decisión es de su dueño (regla 41). Va en SCRUM-1721b.
import { TIPOS_RETENCION_PRACTICADA_VALIDOS } from '../../fiscal/retenciones/retencionesPracticadas';

/** El techo de `Expense.retencionPracticadaCuota` (`@db.Decimal(12, 2)`). */
const CUOTA_MAXIMA = 9_999_999_999.99;

type ErrorRetencionPracticada = 'retencion_tipo_invalido' | 'retencion_cuota_invalida';

interface CamposRetencionPracticada {
  retencionPracticadaTipo?: number | null;
  retencionPracticadaCuota?: number | null;
}

type LecturaRetencionPracticada =
  | { ok: true; campos: CamposRetencionPracticada }
  | { ok: false; error: ErrorRetencionPracticada };

const vacio = (v: unknown) => v === null || v === '';
const comoNumero = (v: unknown) => (typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN);

/**
 * Lee los dos campos. Devuelve SOLO las claves que hay que escribir: una clave ausente en `campos`
 * es «no se toca» (en la edición importa; en el alta el servicio pone `null`).
 */
export function leerRetencionPracticada(cuerpo: {
  retencionPracticadaTipo?: unknown;
  retencionPracticadaCuota?: unknown;
}): LecturaRetencionPracticada {
  const { retencionPracticadaTipo: crudoTipo, retencionPracticadaCuota: crudoCuota } = cuerpo;
  const campos: CamposRetencionPracticada = {};

  if (crudoTipo !== undefined) {
    if (vacio(crudoTipo)) campos.retencionPracticadaTipo = null;
    else {
      const tipo = comoNumero(crudoTipo);
      if (!TIPOS_RETENCION_PRACTICADA_VALIDOS.includes(tipo)) return { ok: false, error: 'retencion_tipo_invalido' };
      campos.retencionPracticadaTipo = tipo;
    }
  }

  if (crudoCuota !== undefined) {
    if (vacio(crudoCuota)) campos.retencionPracticadaCuota = null;
    else {
      const cuota = comoNumero(crudoCuota);
      if (!Number.isFinite(cuota) || cuota < 0 || cuota > CUOTA_MAXIMA
          || Math.round(cuota * 100) / 100 !== cuota) {
        return { ok: false, error: 'retencion_cuota_invalida' };
      }
      campos.retencionPracticadaCuota = cuota;
    }
  }

  return { ok: true, campos };
}
