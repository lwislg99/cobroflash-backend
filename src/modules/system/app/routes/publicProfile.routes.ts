// src/modules/system/app/routes/publicProfile.routes.ts — PERFIL-1 (A14.1, EXT3)
// Página pública /p/:slug del merchant (master Parte R). Flag PUBLIC_PROFILE_ENABLED
// merchant opt-in, OFF por defecto: sin flag (o slug inexistente) → 404 digno A6.5.
// PÚBLICO: nombre comercial, logo, gremio, zonas (chips), años de experiencia,
// "Pedir presupuesto por WhatsApp" (wa.me del PRO), link de reseñas Google y footer
// "Hecho con YaQu" → ?src=profile|qr (loop de atribución V0-3).
// NUNCA público: precios, clientes, volumen, email, NIF, dirección exacta.
import { Router, Request, Response } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { isFlagEnabled } from '../../../../core/flags';
import { notFoundPageHtml } from '../../../../core/http/publicNotFound';
import { buildPublicProfileHtml } from '../../domain/publicProfile.service'; // SCRUM-124 (r29 hermano)

const publicProfileRouter = Router();

publicProfileRouter.get('/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const merchant = slug
    ? await prisma.merchant.findUnique({
        where: { slug },
        select: {
          id: true, name: true, logoUrl: true, trade: true, profileZones: true,
          profileYears: true, whatsappPhone: true, googleReviewUrl: true,
          country: true, brandColor: true, status: true, flags: true,
        },
      })
    : null;

  const flagsJson = (merchant?.flags as Record<string, unknown> | null | undefined) ?? null;
  const visible =
    !!merchant &&
    merchant.status === 'active' &&
    isFlagEnabled('PUBLIC_PROFILE_ENABLED', {
      merchant: { id: merchant.id, country: merchant.country, flags: flagsJson },
    });
  if (!merchant || !visible) {
    return res.status(404).type('html').send(notFoundPageHtml());
  }

  // Loop V0-3: quien llega por QR arrastra su origen hasta el footer → registro
  // con acquisitionSource='qr'; el resto de visitas del perfil → 'profile'.
  const src = req.query.src === 'qr' ? 'qr' : 'profile';

  const html = buildPublicProfileHtml(merchant, { slug, src });
  return res.status(200).type('html').send(html);
});

export default publicProfileRouter;
