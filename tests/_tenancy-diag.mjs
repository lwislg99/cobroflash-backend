// tests/_tenancy-diag.mjs — SCRUM-259
//
// Diagnóstico del assert de `tenancy-permisos` «el técnico ve SU Trabajo». Cuando cae,
// `idsA.includes(jobA.id) === false` tiene TRES estados que hay que separar — y confundir dos de
// ellos crea un verde/rojo hueco:
//   (a) el Job EXISTE y la consulta lo excluyó   → fallo de FILTRO (mirar operarioId/merchantId).
//   (b) el Job YA NO ESTÁ en la BD               → alguien lo borró por debajo (patrón
//        clean-staging por @test.local, que NO mira el turno — SCRUM-259/el ticket de clean-staging).
//   (c) el re-read LANZÓ                          → NO COMPROBABLE. **No es (b).** «No pude mirar»
//        ≠ «no está»: si se leyera como (b) tendríamos un "borrado" que en realidad es un fallo de
//        lectura — un rojo hueco. Rama propia, separada y legible.
//
// DISEÑO: (i) BEST-EFFORT — ningún re-read puede tumbar el test con otra excepción: se capturan.
// (ii) PURO en su lógica salvo el prisma, que se INYECTA, así que las tres ramas se prueban con un
// doble, sin BD ni turno (misma doctrina que `_staging-lock.mjs`). (iii) incluye la HORA del re-read
// (para poder correlacionar algún día con quién corrió clean-staging) y el merchantId.

export async function diagnosticarAusencia(prisma, { jobId, merchantId, idsLen, ahoraIso }) {
  const hora = ahoraIso ?? new Date().toISOString();

  let job;
  let jobLanzo = false;
  try {
    job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, operarioId: true, merchantId: true },
    });
  } catch {
    jobLanzo = true; // (i) el re-read del Job falló: no tumbamos el test, lo REPORTAMOS como (c).
  }

  // El merchant es secundario: distingue «me borraron el Job» de «me borraron el merchant entero».
  // Su propio fallo NO puede convertir un (b) en (c): se marca como no-comprobable y ya.
  let merchant;
  let merchantLanzo = false;
  try {
    merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
  } catch {
    merchantLanzo = true;
  }

  // (c) NO COMPROBABLE — el re-read del Job lanzó. Rama propia: JAMÁS se lee como «borrado».
  if (jobLanzo) {
    return `[re-read ${hora}] (c) NO COMPROBABLE: el re-read de jobA(id=${jobId}) lanzó. ` +
      `NO sé si existe o no — esto NO es "borrado" (b). idsA=${idsLen}, merchant=${merchantId}.`;
  }

  // (b) BORRADO — el Job ya no está. El estado del merchant apunta a la causa.
  if (!job) {
    const m = merchantLanzo
      ? `merchant ${merchantId}: no comprobable`
      : merchant
        ? `merchant ${merchantId} SIGUE vivo (borraron el Job, no el merchant)`
        : `merchant ${merchantId} TAMBIÉN borrado (apunta a clean-staging borrando por @test.local)`;
    return `[re-read ${hora}] (b) jobA(id=${jobId}) YA NO EXISTE — alguien lo borró por debajo. ` +
      `${m}. clean-staging borra por @test.local y NO mira el turno. idsA=${idsLen}.`;
  }

  // (a) EXISTE pero fuera de la lista → fallo de FILTRO, no de borrado.
  return `[re-read ${hora}] (a) jobA EXISTE (id=${job.id}, operarioId=${job.operarioId}, ` +
    `merchantId=${job.merchantId}) pero NO está en la lista del técnico → fallo de FILTRO, ` +
    `no de borrado. idsA=${idsLen}.`;
}
