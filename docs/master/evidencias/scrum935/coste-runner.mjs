// SCRUM-935 · ¿CUÁNTO CUESTA dejar que el meta-guard llegue al final?
// El instrumento exacto es /actions/runs/<id>/timing, que devuelve los ms FACTURABLES por
// sistema operativo (GitHub redondea cada JOB hacia arriba al minuto).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const datos = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const filas = datos.filas.filter((f) => f.seg != null);

let msTotal = 0, ciegos = 0, conTiming = 0;
const porRun = [];
for (const f of filas) {
  let t;
  try {
    t = JSON.parse(execFileSync(GH, ['api', `repos/${REPO}/actions/runs/${f.run}/timing`],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  } catch { ciegos++; continue; }
  const ms = Object.values(t.billable || {}).reduce((a, b) => a + (b.total_ms || 0), 0);
  msTotal += ms; conTiming++;
  porRun.push({ run: f.run, min: ms / 60000, concl: f.jobConcl });
}

const ini = filas[filas.length - 1].creado, fin = filas[0].creado;
const horas = (Date.parse(fin) - Date.parse(ini)) / 3600000;
const minTotal = msTotal / 60000;
console.log(`POBLACIÓN · ${conTiming} runs de ci.yml con /timing legible (de ${filas.length}) · ciegos ${ciegos}`);
console.log(`VENTANA · ${ini} → ${fin} = ${horas.toFixed(1)} h`);
console.log(`\nLO QUE CUESTA HOY EL WORKFLOW ENTERO (todos sus jobs):`);
console.log(`  ${minTotal.toFixed(0)} min facturables en ${horas.toFixed(1)} h`);
console.log(`  = ${(minTotal / horas * 24).toFixed(0)} min/día = ${(minTotal / horas * 24 * 30).toFixed(0)} min/mes`);
console.log(`  = ${(minTotal / conTiming).toFixed(1)} min por run, de media`);

// El sobrecoste: los runs cuyo meta-guard murió EN el techo pagarían su duración real.
// Duración real proyectada (perfil, SCRUM-935): media de las proyecciones medidas.
const PROY = [734, 737, 617, 762, 737, 760, 693, 760, 666, 786, 758, 856, 759, 678, 682, 631, 760, 760, 736];
const mediaProy = PROY.reduce((a, b) => a + b, 0) / PROY.length;
const techo = filas.filter((f) => f.jobConcl === 'cancelled' && f.seg >= 600);
const mediaHoy = techo.reduce((a, f) => a + f.seg, 0) / techo.length;
// GitHub factura por JOB redondeando hacia arriba al minuto
const facturadoHoy = Math.ceil(mediaHoy / 60);
const facturadoDespues = Math.ceil(mediaProy / 60);
console.log(`\nEL SOBRECOSTE DE DEJARLOS ACABAR:`);
console.log(`  runs cuyo meta-guard murió en el techo: ${techo.length} de ${filas.length} en ${horas.toFixed(1)} h`);
console.log(`  hoy ese job dura de media ${mediaHoy.toFixed(0)} s → se factura ${facturadoHoy} min`);
console.log(`  con 30 min de presupuesto duraría ${mediaProy.toFixed(0)} s (proyección por perfil) → ${facturadoDespues} min`);
console.log(`  ⇒ +${facturadoDespues - facturadoHoy} min facturables por run afectado`);
const extraMes = (facturadoDespues - facturadoHoy) * techo.length / horas * 24 * 30;
console.log(`  ⇒ +${extraMes.toFixed(0)} min/mes al ritmo de merges de esta ventana`);
const mes = minTotal / horas * 24 * 30;
console.log(mes > 0
  ? `  ⇒ es un +${(100 * extraMes / mes).toFixed(1)} % sobre lo que ya cuesta CI`
  : `  ⇒ SOBRE CERO NO SE CALCULA UN PORCENTAJE: GitHub declara 0 ms FACTURABLES en los ${conTiming} runs.
     Eso no es que el instrumento no mire —mira y contesta 0— : es que el repositorio es PÚBLICO
     (medido: gh repo view → visibility PUBLIC) y los runners estándar no se facturan ahí.
     Los minutos de arriba son MÁQUINA, no dinero.`);
console.log('EXIT=0');
