// SCRUM-1509b - corre la sonda del recordatorio de FACTURAS, los controles PRIMERO.
// Sale 1 SIN MEDIR si un control no da lo suyo. Necesita dist/ (arbol anidado: tsc --noCheck).
// Uso (desde la raiz del repo): node docs/master/evidencias/SCRUM-1509b/medir.cjs
// Ningun numero esperado se escribe a mano: salen del tope LEIDO en dist y de las pasadas.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dist = path.resolve('dist');
if (!fs.existsSync(path.join(dist, 'integrations/whatsapp.js'))) { console.log('SIN dist/: la sonda NO ha corrido'); process.exit(1); }
const TOPE = require(path.join(dist, 'core/config/env.js')).config.WA_CUSTOMER_DAILY_CAP;
const TOPE_COMERCIO = require(path.join(dist, 'core/config/env.js')).config.WA_DAILY_TEMPLATE_CAP;
if (!Number.isInteger(TOPE) || TOPE < 1) { console.log('CONTROL ROTO: no pude leer WA_CUSTOMER_DAILY_CAP'); process.exit(1); }
const sonda = path.join(__dirname, 'sonda-facturas.cjs');

function correr(args) {
  const r = spawnSync(process.execPath, [sonda, dist, ...args], { encoding: 'utf8' });
  const lineas = String(r.stdout || '').split('\n').filter(Boolean);
  let j = null;
  try { j = JSON.parse(lineas[0]); } catch (e) { /* se dice abajo */ }
  if (r.status !== 0 || !j) { console.log('SONDA ROTA con [' + args.join(' ') + ']: ' + (r.stdout || '') + (r.stderr || '')); process.exit(1); }
  return { j, resto: lineas.slice(1) };
}
const corto = (j) => JSON.stringify({ SALIERON: j.SALIERON, porClase: j.porClase, candado: j.candadoPedido + ' pedidos / ' + j.candadoEscrito + ' escritos',
  topeClientePreguntado: j.topeClientePreguntado, topeComercioPreguntado: j.topeComercioPreguntado, bloqueos: j.bloqueos, avisosEnFicha: j.avisosEnFicha,
  filas: j.registroPedido + ' pedidas / ' + j.registroEscrito + ' escritas', con7: j.facturasCon7, con14: j.facturasCon14, porPasada: j.porPasada });
let fallos = 0;
function caso(titulo, args, esperado) {
  const { j, resto } = correr(args);
  const mal = Object.entries(esperado || {}).filter(([k, v]) => JSON.stringify(j[k]) !== JSON.stringify(v));
  console.log((mal.length ? 'NO CUADRA ' : (esperado ? 'ok        ' : '          ')) + titulo + '  [' + args.join(' ') + ']');
  console.log('   ' + corto(j));
  for (const [k, v] of mal) console.log('   esperaba ' + k + '=' + JSON.stringify(v) + ' y salio ' + JSON.stringify(j[k]));
  for (const l of resto) console.log('   ' + l);
  fallos += mal.length;
  return j;
}
function control(titulo, args, esperado) {
  const antes = fallos;
  const j = caso('CONTROL · ' + titulo, args, esperado);
  if (fallos > antes) { console.log('CONTROL ROTO: no se mide nada'); process.exit(1); }
  return j;
}

const P = 30; // pasadas diarias
console.log('tope por cliente y dia leido en dist: ' + TOPE + ' · tope por comercio y dia: ' + TOPE_COMERCIO + ' · pasadas: ' + P);
console.log('\n== 0 · CONTROLES DEL INSTRUMENTO (antes de cualquier numero)');
control('cero: sin pasadas no sale nada ni se pregunta nada', ['pasadas=0'], { SALIERON: 0, topeClientePreguntado: 0, candadoPedido: 0, registroPedido: 0 });
control('el instrumento VE un envio al que no se le pregunta el tope por cliente (presupuestos, solo ejecutado)', ['objeto=presupuesto', 'pasadas=48'], { SALIERON: 1, topeClientePreguntado: 0, topeComercioPreguntado: 1 });
control('la mutacion en memoria sustituye 2 de 2 y deja de preguntarse el tope', ['mutar=sin-cliente', 'pasadas=1'], { sustituciones: 2, topeClientePreguntado: 0, SALIERON: 2 });
control('EL QUE MANDA: recordatorio legitimo, todo sano, salen el de 7 y el de 14 una vez', [], { SALIERON: 2, candadoEscrito: 2, facturasCon7: 1, facturasCon14: 1 });

