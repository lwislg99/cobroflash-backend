export default async (s) => {
  const p = s.page;
  await p.locator('.parte-plegable-titulo', { hasText: 'Obra y referencia' }).click();
  await p.waitForTimeout(500);
  await s.mide('obra-abierta');
  const obra = p.locator('input[placeholder="Dónde se ha hecho el trabajo"]');
  await obra.fill('Calle Mayor 14, 3º B, 28801 Alcalá de Henares'); await obra.blur();
  await p.waitForTimeout(900);
  await p.locator('.parte-plegable-titulo', { hasText: 'Tipo de intervención' }).click();
  await p.waitForTimeout(400);
  await p.locator('input[name=parte-tipo][value=reparacion_asistencia]').check({ force: true });
  await p.waitForTimeout(900);
  await p.locator('.parte-plegable-titulo', { hasText: 'Técnicos' }).click();
  await p.waitForTimeout(400);
  const tec = p.locator('input[placeholder="Quién ha estado en la obra"]');
  await tec.fill('Jorge Operario (QA)'); await tec.blur();
  await p.waitForTimeout(1200);
  await s.mide('datos');
  // ¿se guardó? recargar y leer
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const txt = await p.evaluate(() => document.body.innerText);
  const m = txt.match(/DATOS DEL PARTE[\s\S]{0,300}/);
  s.nota('tras recargar: ' + (m ? m[0].replace(/\s+/g, ' ') : 'sin bloque'));
};
