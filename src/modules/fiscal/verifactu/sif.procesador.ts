// src/modules/fiscal/verifactu/sif.procesador.ts — SCRUM-1296 · SIF-1 fase 2.
//
// EL PROCESADOR DE LA COLA DE REMISIÓN: coge lo pendiente de UN obligado, lo manda en un sobre y
// aplica lo que `decidirTrasEnvio` (sif.cola.ts) dice que pasa con cada registro.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTE FICHERO NO ES (decisión D2 = X del orquestador, SCRUM-1296)
//
//   · NO ENVÍA NADA POR SÍ MISMO. El envío llega INYECTADO (`enviar`). Aquí no se importa
//     `enviarSobre` ni se lee un certificado: la custodia del certificado no es de ninguna sesión.
//     El día que se enganche de verdad, el llamante de `enviarSobre` lo verá el guard de
//     afirmaciones fiscales (SCRUM-1128), que es su trabajo.
//   · NO LO LLAMA NINGÚN CRON. Nada en `src/` lo invoca todavía.
//   · NO DECIDE REINTENTOS. Qué se reintenta, cuándo y cuántas veces lo dice `decidirTrasEnvio`,
//     tal cual. En particular, un 302/401/403 «sin permiso» va a una persona al primer intento
//     (SCRUM-1228b): aquí no hay una segunda capa que lo reintente como si fuera la red.
//   · CON `SIF_ENABLED` EN OFF NO HACE NADA: la cola se queda en pausa, con todo lo pendiente
//     dentro, y al encender se remite. Emitir sigue encolando igual (runbook R7: jamás bloquear
//     la emisión por la remisión).
// ─────────────────────────────────────────────────────────────────────────────────────

import { prisma as defaultPrisma } from '../../../core/db/prisma';
import { isFlagEnabled } from '../../../core/flags';
import { construirSobreRegFactu, MAX_REGISTROS_POR_ENVIO } from './registro.builder';
import { clave, decidirTrasEnvio, recuperarEnviadoSinCierre, type IdRegistro } from './sif.cola';

/** Lo que devuelve un envío: el mismo tipo que consume `decidirTrasEnvio`, sin importar el cliente. */
export type ResultadoDelEnvio = Parameters<typeof decidirTrasEnvio>[1];

/** El envío inyectado. Recibe el contenido del `Body` SOAP (sin declaración XML). No debe lanzar. */
export type Enviar = (p: { cuerpoSoap: string; envioId: string }) => Promise<ResultadoDelEnvio>;

/**
 * Cuánto tiene que llevar una fila en `sent` para darla por interrumpida. Por encima de la suma de
 * los timeouts por etapa del cliente (10+10+30+60+30 s = 140 s), con holgura: antes de eso el envío
 * puede seguir en vuelo en otro proceso.
 */
export const SENT_INTERRUMPIDO_TRAS_MS = 10 * 60 * 1000;

/** El `IDFactura` del registro TAL COMO SE GUARDÓ: lo que la AEAT devolverá en su línea. */
export function idDelRegistro(registroXml: string, tipoOperacion: string): IdRegistro | null {
  const id = /<sum1:IDFactura>([\s\S]*?)<\/sum1:IDFactura>/.exec(registroXml)?.[1];
  if (!id) return null;
  const campo = (n: string) => new RegExp(`<sum1:${n}>([^<]*)</sum1:${n}>`).exec(id)?.[1] ?? null;
  const emisor = campo('IDEmisorFactura');
  const serie = campo('NumSerieFactura');
  const fecha = campo('FechaExpedicionFactura');
  if (!emisor || !serie || !fecha) return null;
  const des = (v: string) => v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  return { idEmisorFactura: des(emisor), numSerieFactura: des(serie), fechaExpedicionFactura: fecha, tipoOperacion };
}

export type ResultadoProceso =
  | { hecho: 'pausada' }                       // SIF_ENABLED en OFF
  | { hecho: 'esperando'; hasta: Date }        // el TiempoEsperaEnvio de la AEAT para este obligado
  | { hecho: 'nada_pendiente' }
  | { hecho: 'enviado'; envioId: string; registros: number; lineasHuerfanas: number };

/**
 * Procesa UN envío de UN obligado. Los pasos, en orden:
 *   ① `SIF_ENABLED` en OFF → pausa.
 *   ② Filas en `sent` hace más de `SENT_INTERRUMPIDO_TRAS_MS`: el proceso murió con el sobre en
 *      vuelo. `recuperarEnviadoSinCierre` (sin respuesta: vuelven a `pending` y cuentan el intento).
 *   ③ Si la AEAT impuso esperar (`vf_flujo_obligado.siguiente_envio_desde`), se espera.
 *   ④ Hasta 1.000 filas `pending` vencidas, en orden de llegada → `sent` → un sobre → `enviar`.
 *   ⑤ `decidirTrasEnvio` sobre el resultado, y cada fila a su estado. Si `enviar` LANZA (el
 *      contrato dice que no), las filas se quedan en `sent` y las recoge ② en la siguiente vuelta:
 *      no se inventa aquí qué significa el fallo.
 */