console.log('\n== 1 · SE ESCRIBE EL CANDADO AUNQUE EL ENVIO SE HAYA BLOQUEADO?');
caso('cliente con ' + TOPE + ' plantillas hoy, 1 pasada: bloqueado y candado NO pedido', ['previas=' + TOPE, 'pasadas=1'], { SALIERON: 0, candadoPedido: 0, facturasCon7: 0, facturasCon14: 0, bloqueos: { customer_daily_cap: 2 } });
caso('el mismo, 3 pasadas: se reintenta al dia siguiente y sale', ['previas=' + TOPE, 'pasadas=3'], { SALIERON: 2, candadoEscrito: 2, porPasada: '0,2,0' });
caso('cliente con ' + (TOPE - 1) + ' plantillas hoy: sale uno hoy y el otro manana', ['previas=' + (TOPE - 1), 'pasadas=3'], { SALIERON: 2, porPasada: '1,1,0' });
caso('comercio en su tope (' + TOPE_COMERCIO + '): bloqueado, candado NO pedido, sale manana', ['previasComercio=' + TOPE_COMERCIO, 'pasadas=2'], { SALIERON: 2, porPasada: '0,2', bloqueos: { daily_cap: 2 } });
caso('contrafactico SIN cliente, cliente con ' + TOPE + ' plantillas hoy: salen igual', ['previas=' + TOPE, 'pasadas=1', 'mutar=sin-cliente'], { SALIERON: 2, topeClientePreguntado: 0 });

console.log('\n== 2 · SE LE PASA EL CLIENTE? (lo dice el destino: la pregunta del tope y la fila)');
caso('HOY, todo sano', [], { topeClientePreguntado: 2, clientesPreguntados: ['50'], clientesEnFilaSent: ['50'] });
caso('contrafactico SIN cliente', ['mutar=sin-cliente'], { topeClientePreguntado: 0, clientesEnFilaSent: ['null'] });

console.log('\n== 3 · EL NUMERO: escritura del candado ROTA, ' + P + ' dias');
const porDia = (n) => Math.min(2 * n, TOPE);
caso('1 factura · HOY (con cliente)', ['candado=roto'], { SALIERON: porDia(1) * P });
caso('1 factura · contrafactico SIN cliente', ['candado=roto', 'mutar=sin-cliente'], { SALIERON: 2 * P });
caso('2 facturas del mismo cliente · HOY', ['facturas=2', 'candado=roto'], { SALIERON: porDia(2) * P });
caso('2 facturas · contrafactico SIN cliente', ['facturas=2', 'candado=roto', 'mutar=sin-cliente'], { SALIERON: 4 * P });
caso('3 facturas del mismo cliente · HOY', ['facturas=3', 'candado=roto'], { SALIERON: porDia(3) * P });
caso('2 facturas · rotos candado Y registro de WhatsApp', ['facturas=2', 'candado=roto', 'registro=roto'], { SALIERON: 4 * P });
caso('1 factura de 7 dias (edad real del primer aviso) · candado roto', ['edad=7', 'candado=roto'], { SALIERON: 7 + 2 * (P - 7) });
caso('1 factura de 7 dias · todo sano (control)', ['edad=7'], { SALIERON: 2 });
caso('2 facturas · todo sano (control: las 4 salen, la cuarta al dia siguiente)', ['facturas=2'], { SALIERON: 4, candadoEscrito: 4 });

console.log('\n== 4 · LOS CAMINOS A LOS QUE EL TOPE NO SE LES PREGUNTA (no son plantilla)');
caso('ventana de 24 h abierta en cada pasada · candado roto', ['ventana=1', 'candado=roto'], { SALIERON: 2 * P, topeClientePreguntado: 0 });
caso('factura SIN cobro (texto libre) · candado roto · OJO: dry-run no rechaza fuera de ventana', ['cobro=0', 'candado=roto'], { SALIERON: 2 * P, topeClientePreguntado: 0, registroPedido: 0 });

console.log(fallos ? '\nNO CUADRAN ' + fallos + ' valores: lo de arriba NO es una medicion' : '\nTODO CUADRA con lo derivado del tope leido (' + TOPE + ')');
process.exit(fallos ? 1 : 0);
