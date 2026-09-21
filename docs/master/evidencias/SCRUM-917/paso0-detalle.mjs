// SCRUM-917e · PASO 0 — ¿el defecto del DETALLE existe HOY? (A2: corriendo, no leyendo.)
//
// El inventario del prototipo (docs/prototipos/SCRUM-917/inventario-hoy.md §2) se midió el
// 17-sep contra STAGING. Han pasado tres días y main se ha movido. Antes de escribir una línea
// del rediseño hay que comprobar que lo que se viene a arreglar **sigue ocurriendo**, sobre
// ESTE árbol. Si no ocurre, se para y se dice: en una sola semana se gastaron dieciséis tandas
// en defectos ya arreglados.
//
// No decide nada. Sólo cuenta, y dice sobre qué población contó.
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { levantarBanco, pintarDetalle, CASOS } from '../../../../scripts/_detalle-917.mjs';

const eur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
let suelo = 0;

const banco = await levantarBanco();
const nav = await lanzarNavegador(puppeteer, { headless: 'new' });

// 🔴 CONTROL DE DISCRIMINACIÓN. Tres Trabajos distintos tienen que pintar tres pantallas
// distintas. Si salen iguales, el banco está sirviendo el mismo dato tres veces y NINGUNA cuenta
// de abajo vale — y el modo en que falla es traicionero: los casos 2 y 3 dicen «0 veces» de sus
// propios importes, que es exactamente lo que diría una pantalla ya arreglada.
// Esto no es un adorno: en la primera pasada de hoy este control no existía y me tragué el verde.
const huellas = new Map();

console.log('# SCRUM-917e · PASO 0 — el detalle del Trabajo, medido HOY');
console.log(`POBLACIÓN: ${CASOS.length} casos (${CASOS.map((c) => c.id).join(', ')}) × 2 anchuras (1280, 390)\n`);

for (const ancho of [1280, 390]) {
  const page = await nav.newPage();
  await page.setViewport({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await page.goto(banco.base, { waitUntil: 'networkidle0' });

  for (const caso of CASOS) {
    const testigo = await pintarDetalle(page, caso.id);
    // A21 · el testigo de ejecución: sin pantalla, un cero no es un cero.
    if (!testigo.ok) {
      console.log(`  🟡 SUELO · Trabajo ${caso.id} a ${ancho}px NO se pintó (${testigo.por}) — no cuento nada de este caso`);
      suelo++;
      continue;
    }

    const m = await page.evaluate((datos) => {
      const c = document.getElementById('view');
      const texto = c.innerText;
      const cuenta = (s) => (s ? texto.split(s).length - 1 : 0);

      // Secciones: las cabeceras de sección del detalle, con su literal tal cual sale.
      const secciones = [...c.querySelectorAll('h2, h3, .section-title, .card-title')]
        .map((e) => e.textContent.trim()).filter(Boolean);

      // Controles por debajo de 44 px: el criterio de AB6, medido en el DOM resuelto, no en CSS.
      const controles = [...c.querySelectorAll('button, a, input, select, textarea, [role="button"]')]
        .filter((e) => e.offsetParent !== null || e.getClientRects().length);
      const pequenos = controles.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
      }).length;

      return {
        huella: texto.replace(/\s+/g, ' ').trim(),
        nodos: c.querySelectorAll('*').length,
        alto: c.getBoundingClientRect().height,
        secciones,
        controles: controles.length,
        pequenos,
        vecesAceptado: cuenta(datos.aceptado),
        vecesCliente: cuenta(datos.cliente),
        vecesPresupuesto: datos.presupuesto ? cuenta(datos.presupuesto) : 0,
        // El rótulo que el prototipo dice que MIENTE en un Trabajo pagado.
        rotuloQueFalta: /QUÉ FALTA PARA COBRAR/i.test(texto),
        diceFaltaCero: /[Tt]e falta por cobrar\s*0,00/.test(texto),
        // La casilla suelta que el prototipo quiere mover dentro del parte.
        incluirPrecios: /Incluir precios en el parte/.test(texto),
        // El aviso YA FIRMADO de SCRUM-887 — no es de este ticket, pero si desapareciera al
        // rediseñar sería una pérdida silenciosa, así que se cuenta desde el minuto cero.
        aviso887: /Has cobrado .* más de lo aceptado\./.test(texto),
      };
    }, {
      aceptado: caso.totalAceptado == null ? '' : eur(caso.totalAceptado),
      cliente: caso.customer.name,
      presupuesto: caso.quote ? `Presupuesto #${caso.quote.numero}` : '',
    });

    const clave = `${ancho}|${m.huella}`;
    if (huellas.has(clave)) {
      console.log(`  🔴 INSTRUMENTO CIEGO · Trabajo ${caso.id} a ${ancho}px pinta EXACTAMENTE lo mismo que ${huellas.get(clave)}.`);
      console.log('     El banco está sirviendo el mismo dato: ninguna cuenta de este caso vale.');
      suelo++;
      continue;
    }
    huellas.set(clave, `el Trabajo ${caso.id}`);

    console.log(`## Trabajo ${caso.id} (${caso.customer.name}) a ${ancho}px`);
    console.log(`   nodos ${m.nodos} · alto ${Math.round(m.alto)} px · ${m.secciones.length} secciones · ${m.controles} controles`);
    console.log(`   secciones: ${m.secciones.join(' · ') || '(ninguna con cabecera reconocible)'}`);
    console.log(`   «${caso.totalAceptado == null ? '—' : eur(caso.totalAceptado)}» en pantalla: ${m.vecesAceptado} veces`);
    console.log(`   «${caso.customer.name}» en pantalla: ${m.vecesCliente} veces`);
    if (m.vecesPresupuesto) console.log(`   «Presupuesto #${caso.quote.numero}»: ${m.vecesPresupuesto} veces`);
    console.log(`   controles < 44 px: ${m.pequenos} de ${m.controles}`);
    console.log(`   «QUÉ FALTA PARA COBRAR» presente: ${m.rotuloQueFalta} · dice «te falta 0,00»: ${m.diceFaltaCero}`);
    console.log(`   «Incluir precios en el parte» presente: ${m.incluirPrecios}`);
    console.log(`   aviso firmado de SCRUM-887 presente: ${m.aviso887}`);
    console.log('');
  }
  await page.close();
}

await nav.close();
await banco.cerrar();

console.log(`SUELO: ${suelo} casos no se pudieron medir.`);
console.log(`EXIT=${suelo ? 2 : 0}`);
process.exit(suelo ? 2 : 0);
