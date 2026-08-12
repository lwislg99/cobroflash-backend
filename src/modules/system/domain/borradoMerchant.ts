// src/modules/system/domain/borradoMerchant.ts — SCRUM-192
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// BORRAR UN MERCHANT SIN DEJAR HUÉRFANOS. Opción B (decisión del fundador): servicio
// explícito, SIN migración de FK.
//
// EL DATO QUE LO MOTIVA vive en UN SOLO SITIO: **`docs/CENSO_FK_MERCHANT.md`** (censo de
// SCRUM-192, medido contra la BD con dos catálogos independientes). Aquí no se repite, y la
// razón es este mismo comentario: enunció los números por su cuenta, se quedó desfasado cuando
// se corrigió la medición, y durante días mandó a quien lo leyera a razonar sobre un modelo de
// fallo que no existe. Tres copias, una corregida. Si el dato cambia, cambia allí y solo allí.
//
// EL MODELO DE FALLO, en una frase: **la red de FK no es uniforme**, así que borrar en mal orden
// revienta RUIDOSO en unas tablas y deja huérfanos MUDOS en otras — y lo ruidoso salta al final,
// cuando el daño mudo ya está hecho.
//
// Hoy no duele porque ninguna ruta borra merchants; el día que exista «dar de baja mi cuenta»
// (RGPD art. 17), **un borrado parcial de datos personales es peor que no borrarlos: creerías
// haber cumplido.**
//
// 🔑 POR QUÉ EL ORDEN SE DECLARA A MANO Y NO SE DERIVA DEL SCHEMA
//
// Es la trampa de este ticket y merece decirse entera. `MODELOS_POR_MERCHANT` **no es un
// conjunto: es una SECUENCIA de dependencias**, mantenida a mano porque **ninguna FK impone el
// orden ENTRE hijos**: las que hay solo obligan a que el merchant caiga el último, y de la
// secuencia interna no dicen nada. Su primera entrada existe por un motivo concreto (SCRUM-170): el libro de
// líneas facturadas cuelga de albarán y de factura, y si no se barre ANTES que ellos quedan
// filas huérfanas que nadie ve fallar.
//
// Un detector derivado del schema devuelve los modelos en **orden de declaración**, que no
// guarda ninguna relación con el orden seguro de borrado. Si el servicio borrase en ese orden,
// el peor caso sigue siendo el mismo —**dejar hijos huérfanos sin que nada protestase**— pero el
// motivo NO es que falte la red entera: es que **falta a trozos**, y justo en las tablas donde
// vive el trabajo y sus documentos. En las que sí tienen red el borrado revienta a mitad, y ese
// estruendo tapa que las mudas ya se quedaron atrás. Exactamente el fallo que este fichero cierra.
//
// Por eso se hacen LAS DOS COSAS, que es lo que da la garantía sin copiar la lista:
//   · la **COBERTURA** se deriva del schema (guard de SCRUM-172: no se puede olvidar un modelo);
//   · el **ORDEN** se declara aquí, porque no se puede derivar;
//   · y un guard exige que **todo modelo derivado aparezca en el orden declarado** — si falta
//     uno, rojo. Así esta lista declara ORDEN, no pertenencia.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * ORDEN DE BORRADO. Hijos primero, padres después. Cada bloque tiene su porqué.
 *
 * ⚠️ Añadir un modelo aquí NO es opcional cuando aparece en el schema con `merchantId`: el
 * guard de `tests/scrum192-borrado-merchant.test.mjs` lo exige. Lo que hay que pensar es DÓNDE
 * ponerlo, y eso no lo puede decidir ninguna máquina.
 */
