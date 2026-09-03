// public/dashboard/js/parteOficinaView.js — sprint Tecnosel, fila 5
//
// LA PANTALLA DE LA OFICINA: donde el jefe pone los precios de un parte YA FIRMADO.
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────────────────
// El técnico cierra el parte en la obra SIN importes —eso es el diseño, y por eso su móvil no
// recibe ni un precio—. Los precios los pone la oficina después. Hasta ahora no había dónde: el
// parte llegaba firmado y sin valorar, y sin valorar no se cobra.
//
// ── 🔴 ES OTRA VISTA, NO UN MODO DE LA DEL TÉCNICO ───────────────────────────────────────
// Dos públicos distintos del mismo documento. La del técnico se sirve con
// `serializeParteParaElTecnico`, escrito campo a campo para que el dinero no cruce el cable al
// móvil; ésta se sirve con `serializeParteParaLaOficina`, por SU PROPIA ruta y admin-only. La
// separación es de RUTA y no de un `if`, para que nadie pueda invertirla sin darse cuenta.
//
// ── LO PRIMERO ES ENCONTRAR EL TRABAJO ───────────────────────────────────────────────────
// La pantalla abre por la lista de PENDIENTES DE VALORAR (`/oficina/pendientes`), no por un
// buscador: si el jefe no puede saber cuáles le faltan, la pantalla no sirve de nada.
//
// ⚠️ MICROCOPY SIN APROBAR (regla 30): todos los textos visibles salen de `MARCA_OFICINA`, UNA
// sola constante, así que aprobarlos es tocar un sitio. Van propuestos en `docs/master/SCRUM-685.md`.

/** El marcador único de esta pantalla. Aprobar el copy = tocar sólo esta constante. */
var MARCA_OFICINA = '[PENDIENTE microcopy oficial]';

function parteOficinaEuros(n) {
  if (n === null || n === undefined) return '—';
  return fmtMoneyEs(n, (window.appLocale && window.appLocale.currency) || 'EUR');
}

/** La pantalla: la lista de lo que falta por valorar, y el parte elegido al lado. */
async function renderPartesOficinaView(container, opts) {
  container.innerHTML =
    '<div style="max-width:960px">'
    + '<div class="customers-card" style="margin-bottom:16px">'
    + '<h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">'
    + 'Partes por valorar</h2>'
    + '<p style="margin:0;font-size:13px;color:var(--muted)">'
    + 'Los partes que tu equipo ya ha firmado y todavía no tienen precios.</p>'
    + '</div>'
    + '<div id="po-lista"></div>'
    + '<div id="po-detalle" style="margin-top:16px"></div>'
    + '</div>';

  const lista = document.getElementById('po-lista');
  const detalle = document.getElementById('po-detalle');
  uiSkeletonCards(lista, 3);

  let datos;
  try {
    datos = await apiRequest('/admin/partes/oficina/pendientes');
  } catch (e) {
    uiErrorState(lista, 'No se han podido cargar los partes',
      function () { renderPartesOficinaView(container, opts); });
    return;
  }

  const pendientes = (datos && datos.pendientes) || [];
  const leidos = datos && typeof datos.firmadosLeidos === 'number' ? datos.firmadosLeidos : null;

  if (!pendientes.length) {
    // 🔴 CERO NO ES UNA SOLA COSA, y aquí se distinguen las dos: «no queda ninguno» es una buena
    // noticia; «no he podido leerlos» es una avería que no se puede pintar como una buena noticia.
    // El servidor manda `firmadosLeidos` justo para esto.
    var texto = leidos === null
      ? 'No se han podido leer tus partes firmados — vuelve a intentarlo'
      : 'No te queda ningún parte por valorar.';
    lista.innerHTML = '<div class="customers-card"><div class="empty-state">'
      + '<div class="empty-state-icon">' + (leidos === null ? '⚠️' : '✅') + '</div>'
      + '<div class="empty-state-title">' + escHtml(texto) + '</div></div></div>';
    return;
  }

  lista.innerHTML = '';
  pendientes.forEach(function (p) {
    const fila = document.createElement('div');
    fila.className = 'customers-card';
    fila.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;'
      + 'padding:12px 14px;margin-bottom:8px;cursor:pointer';
    fila.innerHTML =
      '<div><div style="font-weight:700;color:var(--ink)">' + escHtml(p.numero || ('#' + p.id)) + '</div>'
      + '<div style="font-size:12.5px;color:var(--muted)">'
      + escHtml([p.clienteNombre, p.obra].filter(Boolean).join(' · ') || '—') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--muted)">' + escHtml(String(p.lineas.length)) + ' ⚬</div>';
    fila.addEventListener('click', function () { pintarParte(p.id, detalle, container, opts); });
    lista.appendChild(fila);
  });
}

/**
 * El parte elegido, con sus dos bloques y una casilla de precio por línea.
 *
 * `yaTraido` evita una segunda vuelta a la red tras guardar: el PATCH ya contesta con la vista
 * de oficina, que es exactamente lo que esta pantalla necesita.
 */
