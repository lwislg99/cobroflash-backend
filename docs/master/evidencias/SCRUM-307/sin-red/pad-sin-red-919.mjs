// docs/master/evidencias/SCRUM-307/sin-red/pad-sin-red-919.mjs — ¿QUÉ DICE EL PAD sin cobertura?
//
// Lo escribió la SESIÓN 4 el 17-sep-2026 para verificar los puntos ② y ③ de SCRUM-919 en staging,
// y vive aquí —en el banco sin cobertura de la S0— porque necesita su corte de red de verdad.
// Añade UNA cosa que ese banco no tiene: lee el pad ENTERO y compara con control cruzado. El banco
// resume la firma como «firmado en el pad», y ese resumen no distingue el texto nuevo del de antes
// —que es justo lo que cambió el ticket—, así que no podía dar el veredicto. No toca ningún fichero
// de la S0: sólo importa su conductor.
//
//   E2E_TEST_LOGIN_SECRET=… node docs/master/evidencias/SCRUM-307/sin-red/pad-sin-red-919.mjs \
//        --albaran <emitido> --parte <con líneas>
//
// `recorrido-sin-red.mjs` contesta QUÉ SE PUEDE HACER sin red y mide la cola. Los puntos 2 y 3 de
// SCRUM-919 son otra pregunta —QUÉ DICE EL PAD— y su respuesta es un TEXTO, así que se lee entero
// en vez de resumirlo: el resumen «firmado en el pad» de aquel banco no distingue entre el texto
// nuevo y el de antes, que es justo lo que este ticket cambió.
//
// Los dos textos que SCRUM-919 firmó (comentario 15799 del ticket) son el veredicto:
//   ② «Sin conexión. La firma está guardada en este móvil y se enviará cuando vuelva la señal con
//      YaQu abierto. No hace falta volver a firmar.»
//   ③ «Una firma sin nombre no identifica a nadie. Escribe el nombre de quien firma el parte.»
//      — el del PARTE tiene que hablar del PARTE; el del albarán, del albarán.
//
// Salidas: 0 los dos textos salen donde deben · 2 no.
import { arrancar, entrar, calentar, dormir, sondaDeRed, cortada, trazoTactil, colaDeFirmas, textoDePagina, pulsar, argumento } from './_conductor.mjs';

const albaran = Number(argumento('albaran'));
const parte = Number(argumento('parte'));
if (!albaran || !parte) { console.error('Uso: --albaran <id> --parte <id>'); process.exit(2); }

const TEXTO_SIN_CONEXION = 'Sin conexión. La firma está guardada en este móvil y se enviará cuando vuelva la señal con YaQu abierto. No hace falta volver a firmar.';

const { page, red, volcar, captura, cerrar } = await arrancar();
const vista = (n, o) => page.evaluate((a, b) => window.renderAppView(a, b), n, o);
const suelo = async () => {
  if (!cortada(await sondaDeRed(page))) { console.error('✗ NO SUPE MIRAR: la red NO está cortada.'); await cerrar(); process.exit(2); }
};
/** El pad entero, tal cual, sin recortar. */
const textoDelPad = () => page.evaluate(() => {
  const pad = document.querySelector('#signature-pad-modal, .signature-pad-modal, [class*="signature"][class*="modal"]')
    || [...document.querySelectorAll('div')].find((d) => /Firma del cliente/.test(d.innerText || '') && d.innerText.length < 1600);
  return pad ? pad.innerText.replace(/\s*\n\s*/g, ' | ').trim() : '(no encuentro el pad)';
});

const veredictos = [];
try {
  await entrar(page);
  const estado = await calentar(page);
  if (!estado.sw) { console.error('✗ NO SUPE MIRAR: el service worker no controla la página.'); process.exit(2); }

  for (const caso of [
    { nombre: 'PARTE', abrir: () => vista('parte-detail', { parteId: parte }), boton: 'Firmar aquí mismo', palabraPropia: 'parte', palabraAjena: 'albarán' },
    { nombre: 'ALBARÁN', abrir: () => vista('albaran-detail', { albaranId: albaran }), boton: '[data-accion="btnFirmarAqui"]', palabraPropia: 'albarán', palabraAjena: 'parte' },
  ]) {
    console.log(`\n══ ${caso.nombre} · abrir CON RED, cortar, firmar`);
    await red.devolver();
    await caso.abrir();
    await dormir(4500);
    await red.cortar();
    await suelo();

    await pulsar(page, caso.boton);
    await dormir(2500);
    const padAntes = await textoDelPad();
    console.log(`   pad ANTES de firmar: ${padAntes}`);

    await page.$eval('#sp-nombre', (e) => { e.value = 'Cliente Prueba (919)'; e.dispatchEvent(new Event('input', { bubbles: true })); }).catch(() => {});
    await trazoTactil(page);
    await dormir(600);
    await pulsar(page, 'Confirmar firma');
    await dormir(7000);
    const padDespues = await textoDelPad();
    console.log(`   pad DESPUÉS de firmar: ${padDespues}`);
    console.log(`   cola de firmas: ${await colaDeFirmas(page)}`);
    await captura(`919-pad-${caso.nombre.toLowerCase()}`);

    // ② el aviso de sin conexión, literal
    const dice2 = padDespues.includes(TEXTO_SIN_CONEXION.replace(/\s*\n\s*/g, ' '));
    // ③ el pad nombra SU documento y no el del otro. Se mira en el texto de antes de firmar,
    //    que es donde vive el aviso del nombre («…el nombre de quien firma el parte»).
    const junto = (padAntes + ' ' + padDespues).toLowerCase();
    const nombraElSuyo = junto.includes(caso.palabraPropia);
    const nombraElAjeno = junto.includes(caso.palabraAjena);
    veredictos.push({ caso: caso.nombre, dice2, nombraElSuyo, nombraElAjeno });
    console.log(`   ② aviso «Sin conexión…» literal: ${dice2 ? 'SÍ' : 'NO'}`);
    console.log(`   ③ nombra «${caso.palabraPropia}»: ${nombraElSuyo ? 'SÍ' : 'NO'} · nombra «${caso.palabraAjena}»: ${nombraElAjeno ? 'SÍ' : 'NO'}`);
    volcar(`919-${caso.nombre}`);
    await pulsar(page, 'Cancelar').catch(() => {});
    await dormir(800);
  }
} finally {
  await red.devolver().catch(() => {});
  await cerrar();
}

const ok = veredictos.length === 2
  && veredictos.every((v) => v.dice2 && v.nombraElSuyo)
  && !veredictos.find((v) => v.caso === 'PARTE').nombraElAjeno;
console.log('\n' + JSON.stringify(veredictos, null, 1));
console.log(ok ? '✓ los dos textos de SCRUM-919 salen donde deben' : '✗ falta alguno');
process.exit(ok ? 0 : 2);
