// src/modules/invoicing/domain/clienteCongelado.ts — SCRUM-729
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL CLIENTE DEL DOCUMENTO, CONGELADO AL EMITIR. Y SÓLO AL EMITIR.
//
// Hasta hoy los cuatro sitios que reconstruyen una factura emitida —dos PDF, la regeneración de
// admin y el XML de la AEAT— leían la ficha del cliente EN VIVO. O sea: corregir una errata en el
// nombre de un cliente reescribía sus documentos fiscales pasados, sin que nadie editara nada y
// sin aviso. `docs/master/SCRUM-729.md` lo mide.
//
// Las cinco columnas existen desde el ALTER de `docs/sql/scrum-729-el-cliente-congelado.sql`
// (aplicado y verificado en las tres bases el 8-sep-2026) y hasta este fichero estaban VACÍAS.
// Una columna vacía no es una defensa: es un sitio donde ponerla.
//
// ── 🔴 LA REGLA DE LECTURA, ENTERA Y SIN FALLBACK ──────────────────────────────────────────────
//
//     columna presente  →  LA COLUMNA. Siempre. Los cuatro lectores.
//     columna a NULL    →  documento anterior al escritor: ficha viva, excepción DECLARADA.
//
// `NULL` sólo vale como frontera PORQUE el escritor es incapaz de producirlo: escribe en el MISMO
// `INSERT` que crea la fila (ver `crearFacturaEmitida.ts`) y `Customer.name` es `String` no nulo,
// así que una factura emitida por este camino no puede salir con `customerName` a NULL. Y esa
// incapacidad no es una promesa: la vigila el censo del embudo (`tests/_embudo-factura.mjs`), que
// exige CERO `invoice.create` directos fuera del envoltorio.
//
// Sin esas dos cosas —la incapacidad y el censo que la vigila— este `?? ficha viva` sería el
// defecto de SCRUM-729 disfrazado de compatibilidad. Con las dos, el conjunto que lee en vivo es
// CERRADO y no crece: son exactamente los documentos que ya existían el día del despliegue.
//
// ── ⛔ LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────────────────────
//
// ⛔ NO rellena hacia atrás. Un backfill con la ficha de hoy no es un relleno: escribiría un NIF
//    que el día de la emisión no constaba, y en `verifactu.service.ts` el NIF del cliente decide
//    si la factura ENTRA en el registro de la AEAT (`MODO_SIN_DESTINATARIO`). Rellenar sería
//    fabricar declaraciones fiscales.
// ⛔ NO congela presupuestos. Un presupuesto es una oferta VIVA y que refleje la ficha actual es
//    lo esperable (SCRUM-729 §3 «Lo que hay que medir antes de tocar»).
// ⛔ NO congela un campo suelto. Los cinco van juntos o no va ninguno: un documento mitad
//    congelado y mitad no es peor que uno vivo, porque nadie sabe cuál mirando.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
/**
 * 🔴 EL LECTOR DE FICHAS **NO** SE TIPA COMO `Prisma.TransactionClient`, y es a propósito.
 *
 * Lo cazó el guard de SCRUM-219: `congelarCliente` se llama con el cliente GLOBAL —a posta, para
 * que la lectura quede FUERA de la transacción y no entre en la sección crítica del cerrojo—, y
 * declararla `TransactionClient` habría sido escribir en la firma justo lo contrario de lo que
 * hace. El compilador no lo impide (`TransactionClient` es `Omit<PrismaClient, …>`, así que el
 * global encaja), pero una firma que miente es peor que una que no dice nada: el siguiente que
 * pase confía en ella.
 *
 * Así que se pide **lo mínimo que se usa**: algo con `customer.findFirst`. Sirve el cliente
 * global, sirve una `tx`, y sirve un doble de test — sin afirmar de ninguno que sea una
 * transacción.
 */
export interface LectorDeFichas {
  customer: {
    findFirst(args: {
      where: { id: number; merchantId: number };
      select: { name: true; legalName: true; taxId: true; email: true; phone: true };
    }): Promise<FichaDeCliente | null>;
  };
}

