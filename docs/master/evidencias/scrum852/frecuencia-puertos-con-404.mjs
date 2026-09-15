// SCRUM-852 · ¿cada cuanto muerde? Proporcion de puertos efimeros que contienen '404'.
// Rango tipico de Linux (ip_local_port_range por defecto): 32768-60999.
const DESDE = 32768;
const HASTA = 60999;

let con = 0;
let total = 0;
const ejemplos = [];
for (let p = DESDE; p <= HASTA; p++) {
  total++;
  if (String(p).includes('404')) { con++; if (ejemplos.length < 8) ejemplos.push(p); }
}
const pct = (con / total) * 100;
console.log(`RANGO EFIMERO: ${DESDE}-${HASTA}  (${total} puertos)`);
console.log(`CONTIENEN '404': ${con}  ->  ${pct.toFixed(3)} %  =  1 de cada ${(total / con).toFixed(1)}`);
console.log(`ejemplos: ${ejemplos.join(', ')} …`);

// CONTROL POSITIVO del contador: un rango donde la respuesta se sabe a mano.
let c2 = 0;
for (let p = 4040; p <= 4049; p++) if (String(p).includes('404')) c2++;
console.log('');
console.log(`CONTROL POSITIVO (4040-4049, deberian ser los 10): ${c2}` + (c2 === 10 ? ' ✅' : ' 🔴'));
let c3 = 0;
for (let p = 5000; p <= 5009; p++) if (String(p).includes('404')) c3++;
console.log(`CONTROL NEGATIVO (5000-5009, deberian ser 0): ${c3}` + (c3 === 0 ? ' ✅' : ' 🔴'));

// Y lo que significa: el test corre en cada tanda de CI.
console.log('');
console.log('LECTURA: con ' + pct.toFixed(2) + ' % por ejecucion, la probabilidad de haberlo visto');
for (const n of [10, 50, 100, 200]) {
  const q = 1 - (1 - con / total) ** n;
  console.log(`  tras ${String(n).padStart(3)} ejecuciones: ${(q * 100).toFixed(1)} %`);
}