export const ORDEN_BORRADO_MERCHANT: readonly string[] = [
  // SCRUM-170: el libro de líneas facturadas va PRIMERO — cuelga de albarán Y de factura, y
  // ninguna FK lo cascadea. Si no se barre antes que ellos, quedan huérfanas invisibles.
  'albaranLineaFacturada',
  // Rastros y adjuntos: no los referencia nadie, así que caen pronto y sin ruido.
  //
  // 🚩 SCRUM-207 · PUNTO DE ENGANCHE DE D-4 — DECISIÓN ABIERTA, NO IMPLEMENTADA AQUÍ.
  // Ese comentario de arriba era verdad y desde SCRUM-207 ya NO lo es del todo: `auditLog`
  // contiene ahora el registro FISCAL (`factura_emitida`, `factura_anulada`, `sellado_fallido`…),
  // que es la prueba que protege al FUNDADOR como productor del SIF — interés legítimo propio,
  // no un dato del interesado. Borrarlo con el merchant destruye su propia defensa.
  // Y a la vez contiene datos personales, y el RGPD publicado todavía no lo contempla en su
  // tabla de tratamientos ni en el ROPA.
  // Lectura del contrato (§9 D-4, NO vinculante): conservar las filas fiscales con el texto y
  // las variables REDACTADOS, y `plantilla`+`version`+`hash` intactos.
  // La decide el fundador con el asesor. Hasta entonces el comportamiento NO se cambia: se
  // sigue borrando todo, igual que antes, para no dejar a medias una política de conservación.
  //
  // SCRUM-497 · `emailMessage` va en este bloque y ANTES de `invoice`/`quote`/`customer`: sus
  // `related_type`/`related_id` apuntan a una factura o a un presupuesto, y su `customer_id` a un
  // cliente, **todo sin FK ninguna** (el modelo no declara relaciones). Si cayera después, quedarían
  // filas apuntando a ids que ya no existen y nada protestaría.
  //
  // ⚠️ AQUÍ SE BORRA, Y NO CONTRADICE QUE LA SUPRESIÓN DEL ART. 17 LO ANONIMICE. Son dos caminos
  // distintos y esta lista no es el del art. 17:
  //   · `suprimirMerchant` (el camino RGPD vivo) NO usa esta lista: usa `CAMPOS_PERSONALES`, y ahí
  //     `toEmail` se ANONIMIZA conservando la fila, porque la fila es la constancia del envío.
  //   · esta lista la usan `borrarMerchant` —gateado OFF, y su retirada la paró SCRUM-485— y
  //     `barridoDemo`, que resetea los datos de EJEMPLO para que el seed los vuelva a poner.
  //     MEDIDO: `barridoDemo` no es una supresión del art. 17 y el merchant demo sobrevive; dejar
  //     filas redactadas acumulándose ahí haría MENTIR al botón «Eliminar datos de ejemplo», que es
  //     justo el defecto que SCRUM-314 cerró. Para el demo, borrar de verdad es lo correcto.
  'auditLog', 'whatsAppMessage', 'legalAcceptance', 'customerEvent', 'attachment', 'emailMessage',
  // Documentos: albarán antes que factura (el albarán apunta a la factura que lo consolidó).
  'albaran', 'maintenancePlan', 'invoice', 'charge', 'job', 'quote', 'quoteRequest',
  // Catálogo y operativa: nadie cuelga de ellos a estas alturas.
  'quoteTemplate', 'expense', 'product', 'provider', 'authSession', 'teamMember',
  // El cliente al FINAL: media casa le apunta.
  'customer',
];

/**
 * Modelos con `merchantId` que quedan FUERA del barrido genérico, con su motivo.
 *
 * Se declaran en vez de omitirse en silencio: una ausencia sin explicación es indistinguible
 * de un olvido, y el guard obliga a que cada modelo derivado esté o en el orden o aquí.
 */
export const FUERA_DEL_BARRIDO_GENERICO: Readonly<Record<string, string>> = {
  // SCRUM-174: `BotSession.merchantId` es NULLABLE a propósito — la sesión de primer contacto
  // nace antes de saber de qué merchant es. Un `deleteMany({ where: { merchantId } })` no toca
  // esas filas, así que el barrido genérico daría una falsa sensación de limpieza. Se borra
  // por TELÉFONO, que es lo que de verdad identifica la conversación (ver `borrarMerchant`).
  botSession: 'merchantId nullable (SCRUM-174): se barre por teléfono, no por merchant',
};

/**
 * MODELOS QUE PERTENECEN A UN MERCHANT SIN TENER SU COLUMNA: cuelgan de `Charge`.
 *
 * 🔑 SCRUM-244 — por qué esto es una lista y no dos líneas sueltas. Estos modelos son
 * INVISIBLES para el guard de cobertura de SCRUM-172/192, que deriva del schema los modelos
 * **con columna `merchantId`**. Estos no la tienen, así que su verde nunca habló de ellos: el
 * único sitio donde existen es esta lista, y una lista suelta no avisa de lo que le falta.
 * Por eso está declarada aquí y la deriva un guard propio (`tests/scrum244-…`), que compara
 * contra el schema y sale en rojo el día que aparezca el tercero.
 *
 * ⚠️ Y no fallan callando, que es lo que los hace urgentes: ninguna de las dos `@relation`
 * declara `onDelete`, luego la FK es RESTRICT. Si uno de estos sobrevive, el `deleteMany` de
 * `charge` **falla** — con las tablas anteriores ya vacías. Van SIEMPRE antes que sus charges.
 */
