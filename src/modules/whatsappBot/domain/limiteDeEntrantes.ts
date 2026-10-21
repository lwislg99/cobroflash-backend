// src/modules/whatsappBot/domain/limiteDeEntrantes.ts — SCRUM-1509h (regla 28)
//
// El límite de mensajes ENTRANTES de WhatsApp. Decisión del fundador (SCRUM-1509 c.20141,
// «ok vamos con tu recomendación»): 20 mensajes por número de teléfono y hora; el exceso se
// descarta EN SILENCIO —sin contestar al cliente y sin avisar al profesional— y cada descarte
// se cuenta.
//
// Por qué hace falta (SCRUM-1509f): delante del webhook no había ningún freno, y un cliente que
// escribe 120 textos producía 120 avisos al profesional y se comía el tope de plantillas del
// comercio entero.
//
// La hora es una ventana DESLIZANTE de 60 min, no la hora del reloj: con la del reloj, 20 a las
// 10:59 y 20 a las 11:00 serían 40 en un minuto.
//
// ⚠️ Vive EN MEMORIA, por proceso, a sabiendas: guardarlo en la base sería esquema nuevo
// (regla 40) y nadie lo ha decidido. Lo que eso pierde: al reiniciar, las ventanas y el
// contador vuelven a cero; y con más de una instancia, cada una contaría lo suyo. El recuento
// que dura es la traza `[WA in] DESCARTADO` que deja la ruta en el log, una por descarte.

import { normalizePhone } from '../../../core/utils/utils';

export const ENTRANTES_POR_HORA = 20;
const VENTANA_ENTRANTES_MS = 60 * 60 * 1000;

const llegadas = new Map<string, number[]>(); // número → instantes admitidos dentro de la ventana
let descartes = 0;
let ultimoBarrido = 0;

/**
 * ¿Se admite este mensaje entrante? Si sí, gasta un hueco del número; si no, cuenta un descarte.
 * Se llama UNA vez por mensaje (no por petición: Meta puede agrupar varios en un POST).
 */
export function admitirEntrante(from: string): boolean {
  const numero = normalizePhone(from) || from;
  const ahora = Date.now();
  const desde = ahora - VENTANA_ENTRANTES_MS;
  const dentro = (llegadas.get(numero) ?? []).filter((t) => t > desde);
  const admitido = dentro.length < ENTRANTES_POR_HORA;
  if (admitido) dentro.push(ahora);
  else descartes += 1;
  llegadas.set(numero, dentro);
  // Un número que dejó de escribir no se queda en memoria para siempre: como mucho un barrido
  // por minuto, para no recorrer el mapa en cada mensaje.
  if (ahora - ultimoBarrido > 60_000) {
    ultimoBarrido = ahora;
    for (const [n, ts] of llegadas) if (!ts.some((t) => t > desde)) llegadas.delete(n);
  }
  return admitido;
}

/** Descartes desde que arrancó el proceso. */
export function descartesDeEntrantes(): number {
  return descartes;
}
