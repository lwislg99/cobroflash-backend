// Siembra el banco desechable para medir la pestana «Trabajos» de la ficha 360 (SCRUM-980).
// Uso: node seed.mjs <raiz-del-worktree>
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { urlDeBanco } from './conn.mjs';

const raiz = process.argv[2];
process.env.DATABASE_URL = urlDeBanco();
const req = createRequire(path.join(raiz, 'package.json'));
const { PrismaClient } = req('@prisma/client');
const { telefonoDePrueba } = await import(pathToFileURL(path.join(raiz, 'scripts/_telefonos-prueba.mjs')).href);
const prisma = new PrismaClient();

const EMAIL = 'qa-980b@example.test';
const dias = (n) => new Date(Date.now() + n * 86400000);
const out = {};
try {
  const yaHay = await prisma.merchant.findUnique({ where: { email: EMAIL } });
  if (yaHay) throw new Error('el banco ya esta sembrado (merchant ' + yaHay.id + '): rehacerlo desde la plantilla');
  const m = await prisma.merchant.create({ data: { name: 'QA 980b', email: EMAIL, country: 'ES', onboardingCompleted: true } });
  out.merchantId = m.id;

  const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente Historial 980b', phone: telefonoDePrueba(980), createdAt: dias(-400) } });
  const vacio = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente Sin Trabajos 980b', phone: telefonoDePrueba(981), createdAt: dias(-30) } });
  out.clienteId = cliente.id;
  out.vacioId = vacio.id;

  // 24 trabajos: la primera pagina (20) tiene «siguiente», y «Ver mas» trae los 4 restantes.
  const jobs = [];
  for (let i = 1; i <= 24; i++) {
    const largo = i === 24 ? 'Instalacion completa de climatizacion por conductos en la vivienda y en el local anexo' : 'Trabajo ' + String(i).padStart(2, '0');
    const j = await prisma.job.create({
      data: {
        merchantId: m.id, customerId: cliente.id, titulo: largo,
        status: i === 1 ? 'terminado' : (i === 2 ? 'agendado' : 'cerrado'),
        scheduledAt: i === 2 ? dias(14) : dias(-i * 10),
        tipoOperacion: 'OPERACIONES_SUELTAS',
        // createdAt creciente con i: el 24 es el MAS ANTIGUO, y sale en la segunda pagina.
        createdAt: dias(-(300 - i)),
      },
    });
    jobs.push(j);
  }
  // El orden de la lista es createdAt desc: para que el 1 salga primero, createdAt mas reciente al i menor.
  // (El bucle de arriba pone createdAt = -(300-i): i mayor = mas reciente. Se invierte aqui.)
  for (let i = 0; i < jobs.length; i++) {
    await prisma.job.update({ where: { id: jobs[i].id }, data: { createdAt: dias(-(100 + i)) } });
  }
  out.jobs = jobs.map((j) => j.id);

  const j1 = jobs[0];
  const parte = await prisma.parteTrabajo.create({ data: { merchantId: m.id, jobId: j1.id, customerId: cliente.id, numero: 'PT-2026-001', fecha: dias(-5), lineas: [], estado: 'firmado' } });
  const albaran = await prisma.albaran.create({ data: { merchantId: m.id, jobId: j1.id, numero: 'ALB-2026-001', fecha: dias(-5), lineas: [], estado: 'firmado' } });
  for (let k = 0; k < 3; k++) {
    await prisma.attachment.create({ data: { merchantId: m.id, entityType: 'albaran', entityId: albaran.id, url: 'foto-' + k + '.jpg', kind: 'photo' } });
  }
  const suelto = await prisma.parteTrabajo.create({ data: { merchantId: m.id, jobId: null, customerId: cliente.id, numero: 'PT-2026-099', fecha: dias(-2), lineas: [], estado: 'borrador' } });
  out.parteId = parte.id; out.albaranId = albaran.id; out.sueltoId = suelto.id;
  console.log(JSON.stringify(out));
  fs.writeFileSync(path.join(process.env.SONDA_TMP, 'siembra.json'), JSON.stringify(out));
} finally {
  await prisma.$disconnect();
}
