// tests/_tenancy-diag.mjs — SCRUM-259 (+ nota de reutilización para SCRUM-269)
//
// Diagnóstico del síntoma «no veo lo MÍO recién creado». Cuando el assert cae, «no lo veo» esconde
// TRES estados que hay que separar — y confundir dos de ellos crea un verde/rojo hueco:
//   (a) la fila EXISTE y la consulta no la devolvió → fallo de FILTRO/consulta (mirar el where).
//   (b) la fila YA NO ESTÁ en la BD                  → alguien la borró por debajo (candidato:
//        clean-staging por @test.local, que NO mira el turno — hoy DESINFLADO como sospechoso nº1
//        de :258, pero sigue siendo la rama (b) que hay que poder distinguir).
//   (c) el re-read LANZÓ                             → NO COMPROBABLE. **No es (b).** «No pude mirar»
//        ≠ «no está»: leerlo como (b) sería un "borrado" que en realidad es un fallo de lectura.
//
// ── QUÉ ES REUTILIZABLE TAL CUAL (SCRUM-269, «un merchant no ve SU albarán») ──────────────────────
// `mensajeAusencia(...)` es PURO y NEUTRO de entidad: recibe el estado ya resuelto y compone el
// mensaje (a)/(b)/(c). SCRUM-269 lo importa TAL CUAL y solo escribe su propia re-lectura de 3 líneas
// (`prisma.albaran` en vez de `prisma.job`, sin `operarioId`). NO se generaliza aquí a una API por
// modelo (eso sería la abstracción que aún no toca); lo único atado a tenancy es `diagnosticarAusencia`,
// que re-lee `job`. Si 269 lo adopta, `mensajeAusencia` merece mudarse a un módulo de nombre neutro.
//
// DISEÑO: (i) BEST-EFFORT — ningún re-read tumba el test con otra excepción: se capturan y degradan
// a (c). (ii) el compositor es PURO y la re-lectura recibe el prisma INYECTADO → las tres ramas se
// prueban con un doble, sin BD ni turno. (iii) el mensaje lleva la HORA del re-read, el id y el
// merchantId (para correlacionar y para mirar el filtro).

/**
 * PURO y REUTILIZABLE: compone el mensaje de las tres ramas a partir del estado YA resuelto.
 * @param estado         'existe' | 'borrado' | 'no-comprobable'
 * @param etiqueta       cómo nombrar la fila en el mensaje (p.ej. 'jobA', 'el albarán')
 * @param merchantEstado 'vivo' | 'borrado' | 'no-comprobable' (para distinguir (b) fila vs merchant)
 * @param contexto       texto libre para (a): los campos que ayudan a mirar el filtro (opcional)
 */
export function mensajeAusencia({ estado, etiqueta, id, merchantId, merchantEstado, contexto, idsLen, ahoraIso }) {
  const hora = ahoraIso ?? new Date().toISOString();

  // (c) NO COMPROBABLE — el re-read lanzó. Rama propia: JAMÁS se lee como «borrado».
  if (estado === 'no-comprobable') {
    return `[re-read ${hora}] (c) NO COMPROBABLE: el re-read de ${etiqueta}(id=${id}) lanzó. ` +
      `NO sé si existe o no — esto NO es "borrado" (b). idsA=${idsLen}, merchant=${merchantId}.`;
  }

  // (b) BORRADO — la fila ya no está. El estado del merchant apunta a la causa.
  if (estado === 'borrado') {
    const m = merchantEstado === 'no-comprobable'
      ? `merchant ${merchantId}: no comprobable`
      : merchantEstado === 'vivo'
        ? `merchant ${merchantId} SIGUE vivo (borraron ${etiqueta}, no el merchant)`
        : `merchant ${merchantId} TAMBIÉN borrado (apunta a clean-staging borrando por @test.local)`;
    return `[re-read ${hora}] (b) ${etiqueta}(id=${id}) YA NO EXISTE — alguien lo borró por debajo. ` +
      `${m}. clean-staging borra por @test.local y NO mira el turno. idsA=${idsLen}.`;
  }

  // (a) EXISTE pero la consulta no la devolvió → fallo de FILTRO/consulta, no de borrado.
  return `[re-read ${hora}] (a) ${etiqueta} EXISTE (id=${id}${contexto ? ', ' + contexto : ''}) ` +
    `pero la consulta NO lo devolvió → fallo de FILTRO/consulta, no de borrado. idsA=${idsLen}.`;
}

/**
 * ATADO a tenancy-permisos: re-lee `job` + `merchant` (best-effort) y delega el mensaje en
 * `mensajeAusencia`. Es la ÚNICA parte específica; SCRUM-269 escribiría su gemela para `albaran`.
 */
export async function diagnosticarAusencia(prisma, { jobId, merchantId, idsLen, ahoraIso }) {
  let job;
  let estado = 'existe';
  try {
    job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, operarioId: true, merchantId: true },
    });
    estado = job ? 'existe' : 'borrado';
  } catch {
    estado = 'no-comprobable'; // (i) el re-read del Job falló → (c), no tumbamos el test.
  }

  // El merchant es secundario: distingue «borraron el Job» de «borraron el merchant entero».
  let merchantEstado = 'no-comprobable';
  try {
    const m = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
    merchantEstado = m ? 'vivo' : 'borrado';
  } catch {
    merchantEstado = 'no-comprobable';
  }

  return mensajeAusencia({
    estado,
    etiqueta: 'jobA',
    id: jobId,
    merchantId,
    merchantEstado,
    contexto: job ? `operarioId=${job.operarioId}, merchantId=${job.merchantId}` : null,
    idsLen,
    ahoraIso,
  });
}