export const COLGADOS_DE_CHARGE: Readonly<Record<string, string>> = {
  event: 'el histórico del cobro (SCRUM-192): cuelga de charge, sin merchantId propio',
  reconciliation:
    'la conciliación bancaria del cobro (SCRUM-244): mismo padre y mismo caso que event, ' +
    'pero se quedó fuera. Es rastro de DINERO del merchant y su FK bloquea el borrado.',
};

export interface ResultadoBorrado {
  ok: boolean;
  /** Filas borradas por modelo, para poder auditar QUÉ se fue — RGPD art. 17 pide poder decirlo. */
  borradas: Record<string, number>;
  errores: Array<{ modelo: string; error: string }>;
}

/**
 * Borra TODO lo de un merchant y el merchant. Pensado para ser el mecanismo del futuro «dar de
 * baja mi cuenta»; hoy no lo llama ninguna ruta (a propósito: exponerlo es otra decisión).
 *
 * NO va en una sola `$transaction` gigante a propósito: son 20+ `deleteMany` sobre tablas que
 * pueden tener mucho volumen, y una transacción larga bloquea escrituras del resto de merchants.
 * A cambio se acepta que un fallo a mitad deje el borrado incompleto — y por eso devuelve
 * `borradas` y `errores` en vez de lanzar: **un borrado parcial hay que poder verlo**, no
 * descubrirlo. Reintentar es seguro: `deleteMany` sobre lo ya borrado no hace nada.
 */
export async function borrarMerchant(
  prisma: any,
  merchantId: number,
  opciones: { telefonosBot?: string[] } = {},
): Promise<ResultadoBorrado> {
  const borradas: Record<string, number> = {};
  const errores: Array<{ modelo: string; error: string }> = [];

  const cuenta = async (clave: string, fn: () => Promise<{ count: number }>) => {
    try {
      const r = await fn();
      borradas[clave] = (borradas[clave] || 0) + (r?.count ?? 0);
    } catch (e: any) {
      errores.push({ modelo: clave, error: e?.message || String(e) });
    }
  };

  // Los colgados de `Charge` no tienen `merchantId` propio, así que no están en el orden
  // derivable: se filtran POR SU PADRE y van ANTES de que ese padre desaparezca (FK RESTRICT).
  for (const modelo of Object.keys(COLGADOS_DE_CHARGE)) {
    await cuenta(modelo, () => prisma[modelo].deleteMany({ where: { charge: { merchantId } } }));
  }

  for (const modelo of ORDEN_BORRADO_MERCHANT) {
    if (!prisma[modelo]?.deleteMany) {
      errores.push({ modelo, error: 'el cliente de Prisma no expone este modelo' });
      continue;
    }
    // AISLADO: el fallo de uno no cancela los siguientes. Sin esto, un borrado que falla a
    // mitad deja intacto todo lo de detrás — y con ello el merchant, que es lo peor de todo:
    // parecería que no se borró nada cuando en realidad se borró media cuenta.
    await cuenta(modelo, () => prisma[modelo].deleteMany({ where: { merchantId } }));
  }

  // BotSession: por teléfono (ver FUERA_DEL_BARRIDO_GENERICO). Si no se dan teléfonos no se
  // borra nada y se dice — mejor un hueco declarado que un cero que parece limpieza.
  const telefonos = (opciones.telefonosBot || []).filter(Boolean);
  if (telefonos.length) {
    await cuenta('botSession', () => prisma.botSession.deleteMany({ where: { phone: { in: telefonos } } }));
  } else {
    errores.push({
      modelo: 'botSession',
      error: 'sin teléfonos: las sesiones de bot NO se han tocado (merchantId es nullable, SCRUM-174)',
    });
  }

  await cuenta('merchant', () => prisma.merchant.deleteMany({ where: { id: merchantId } }));

  return { ok: errores.length === 0 && (borradas.merchant ?? 0) > 0, borradas, errores };
}
