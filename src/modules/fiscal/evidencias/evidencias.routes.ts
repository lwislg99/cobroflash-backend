// src/modules/fiscal/evidencias/evidencias.routes.ts — SCRUM-297 (A7).
//
// `GET /admin/evidencias.zip?year=&quarter=` — el paquete que DEMUESTRA lo declarado.
//
// Solo lectura (regla 38). El ZIP se arma con `archiver`, que ya estaba en el proyecto (regla 36:
// ninguna dependencia nueva) y es el mismo que usa el export de datos.
import { Router } from 'express';
import { ZipArchive } from 'archiver';
import { prisma } from '../../../core/db/prisma';
import { leerPaqueteEvidencias } from './paquete.repo';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const ahora = new Date();
    const año = Number(req.query.year) || ahora.getFullYear();
    const trimestre = Number(req.query.quarter) || Math.floor(ahora.getMonth() / 3) + 1;

    const paquete = await leerPaqueteEvidencias(prisma as any, { merchantId: req.merchantId, año, trimestre });

    const nombre = `evidencias-${req.merchantId}-${año}-T${trimestre}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);

    const zip = new ZipArchive({ zlib: { level: 9 } });
    // Si el ZIP se rompe a mitad, se registra: una descarga truncada que nadie ve es un paquete
    // incompleto entregado como completo.
    zip.on('error', (err) => { console.error('[GET /admin/evidencias.zip] zip', err); res.end(); });
    zip.pipe(res);
    for (const f of paquete.ficheros) zip.append(f.contenido, { name: f.nombre });
    await zip.finalize();
  } catch (err) {
    console.error('[GET /admin/evidencias.zip]', err);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    else res.end();
  }
});

export default router;