/**
 * Los cinco campos, con el NOMBRE EXACTO de la columna de `Invoice`/`Albaran`, para que el objeto
 * se derrame tal cual dentro del `data` del `create` y no haya un mapeo a mano que pueda derivar.
 *
 * `customerName` NO es opcional aquí a propósito: `Customer.name` es `String` no nulo en el
 * esquema, así que un congelado siempre lo trae. Es lo que convierte «`customerName` a NULL» en
 * una afirmación con significado —«esta fila es anterior al escritor»— en vez de en un «puede que
 * sí, puede que no».
 */
export interface ClienteCongelado {
  customerName: string;
  customerLegalName: string | null;
  customerTaxId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
}

/**
 * Los cinco nombres, en un sitio y exportados. Los usa el censo del embudo para comprobar que el
 * envoltorio los escribe TODOS: una lista escrita a mano en el test sería una segunda fuente que
 * puede quedarse atrás sin que nadie lo note.
 */
export const CAMPOS_CONGELADOS = Object.freeze([
  'customerName',
  'customerLegalName',
  'customerTaxId',
  'customerEmail',
  'customerPhone',
] as const);

/** Lo mínimo que hace falta de la ficha viva. Deliberadamente estructural: así el mismo lector
 *  sirve para un `Customer` de Prisma y para el `select` reducido del XML de la AEAT. */
export interface FichaDeCliente {
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
}