async function pintarParte(id, detalle, container, opts, yaTraido) {
  detalle.innerHTML = '';
  uiSkeletonCards(detalle, 1);

  let parte = yaTraido || null;
  if (!parte) {
    try {
      parte = await apiRequest('/admin/partes/' + id + '/oficina');
    } catch (e) {
      uiErrorState(detalle, MARCA_OFICINA + ' No hemos podido abrir el parte.',
        function () { pintarParte(id, detalle, container, opts); });
      return;
    }
  }

  detalle.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'customers-card';
  detalle.appendChild(card);

  const cab = document.createElement('div');
  cab.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px';
  cab.innerHTML =
    '<div><div style="font-weight:700;font-size:16px;color:var(--ink)">' + escHtml(parte.numero) + '</div>'
    + '<div style="font-size:12.5px;color:var(--muted)">'
    + escHtml([parte.clienteNombre, parte.obra].filter(Boolean).join(' · ') || '—') + '</div></div>'
    + '<div id="po-total" style="font-weight:700;font-size:18px;color:var(--ink)"></div>';
  card.appendChild(cab);

  // 🔴 SI EL PARTE YA ESTÁ FACTURADO, NO SE OFRECE TOCAR NADA. El candado lo decide el servidor y
  // viaja resuelto (`puedeEditarPrecios`): la pantalla no vuelve a decidir la regla — dos sitios
  // decidiendo lo mismo acaban discrepando, y el que se equivoca es el de la pantalla.
  const editable = !!(parte.puedeEditarPrecios && parte.puedeEditarPrecios.ok);
  if (!editable) {
    const aviso = document.createElement('p');
    aviso.className = 'alert';
    aviso.textContent = 'Este parte ya está facturado: sus precios no se tocan. '
      + (parte.puedeEditarPrecios && parte.puedeEditarPrecios.motivo ? parte.puedeEditarPrecios.motivo : '');
    card.appendChild(aviso);
  }

  const entradas = [];
  // LOS DOS BLOQUES DEL PAPEL, y en su orden. Una línea sin bloque cae en el primero.
  [['mano_obra', 'Mano de obra'], ['materiales', 'Materiales']]
    .forEach(function (par, i) {
      const clave = par[0];
      const deEsteBloque = parte.lineas
        .map(function (l, indice) { return { l: l, indice: indice }; })
        .filter(function (x) {
          return i === 0 ? (x.l.bloque !== 'materiales') : (x.l.bloque === 'materiales');
        });
      if (!deEsteBloque.length) return;

      const h = document.createElement('div');
      h.style.cssText = 'font-size:11.5px;color:var(--muted);font-weight:700;text-transform:uppercase;'
        + 'letter-spacing:.04em;margin:14px 0 6px';
      h.textContent = par[1];
      card.appendChild(h);

      deEsteBloque.forEach(function (x) {
        const f = document.createElement('div');
        f.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;'
          + 'border-bottom:1px solid var(--neutral-200)';
        f.innerHTML =
          '<div style="flex:1;font-size:13px;color:var(--ink)">' + escHtml(x.l.descripcion || '—') + '</div>'
          + '<div style="width:60px;text-align:right;font-size:13px;color:var(--muted)">'
          + escHtml(x.l.unds === null ? '—' : String(x.l.unds)) + '</div>';
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '0.01';
        inp.min = '0';
        inp.style.cssText = 'width:110px;text-align:right';
        inp.value = x.l.precioUnitario === null ? '' : String(x.l.precioUnitario);
        inp.disabled = !editable;
        inp.setAttribute('aria-label', 'Precio por unidad');
        const imp = document.createElement('div');
        imp.style.cssText = 'width:100px;text-align:right;font-size:13px;font-weight:600;color:var(--ink)';
        imp.textContent = parteOficinaEuros(x.l.importe);
        f.appendChild(inp);
        f.appendChild(imp);
        card.appendChild(f);
        entradas.push({ indice: x.indice, input: inp, importe: imp, unds: x.l.unds });
      });
    });

  function repintarTotal() {
    let t = 0;
    entradas.forEach(function (e) {
      const p = e.input.value === '' ? null : Number(e.input.value);
      const i = p === null || e.unds === null || !Number.isFinite(p * e.unds) ? null : p * e.unds;
      e.importe.textContent = parteOficinaEuros(i === null ? null : Math.round(i * 100) / 100);
      t += i || 0;
    });
    document.getElementById('po-total').textContent = parteOficinaEuros(Math.round(t * 100) / 100);
  }
  entradas.forEach(function (e) { e.input.addEventListener('input', repintarTotal); });
  repintarTotal();

  if (!editable) return;

  const guardar = document.createElement('button');
  guardar.className = 'btn-primary';
  guardar.style.cssText = 'width:100%;margin-top:14px';
  guardar.textContent = 'Guardar precios';
  card.appendChild(guardar);

  guardar.onclick = function () {
    guardar.disabled = true;
    const precios = entradas.map(function (e) {
      return { indice: e.indice, precioUnitario: e.input.value === '' ? null : Number(e.input.value) };
    });
    apiRequest('/admin/partes/' + parte.id, {
      method: 'PATCH',
      body: JSON.stringify({ precios: precios }),
    }).then(function (actualizado) {
      // 🔴 SE REPINTA CON LO QUE DEVUELVE EL SERVIDOR, no con lo que había en la pantalla: es la
      // única forma de que el jefe vea LO QUE SE GUARDÓ y no lo que él tecleó. Si el servidor
      // hubiera redondeado o rechazado algo, aquí se ve.
      guardar.disabled = false;
      pintarParte(actualizado.id, detalle, container, opts, actualizado);
    }).catch(function () {
      guardar.disabled = false;
      uiErrorState(detalle, 'No se han podido guardar los precios',
        function () { pintarParte(parte.id, detalle, container, opts); });
    });
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPartesOficinaView: renderPartesOficinaView,
    MARCA_OFICINA: MARCA_OFICINA,
  };
}
