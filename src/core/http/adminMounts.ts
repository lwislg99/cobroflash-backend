// src/core/http/adminMounts.ts — SCRUM-55 (red fail-closed, S1)
//
// POR QUÉ EXISTE ESTE FICHERO
// La tabla S1 del master dice "ruta nueva = declara rol mínimo; default Admin-only",
// pero hasta SCRUM-55 nada lo hacía cumplir: 124 rutas bajo /admin, 79 llegaban a un
// Operario sin ninguna declaración de rol. El problema no eran esas 79 — era que la
// 125 también iba a nacer abierta.
//
// Express 5 NO guarda el prefijo de montaje: en una capa de router `layer.path` es
// undefined y `layer.matchers` son funciones compiladas opacas (verificado; las
// recetas de Express 4 con `app._router` devuelven undefined porque esa propiedad
// ya no existe). Sin el prefijo no se puede reconstruir "/admin/metrics" desde el
// stack, así que la enumeración necesita que el montaje se registre al montar.
//
// `mountAdmin` monta Y registra en el mismo acto: es imposible montar un router bajo
// /admin sin que la red lo vea. Un `app.use('/admin/x', router)` suelto se detecta
// igualmente — el test cruza el registro contra `app.router.stack` y falla si aparece
// un router que nadie declaró (ver el test para el cruce).
import type { Express, Router, RequestHandler } from 'express';

export interface AdminMount {
  /** Prefijo EXACTO del montaje, p.ej. '/admin/reports'. */
  prefix: string;
  /** El router montado (identidad de objeto: así el test lo cruza con el stack). */
  router: Router;
  /** Middlewares interpuestos entre el prefijo y el router (aquí viven los requireRole de montaje). */
  gates: RequestHandler[];
}

const mounts: AdminMount[] = [];

/**
 * Monta un router bajo /admin dejando constancia para la red fail-closed.
 * Sustituye a `app.use('/admin/x', ...gates, router)` — misma firma y mismo orden.
 */
export function mountAdmin(
  app: Express,
  prefix: string,
  ...handlers: [...RequestHandler[], Router]
): void {
  if (!prefix.startsWith('/admin')) {
    // Fail-closed también aquí: este helper es SOLO para /admin. Si alguien lo usa
    // para otra cosa, la red contaría rutas que no vigila.
    throw new Error(`mountAdmin: el prefijo debe empezar por /admin (recibido: ${prefix})`);
  }
  const router = handlers[handlers.length - 1] as Router;
  const gates = handlers.slice(0, -1) as RequestHandler[];
  mounts.push({ prefix, router, gates });
  app.use(prefix, ...(handlers as unknown as RequestHandler[]));
}

/** Montajes /admin registrados, en orden de montaje. Lo consume la red fail-closed. */
export function getAdminMounts(): ReadonlyArray<AdminMount> {
  return mounts;
}