/** Lo que un documento lleva escrito. Los cinco a la vez o los cinco a NULL. */
export interface DocumentoConClienteCongelado {
  customerName?: string | null;
  customerLegalName?: string | null;
  customerTaxId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

/** El cliente tal y como lo tiene que ver quien reconstruye el documento. */
export interface ClienteDelDocumento {
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  /**
   * `false` = este documento es ANTERIOR al escritor y lo que se está leyendo es la ficha de HOY.
   * Se devuelve para que quien lo use pueda decirlo, no para que decida nada: la decisión ya está
   * tomada aquí.
   */
  congelado: boolean;
}

/** Copia los cinco valores de una ficha viva. No consulta nada: el viaje lo hace quien llama. */
export function congelarDesdeFicha(ficha: FichaDeCliente): ClienteCongelado {
  return {
    customerName: ficha.name,
    customerLegalName: ficha.legalName ?? null,
    customerTaxId: ficha.taxId ?? null,
    customerEmail: ficha.email ?? null,
    customerPhone: ficha.phone ?? null,
  };
}

/**
 * 🔴 EL VIAJE, Y DÓNDE VA.
 *
 * Se llama **ANTES de abrir la `$transaction`**, nunca dentro. `allocateInvoiceNumber` toma
 * `pg_advisory_xact_lock` como PRIMERA sentencia y el cerrojo es de transacción: se suelta en el
 * COMMIT, así que todo lo que va detrás se serializa entre emisiones simultáneas.
 *
 * Medido en `tests/scrum728d-viajes-de-la-reserva.test.mjs`: una factura F1 hace **8 viajes, 7 de
 * ellos dentro del cerrojo**. Congelar aquí cuesta **+1 viaje FUERA (8 → 9) y CERO dentro (7 se
 * queda en 7)**, porque la escritura viaja en el `INSERT` que ya se hacía.
 *
 * ⚠️ La ventana entre esta lectura y el COMMIT queda declarada: son milisegundos, y hasta hoy esa
 * ventana eran AÑOS. No se cierra metiendo la lectura en la transacción, porque eso la metería en
 * la sección crítica.
 */
export async function congelarCliente(
  db: LectorDeFichas,
  merchantId: number,
  customerId: number,
): Promise<ClienteCongelado> {
  // 🔴 REGLA 2 · FILTRA POR MERCHANT, y aquí no es una formalidad. Lo cazó el guard de SCRUM-243
  // sobre la primera versión, que hacía `findUnique({ where: { id } })`. Sin el filtro, un
  // `customerId` de otro profesional dejaría su nombre y su NIF **congelados dentro de un
  // documento fiscal** — y una factura emitida no se edita ni se borra (regla 29). Los siete
  // llamadores traen el `customerId` de un presupuesto o un trabajo que YA están acotados, así
  // que hoy no es alcanzable; se filtra igual, porque el coste es cero y el fallo es permanente.
  const ficha = await db.customer.findFirst({
    where: { id: customerId, merchantId },
    select: { name: true, legalName: true, taxId: true, email: true, phone: true },
  });
  if (!ficha) {
    // Fallar aquí es fallar ANTES de pedir número, que es donde hay que fallar: si reventara
    // después, el número ya estaría consumido y la serie tendría un hueco que justificar.
    throw new Error(`cliente_no_encontrado_al_congelar:${customerId}`);
  }
  return congelarDesdeFicha(ficha);
}

/**
 * 🔴 LA RECTIFICATIVA NO ELIGE DESTINATARIO: HEREDA EL DE LA FACTURA QUE RECTIFICA.
 *
 * Congelar la ficha de HOY en una R1 crearía una incoherencia que hoy no existe: la R1 declararía
 * un destinatario y la factura rectificada otro, y a la AEAT le llegarían las dos. Y no sería un
 * defecto heredado, sería uno NUEVO — hoy las dos leen en vivo, o sea que las dos mienten IGUAL y
 * al menos coinciden.
 *
 * El destinatario de una rectificativa no es una decisión: es, por definición, el de la factura
 * que corrige. Por eso esto no es una excepción a «se congela al emitir»: es esa misma regla
 * aplicada al documento del que la R1 toma su identidad.
 *
 * Si la original es anterior al escritor —sus cinco a NULL, que hoy son TODAS— no hay nada que
 * heredar y se congela la ficha viva: es lo mejor que consta, y a partir de ahí la R1 sí queda
 * fija. Cuesta el mismo viaje que cualquier otra emisión, y sólo en ese caso.
 */
export async function congelarParaRectificativa(
  db: LectorDeFichas,
  original: DocumentoConClienteCongelado & { customerId: number; merchantId: number },
): Promise<ClienteCongelado> {
  if (original.customerName != null) {
    return {
      customerName: original.customerName,
      customerLegalName: original.customerLegalName ?? null,
      customerTaxId: original.customerTaxId ?? null,
      customerEmail: original.customerEmail ?? null,
      customerPhone: original.customerPhone ?? null,
    };
  }
  return congelarCliente(db, original.merchantId, original.customerId);
}

/**
 * 🔴 EL ÚNICO LECTOR. Los cuatro sitios que reconstruyen una factura emitida pasan por aquí.
 *
 * @param doc   la fila del documento (`Invoice` o `Albaran`), con sus cinco columnas.
 * @param viva  la ficha de hoy. Se usa SÓLO si el documento es anterior al escritor.
 */
export function clienteDelDocumento(
  doc: DocumentoConClienteCongelado,
  viva: FichaDeCliente | null | undefined,
): ClienteDelDocumento {
  // Se mira `customerName` y no «los cinco a la vez» porque es el único de los cinco que el
  // escritor NO puede dejar vacío. Preguntar por `customerTaxId` daría falso «no congelado» en
  // toda factura a un particular sin NIF, que es el caso NORMAL en oficios (SCRUM-215).
  if (doc.customerName != null) {
    return {
      name: doc.customerName,
      legalName: doc.customerLegalName ?? null,
      taxId: doc.customerTaxId ?? null,
      email: doc.customerEmail ?? null,
      phone: doc.customerPhone ?? null,
      congelado: true,
    };
  }
  if (!viva) throw new Error('documento_sin_cliente_congelado_ni_ficha_viva');
  return {
    name: viva.name,
    legalName: viva.legalName ?? null,
    taxId: viva.taxId ?? null,
    email: viva.email ?? null,
    phone: viva.phone ?? null,
    congelado: false,
  };
}
