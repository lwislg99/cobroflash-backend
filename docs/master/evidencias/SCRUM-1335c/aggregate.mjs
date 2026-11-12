import fs from 'node:fs';

const jobs = JSON.parse(fs.readFileSync('jobs-classified.json', 'utf8'));
const results = JSON.parse(fs.readFileSync('results.json', 'utf8'));

// Fusionar
const merged = jobs.map(j => {
  const r = results[String(j.job_id)];
  const row = {
    job_id: j.job_id,
    run_id: j.run_id,
    tramo: j.tramo,
    run_event: j.run_event,
    run_head_branch: j.run_head_branch,
    pr_numbers: j.pr_numbers,
    head_sha: j.head_sha,
    run_created_at: j.run_created_at,
    job_created_at: j.job_created_at,
    started_at: j.started_at,
    completed_at: j.completed_at,
    conclusion: j.conclusion,
    status: j.status,
    duration_s: j.duration_s,
    run_html_url: j.run_html_url,
    descargado: false,
    ilegible: false,
    leido_pero_sin_descarga_planeada: false,
  };
  const esCanceladaCorta = j.conclusion === 'cancelled' && !(j.duration_s !== null && j.duration_s >= 44 * 60);
  if (esCanceladaCorta) {
    row.categoria = 'cancelado_sustitucion';
    return row;
  }
  // deberia tener resultado
  if (!r) {
    row.categoria = 'NO_PROCESADO'; // no deberia pasar
    return row;
  }
  row.descargado = true;
  if (r.ilegible) {
    row.ilegible = true;
    row.categoria = j.conclusion === 'cancelled' ? 'muerto_por_techo_ilegible' : 'ilegible';
    row.error = r.error;
    return row;
  }
  const p = r.parsed;
  row.poblacion_N = p.poblacion_N;
  row.poblacion_M = p.poblacion_M;
  row.zonas = p.zonas;
  row.repesca_K = p.repesca_K;
  row.cambian_veredicto_X = p.cambian_veredicto_X;
  row.censadas_Y = p.censadas_Y;
  row.no_pude_comparar = p.no_pude_comparar; // {enTanda_P, comparadasQ, siguenSinCompararR}
  row.siguen_sin_comparar_ficheros = p.siguen_sin_comparar_ficheros;
  row.veredicto_final = p.veredicto_final;

  const zOk = p.zonas.filter(z => z.ok);
  if (p.zonas.length === 2 && zOk.length === 2) {
    row.totales = [zOk[0].pruebas, zOk[1].pruebas];
    row.totales_distintos = zOk[0].pruebas !== zOk[1].pruebas;
    row.diferencia_totales = Math.abs(zOk[0].pruebas - zOk[1].pruebas);
    row.segundos = [zOk[0].segundos, zOk[1].segundos];
  } else {
    row.totales = null;
    row.pasada_fallida = p.zonas.filter(z => !z.ok).map(z => ({ zona: z.zona, motivo: z.motivo }));
  }

  if (j.conclusion === 'cancelled') {
    row.categoria = 'muerto_por_techo';
  } else if (p.veredicto_final === 'TRINQUETE EN VERDE') {
    row.categoria = 'verde';
  } else if (p.veredicto_final) {
    row.categoria = 'rojo:' + p.veredicto_final;
  } else {
    row.categoria = j.conclusion === 'failure' ? 'rojo:SIN_VEREDICTO_EN_LOG' : 'verde_sin_veredicto_detectado';
  }
  return row;
});

fs.writeFileSync('merged.json', JSON.stringify(merged, null, 2));

function median(arr) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const tramos = ['A', 'B', 'C'];
const tabla = {};
for (const t of tramos) {
  const rows = merged.filter(r => r.tramo === t);
  const cancSust = rows.filter(r => r.categoria === 'cancelado_sustitucion');
  const muertoTecho = rows.filter(r => r.categoria === 'muerto_por_techo' || r.categoria === 'muerto_por_techo_ilegible');
  const ilegibles = rows.filter(r => r.ilegible);
  const leidos = rows.filter(r => r.descargado && !r.ilegible);
  const verdes = leidos.filter(r => r.categoria === 'verde');
  const rojosPorTipo = {};
  for (const r of leidos) {
    if (r.categoria.startsWith('rojo:')) {
      const tipo = r.categoria.slice(5);
      rojosPorTipo[tipo] = (rojosPorTipo[tipo] || 0) + 1;
    }
  }
  const conTotalesDist = leidos.filter(r => r.totales_distintos === true);
  const conP = leidos.filter(r => r.no_pude_comparar && r.no_pude_comparar.enTanda_P > 0);
  const sumaP = leidos.reduce((a, r) => a + (r.no_pude_comparar ? r.no_pude_comparar.enTanda_P : 0), 0);
  const sumaR = leidos.reduce((a, r) => a + (r.no_pude_comparar ? r.no_pude_comparar.siguenSinCompararR : 0), 0);
  const conR = leidos.filter(r => r.no_pude_comparar && r.no_pude_comparar.siguenSinCompararR > 0);
  const diffs = leidos.filter(r => r.diferencia_totales != null).map(r => r.diferencia_totales);
  const segsZona1 = leidos.filter(r => r.segundos).map(r => r.segundos[0]);
  const segsZona2 = leidos.filter(r => r.segundos).map(r => r.segundos[1]);

  tabla[t] = {
    jobs_total: rows.length,
    cancelados_sustitucion: cancSust.length,
    muertos_por_techo: muertoTecho.length,
    ilegibles: ilegibles.length,
    leidos: leidos.length,
    verdes: verdes.length,
    rojos_por_tipo: rojosPorTipo,
    jobs_totales_distintos: conTotalesDist.length,
    jobs_con_P_mayor_0: conP.length,
    suma_P: sumaP,
    suma_R: sumaR,
    jobs_con_R_mayor_0: conR.length,
    diferencia_totales_mediana: median(diffs),
    diferencia_totales_maxima: diffs.length ? Math.max(...diffs) : null,
    duracion_mediana_pasada1_s: median(segsZona1),
    duracion_mediana_pasada2_s: median(segsZona2),
  };
}

console.log(JSON.stringify(tabla, null, 2));

// item 3: tramo C jobs con P>0 o totales distintos
const tramoC = merged.filter(r => r.tramo === 'C' && r.descargado && !r.ilegible);
const tramoCInteresantes = tramoC.filter(r => (r.no_pude_comparar && r.no_pude_comparar.enTanda_P > 0) || r.totales_distintos === true);
fs.writeFileSync('tramoC-interesantes.json', JSON.stringify(tramoCInteresantes, null, 2));
console.error(`\nTramo C: ${tramoC.length} leidos, ${tramoCInteresantes.length} con P>0 o totales distintos`);

// item 5 (todos los tramos): coincide total pero P>0 ; difiere total pero P=0
const leidosTodos = merged.filter(r => r.descargado && !r.ilegible && r.totales != null && r.no_pude_comparar);
const coincideTotalPeroP = leidosTodos.filter(r => !r.totales_distintos && r.no_pude_comparar.enTanda_P > 0);
const difiereTotalPeroPCero = leidosTodos.filter(r => r.totales_distintos && r.no_pude_comparar.enTanda_P === 0);
console.error(`Coincide total pero P>0: ${coincideTotalPeroP.length}`);
console.error(`Difiere total pero P=0: ${difiereTotalPeroPCero.length}`);
fs.writeFileSync('item5.json', JSON.stringify({ coincideTotalPeroP, difiereTotalPeroPCero }, null, 2));
