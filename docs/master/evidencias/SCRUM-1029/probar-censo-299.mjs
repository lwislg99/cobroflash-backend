// docs/master/evidencias/SCRUM-1029/probar-censo-299.mjs
//
// Evidencia ejecutable de SCRUM-1029 §3: corre el censo REAL de SCRUM-299 (`tests/_copy-publico.mjs`)
// contra el árbol de hoy y comprueba que `lifecycle.service.ts` está en su población pero sus dos
// promesas de cobro ("cobrar antes de empezar", "las facturas se generan solas al cobrar") no caen
// bajo ninguno de los 5 patrones del detector, con el control positivo (frase canónica del propio
// guard) cayendo en 1 para descartar que el instrumento esté ciego.
//
// Uso: node docs/master/evidencias/SCRUM-1029/probar-censo-299.mjs   (desde la raíz del repo)
import { recolectarCopyPublico, promesasDeFactura } from '../../../../tests/_copy-publico.mjs';

const raiz = process.cwd();
const corpus = recolectarCopyPublico(raiz);
console.log('POBLACIÓN ficheros censados:', corpus.length);

const objetivo = corpus.find((c) => c.rel === 'src/modules/messaging/domain/lifecycle.service.ts');
console.log('lifecycle.service.ts en censo?', !!objetivo);

const dashboardEntro = corpus.filter((c) => c.rel.startsWith('public/dashboard/'));
console.log('ficheros de public/dashboard/ en censo (deberían ser 0):', dashboardEntro.length);

if (objetivo) {
  const p = promesasDeFactura(objetivo.texto);
  console.log('promesas detectadas HOY en lifecycle.service.ts (censo real):', p.length, JSON.stringify(p));
}

const control = promesasDeFactura('Aquí tienes tu factura. Págala cuando quieras');
console.log('CONTROL POSITIVO (debe ser 1):', control.length);

const casosSueltos = [
  'Bienvenido a YaQu. A partir de ahora vas a cotizar por WhatsApp, cobrar antes de empezar y olvidarte del papeleo.',
  'Las facturas se generan solas al cobrar.',
];
for (const c of casosSueltos) {
  console.log(JSON.stringify(c), '->', promesasDeFactura(c).length, 'coincidencias');
}
