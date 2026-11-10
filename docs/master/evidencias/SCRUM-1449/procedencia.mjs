// procedencia.mjs — SCRUM-1449b · los literales de firma-c18285.json, contra los bytes de payMp.routes.ts
// en un commit ANTERIOR al cambio (el código que ya pintaba esas palabras).
//
// Uso: node procedencia.mjs <sha base>     (desde la raíz del repo)
// Lo que comprueba: que cada trozo de los literales que ya existía en el código casa byte a byte,
// así el salto Jira → fichero (que pasó por una sesión) queda cotejado contra una segunda fuente.
// Lo que NO puede comprobar: «Ahora mismo no se puede pagar con Mercado Pago.» no existía en el
// código; sólo tiene la fuente de Jira. Es todo ASCII salvo ninguna tilde, y eso sí se cuenta.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2];
if (!base) { console.log('CIEGO: falta el sha base'); process.exit(2); }
const viejo = execFileSync('git', ['show', `${base}:src/modules/billing/app/routes/payMp.routes.ts`], { encoding: 'utf8' });
const firma = JSON.parse(readFileSync(new URL('./firma-c18285.json', import.meta.url), 'utf8')).nodos;
const L503 = firma['503_blockquote'].content[0].content[0].text;
const L502 = /«([^»]+)»/.exec(firma['502_texto'].text)[1];
const LPEN = firma.pending_blockquote.content[0].content[0].text;

let fallos = 0;
const caso = (nombre, ok) => { console.log(`${ok ? 'CASA ' : 'NO CASA'} · ${nombre}`); if (!ok) fallos++; };
console.log(`base ${base} · payMp.routes.ts ${Buffer.byteLength(viejo)} B`);
caso('502: el literal firmado es el que ya pintaba el código', viejo.includes(`'${L502}'`));
caso('pending: el recorte es el principio exacto de la frase vieja', viejo.includes(`'${LPEN} Te notificaremos pronto.'`));
const cierre = 'Contacta con el profesional.';
caso('503: el cierre firmado es el de «Cobro vencido»', L503.endsWith(` ${cierre}`) && viejo.includes(`vencido. ${cierre}'`));
const primera = L503.slice(0, -(cierre.length + 1));
caso('503: la primera frase no estaba en el código (sólo la respalda Jira)', !viejo.includes(primera));
const noAscii = [...primera].filter((c) => c.codePointAt(0) > 127);
console.log(`503: caracteres no ASCII en la primera frase = ${noAscii.length} (${JSON.stringify(noAscii)})`);
// Control positivo sembrado: un literal alterado en una tilde TIENE que salir NO CASA.
const sembrado = L502.replace('é', 'e');
caso('CONTROL: un 502 sin la tilde NO casa (debe salir NO CASA → se invierte)', !viejo.includes(`'${sembrado}'`));
console.log(`POBLACION: 3 literales · ${fallos} fallos · EXIT=${fallos ? 1 : 0}`);
process.exit(fallos ? 1 : 0);
