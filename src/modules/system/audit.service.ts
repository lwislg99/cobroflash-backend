// src/modules/system/audit.service.ts — A11.1 (EXT3, S2 F1-mínimo)
// Auditoría de las 4 acciones sensibles de F1 (master S2): marcar_pagado_manual,
// deshacer_pago, anular_factura, cambio_flag. Fire-safe: un fallo del log JAMÁS
// tumba la acción de negocio. El AuditLog completo (login, fiscal, Connect…) es F2.
import { prisma } from '../../core/db/prisma';
import type { Request } from 'express';

export type AuditAction =
  | 'marcar_pagado_manual'
  | 'deshacer_pago'
  | 'anular_factura'
  | 'cambio_flag'
  // SCRUM-14 (Parte L): traza del versionado del albarán — cada edición de un
  // albarán no firmado deja version++ y su registro aquí (decisión fundador 13-jul).
  | 'albaran_editado'
  // SCRUM-52 (carril A): autoría del operario congelada al crear el Trabajo desde el
  // accept (teamMemberId = creador del presupuesto; null = propietario).
  | 'operario_asignado';

export function requestIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd || req.socket?.remoteAddress || '');
  return String(raw).split(',')[0].trim() || null;
}

export function recordAudit(params: {
  merchantId: number;
  teamMemberId?: number | null; // null = owner/admin implícito
  action: AuditAction;
  entityType?: string | null;
  entityId?: number | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}): void {
  prisma.auditLog
    .create({
      data: {
        merchantId: params.merchantId,
        teamMemberId: params.teamMemberId ?? null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        meta: (params.meta as any) ?? undefined,
        ip: params.ip ?? null,
      },
    })
    .catch((e) => console.error('[audit] no se pudo registrar:', e?.message));
}