export async function procesarObligado(
  obligadoNif: string,
  enviar: Enviar,
  opciones: { prisma?: any; ahora?: Date; sifEnabled?: boolean } = {},
): Promise<ResultadoProceso> {
  const prisma = opciones.prisma ?? defaultPrisma;
  const ahora = opciones.ahora ?? new Date();
  const encendido = opciones.sifEnabled ?? isFlagEnabled('SIF_ENABLED');
  if (!encendido) return { hecho: 'pausada' };

  // ② interrumpidos
  const colgados = await prisma.vfSubmission.findMany({
    where: { obligadoNif, status: 'sent', lastSentAt: { lt: new Date(ahora.getTime() - SENT_INTERRUMPIDO_TRAS_MS) } },
    select: { id: true, registroXml: true, tipoOperacion: true, attempts: true },
  });
  for (const f of colgados) {
    const id = idDelRegistro(f.registroXml, f.tipoOperacion);
    if (!id) continue;
    await aplicar(prisma, f.id, recuperarEnviadoSinCierre(id, f.attempts), ahora, null, null);
  }

  // ③ flujo de control de la AEAT
  const flujo = await prisma.vfFlujoObligado.findUnique({ where: { obligadoNif }, select: { siguienteEnvioDesde: true } });
  if (flujo?.siguienteEnvioDesde && flujo.siguienteEnvioDesde > ahora) {
    return { hecho: 'esperando', hasta: flujo.siguienteEnvioDesde };
  }

  // ④ lo pendiente y vencido
  const filas = await prisma.vfSubmission.findMany({
    where: { obligadoNif, status: 'pending', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: ahora } }] },
    orderBy: { id: 'asc' },
    take: MAX_REGISTROS_POR_ENVIO,
    select: { id: true, merchantId: true, registroXml: true, tipoOperacion: true, attempts: true },
  });
  const enviables = filas
    .map((f: any) => ({ f, id: idDelRegistro(f.registroXml, f.tipoOperacion) }))
    .filter((x: any) => x.id);
  if (enviables.length === 0) return { hecho: 'nada_pendiente' };

  const merchant = await prisma.merchant.findUnique({
    where: { id: enviables[0].f.merchantId },
    select: { name: true, legalName: true },
  });
  const envioId = `vf-${obligadoNif}-${ahora.getTime()}`;
  const cuerpoSoap = construirSobreRegFactu({
    // Quien PRESENTA el lote hoy, como en la exportación: el comercio en vivo.
    obligado: { nombreRazon: merchant?.legalName || merchant?.name || obligadoNif, nif: obligadoNif },
    registrosFacturaXml: enviables.map((x: any) => x.f.registroXml),
  });

  await prisma.vfSubmission.updateMany({
    where: { id: { in: enviables.map((x: any) => x.f.id) } },
    data: { status: 'sent', lastSentAt: ahora, lastEnvioId: envioId },
  });

  const resultado = await enviar({ cuerpoSoap, envioId });

  // ⑤ la política es la de la cola, tal cual
  const decision = decidirTrasEnvio(
    enviables.map((x: any) => ({ registro: x.id, intentosPrevios: x.f.attempts })),
    resultado,
  );
  const respuesta = 'respuesta' in resultado ? resultado.respuesta : null;
  const lineaDe = new Map((respuesta?.lineas ?? []).map((l) => [clave(l), l]));
  for (let i = 0; i < enviables.length; i += 1) {
    const d = decision.registros[i];
    const linea = lineaDe.get(clave(d.registro)) ?? null;
    await aplicar(prisma, enviables[i].f.id, d, ahora,
      d.estado === 'accepted' ? respuesta?.csv ?? null : null,
      linea?.estadoRegistro ?? null);
  }

  await prisma.vfFlujoObligado.upsert({
    where: { obligadoNif },
    create: {
      obligadoNif,
      tiempoEsperaEnvioS: respuesta?.tiempoEsperaEnvioS ?? null,
      siguienteEnvioDesde: new Date(ahora.getTime() + decision.esperaSiguienteEnvioS * 1000),
      ultimoEnvioId: envioId,
    },
    update: {
      tiempoEsperaEnvioS: respuesta?.tiempoEsperaEnvioS ?? null,
      siguienteEnvioDesde: new Date(ahora.getTime() + decision.esperaSiguienteEnvioS * 1000),
      ultimoEnvioId: envioId,
    },
  });

  return { hecho: 'enviado', envioId, registros: enviables.length, lineasHuerfanas: decision.lineasHuerfanas.length };
}

async function aplicar(
  prisma: any,
  id: number,
  d: ReturnType<typeof decidirTrasEnvio>['registros'][number],
  ahora: Date,
  csv: string | null,
  estadoRegistro: string | null,
): Promise<void> {
  await prisma.vfSubmission.update({
    where: { id },
    data: {
      status: d.estado,
      attempts: d.intentos,
      lastError: d.lastError,
      nextAttemptAt: d.reintentarEnS === null ? null : new Date(ahora.getTime() + d.reintentarEnS * 1000),
      subsanar: d.subsanar,
      ...(csv ? { csv } : {}),
      ...(estadoRegistro ? { estadoRegistro } : {}),
    },
  });
}
