// public/dashboard/js/expensesView.js

// Los cinco colores de la píldora viven en `styles.css` (`.gasto-cat--<clave>`), no aquí: eran un
// `style=` en línea por fila (SCRUM-920c, norma A7). Son los de siempre; el profesional ya los reconoce.
const CATEGORY_LABELS = {
  materiales:     { label: 'Materiales' },
  desplazamiento: { label: 'Desplazamiento' },
  herramientas:   { label: 'Herramientas' },
  subcontrata:    { label: 'Subcontrata' },
  otros:          { label: 'Otros' },
};

// SCRUM-944 (punto 1) · UNA sola función decide cómo se nombra una categoría, y la usan la píldora de
// cada fila y el KPI «Mayor categoría». Antes el KPI caía a `top.category` y en pantalla salía la clave
// interna —«materials»—; la píldora ya caía a «Otros». Lo que no se reconoce es, por dominio, «otros»
// (la categoría comodín de `EXPENSE_CATEGORIES`): se dice con un nombre humano y nunca con la clave.
// Se pregunta por el HECHO —¿es una clave del mapa?— y no con `MAPA[k] || MAPA.otros`: así es un
// ternario sobre `hasOwnProperty`, que además no se traga `constructor` ni `__proto__`.
function categoriaDe(category) {
  const conocida = Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, category);
  const clave = conocida ? category : 'otros';
  return { clave, label: CATEGORY_LABELS[clave].label };
}

function catPill(category) {
  const c = categoriaDe(category);
  return `<span class="gasto-cat gasto-cat--${c.clave}">${c.label}</span>`;
}

// ── SCRUM-135: selector de Trabajos ───────────────────────────────────────────
// OJO AL MODELO (hallazgo del recon): el gasto se vincula por `Expense.quoteId` → COTIZACIÓN,
// mientras que lo que el pro ve en pantalla es el TRABAJO (`Job`), que tiene su PROPIO id.
// Job#57 y Cotización#57 son registros distintos. Antes había un input numérico rotulado "ID
// de la cotización" con un texto de ayuda que decía "vincula este gasto a un trabajo": quien
// leía "Trabajo #57" y tecleaba 57 vinculaba el gasto a otra cosa, en silencio.
// El selector resuelve el quoteId DESDE el Job, así que el valor guardado no cambia (aditivo,
// cero migración) pero el pro ya solo elige Trabajos por su nombre.
const JOB_CERRADO = 'cerrado'; // "abiertos" = todos menos este (decisión del fundador)

// El trabajo se nombra EXACTAMENTE como en la pantalla de Trabajos: su `titulo` y nada más.
// Sin prefijo con el id: jobsView.js no enseña el id del Job en ningún sitio, así que
// anteponerlo metería un número que el pro no ha visto nunca — y encima pegado al
// "Presupuesto #N" que ya lleva el título por defecto. Tres números distintos para una cosa
// es justo el lío que este ticket viene a quitar, no a mover de sitio.
function jobLabel(job) {
  return job.titulo || 'Trabajo';
}

// Un Job sin cotización (Job.quoteId es nullable) NO se puede vincular: no hay quoteId que
// guardar. Se muestra DESHABILITADO con el motivo, no se esconde — criterio de SCRUM-89:
// que el pro sepa por qué no puede, en vez de buscar un trabajo que no aparece.
function jobOptionsHtml(jobs, currentQuoteId) {
  const abiertos = (jobs || []).filter((j) => j.status !== JOB_CERRADO);
  const cur = currentQuoteId != null ? Number(currentQuoteId) : null;
  let hayActualEnLista = false;

  const opts = abiertos.map((j) => {
    const qId = j.quote?.id ?? null;
    const label = jobLabel(j);
    if (qId == null) {
      return `<option value="" disabled>${escHtml(label)} — sin presupuesto, no se puede vincular</option>`;
    }
    if (cur != null && Number(qId) === cur) hayActualEnLista = true;
    return `<option value="${qId}"${cur != null && Number(qId) === cur ? ' selected' : ''}>${escHtml(label)}</option>`;
  });

  // El gasto que estás editando puede apuntar a un trabajo CERRADO (o a una cotización que
  // nunca llegó a ser trabajo). Si no ofreciéramos esa opción, abrir el modal y guardar
  // movería la vinculación sin que nadie lo pidiera. Se conserva, marcada.
  if (cur != null && !hayActualEnLista) {
    opts.unshift(`<option value="${cur}" selected>Vinculación actual (trabajo cerrado o sin trabajo abierto)</option>`);
  }

  return `<option value="">— Sin trabajo —</option>` + opts.join('');
}

function gastoEl(etiqueta, clase, texto) {
  const n = document.createElement(etiqueta);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
}

// Un enlace de la fila. La fila entera abre el gasto, así que el enlace NO deja pasar el clic: sin
// `stopPropagation` pulsar el nombre del trabajo abriría además el modal de edición.
function enlaceDeGasto(texto, alPulsar) {
  const a = gastoEl('a', 'gasto-trab-enlace', texto);
  a.href = '#';
  a.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); alPulsar(); });
  return a;
}

// Celda "Trabajo" de la lista de gastos. Con Job → su nombre y enlace a SU ficha. Sin Job
// (gasto vinculado a un presupuesto que nunca se aceptó) → se dice tal cual y se enlaza al
// presupuesto: mejor nombrar lo que hay que fingir un trabajo que no existe. Sin presupuesto, el
// gasto está suelto y lo dice («Sin trabajo», firmado en SCRUM-920, com. 15992), no un «—».
function celdaTrabajo(expense) {
  const caja = gastoEl('div', 'gasto-trab');
  if (expense.job) {
    caja.appendChild(enlaceDeGasto(jobLabel(expense.job), () => renderAppView('jobs-detail', { jobId: expense.job.id })));
  } else if (expense.quote) {
    const qId = Number(expense.quote.id);
    caja.appendChild(enlaceDeGasto('Presupuesto sin trabajo', () => renderAppView('quotes-detail', { quoteId: qId })));
  } else {
    caja.appendChild(gastoEl('span', 'gasto-trab-suelto', 'Sin trabajo'));
  }
  if (expense.provider) caja.appendChild(gastoEl('span', 'gasto-trab-prov', expense.provider.name));
  return caja;
}

// SCRUM-920d · lo que la lista recuerda entre pulsaciones: los gastos que llegaron (mes + categoría, que
// filtra el servidor) y los dos filtros que se hacen AQUÍ, sobre esos gastos: el trabajo y la foto. Se
// reinicia en cada `renderExpensesView`: entrar en Gastos empieza sin filtros, como siempre.
const TRABAJO_SUELTO = 'sin-trabajo';
let gastosVista = { items: [], job: '', foto: 'todos' };

async function renderExpensesView(container) {
  gastosVista = { items: [], job: '', foto: 'todos' };
  // ⚠️ Los comentarios de esta plantilla van FUERA de ella o sin acentos graves: uno solo cierra el literal.
  container.innerHTML = `
    <div class="gastos-pantalla">
      <!-- Cabecera: el título y, a la derecha, las acciones -->
      <div class="gastos-cabecera">
        <div class="gastos-titulo">
          <h2>Gastos</h2>
          <p>Controla tus costes y vincúlalos a trabajos para ver el margen real.</p>
        </div>
        <div class="gastos-acciones">
          <div class="gastos-barra">
            <button class="btn-primary gastos-nuevo" id="exp-new-btn">Nuevo gasto</button>
          </div>
          <a id="exp-export-btn" href="/admin/exports/expenses.csv" class="btn-secondary btn-sm" title="Exportar gastos filtrados a CSV">⬇ CSV</a>
        </div>
      </div>

      <!-- Resumen mensual: los tres KPI de siempre, con sus rótulos y sus cuentas -->
      <div id="exp-summary" class="gastos-kpis">
        <div class="gasto-kpi"><div class="gasto-kpi-rotulo">Cargando…</div></div>
        <div class="gasto-kpi"><div class="gasto-kpi-rotulo"></div></div>
        <div class="gasto-kpi"><div class="gasto-kpi-rotulo"></div></div>
      </div>

      <!-- Filtros: mes y categoría (los resuelve el servidor), trabajo y foto (los resuelve esta pantalla) -->
      <div class="gastos-filtros">
        <select id="exp-filter-month" class="input gastos-filtro-mes">
          ${getMonthOptions()}
        </select>
        <select id="exp-filter-cat" class="input">
          <option value="">Todas las categorías</option>
          ${Object.entries(CATEGORY_LABELS).map(([v,c]) => `<option value="${v}">${c.label}</option>`).join('')}
        </select>
        <select id="exp-filter-job" class="input" aria-label="Trabajo">
          <option value="">Todos los trabajos</option>
        </select>
        <button type="button" class="gastos-chip" data-foto="todos" aria-pressed="true">Todos<span class="gastos-chip-n"></span></button>
        <button type="button" class="gastos-chip" data-foto="sinfoto" aria-pressed="false">Sin foto<span class="gastos-chip-n"></span></button>
      </div>

      <!-- Lista -->
      <div id="exp-list"><div class="gastos-cargando">Cargando gastos…</div></div>
    </div>
  `;

  // SCRUM-769 · el rótulo del botón de arriba está FIRMADO por el fundador el 6-sep-2026: se
  // retira el «+ » y queda «Nuevo gasto», el mismo patrón que el resto de las listas. El texto
  // escrito en el marcado es el RESPALDO por si la pieza del atajo no ha cargado; el que manda es
  // atajoNuevo.TEXTOS.expenses, y `etiquetar` lo pisa aquí abajo.
  //
  // ⚠️ Esta explicación va FUERA de la plantilla y no dentro, como comentario HTML: la primera
  // versión la puso dentro y llevaba acentos graves, que CIERRAN el literal de plantilla. El
  // fichero dejó de parsear, `renderExpensesView` dejó de publicarse y la vista desapareció del
  // censo — que es un falso verde con forma de progreso. Lo cazó el propio censo al ver bajar la
  // población de 26 a 25.
  const expNuevoBtn = document.getElementById('exp-new-btn');
  expNuevoBtn.addEventListener('click', () => openExpenseModal(null));
  // SCRUM-769 · el atajo «N», por el MISMO mecanismo que las otras (SCRUM-599): `etiquetar` pone
  // el rótulo firmado y la tecla, `registrar` dice qué abre la «N» estando en esta pantalla. Nada
  // se reimplementa aquí — es el defecto que SCRUM-768 quitó de `invoicesView`.
  //
  // Encaja en el patrón porque este botón ABRE el modal de alta (`openExpenseModal(null)`), no
  // confirma una creación ya escrita.
  if (window.atajoNuevo) {
    window.atajoNuevo.etiquetar(expNuevoBtn, 'expenses');
    window.atajoNuevo.registrar('expenses', () => expNuevoBtn.click());
  }

  // SCRUM-324 (E3) · EL AVISO DEL SIMPLIFICADO NO SE ENCIENDE, y el hueco se declara aquí.
  //
  // Decir «con un ticket no puedes deducir el IVA» es una AFIRMACIÓN FISCAL, y el producto no
  // hace afirmaciones fiscales sin el asesor (decisión del fundador, 10-ago-2026). Las tres
  // versiones candidatas viven en `docs/legal/PREGUNTAS_ASESOR.md:539-542` como preguntas SIN
  // responder — no como texto pendiente de pegar.
  //
  // Y tampoco queda un contenedor vacío esperándolas: un `<div>` mudo es un enlace construido que
  // no se pinta nunca (SCRUM-424) un paso antes, y encima invita a que alguien lo rellene sin
  // aprobación. El día que haya frase, el div cuesta una línea.
  //
  // El motor SÍ está conectado: la ruta devuelve `justificante.veredicto`. Lo que falta es la
  // frase, no el mecanismo.

  function updateExportLink() {
    const monthSel = document.getElementById('exp-filter-month');
    const catSel   = document.getElementById('exp-filter-cat');
    const expBtn   = document.getElementById('exp-export-btn');
    if (!monthSel || !expBtn) return;
    const [y, m] = (monthSel.value || '').split('-');
    const params = new URLSearchParams();
    if (y && m) {
      params.set('from', `${y}-${m}-01`);
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      params.set('to', `${y}-${m}-${lastDay}`);
    }
    if (catSel && catSel.value) params.set('category', catSel.value);
    expBtn.href = `/admin/exports/expenses.csv?${params.toString()}`;
  }

  document.getElementById('exp-filter-month').addEventListener('change', () => { updateExportLink(); loadExpenses(); });
  document.getElementById('exp-filter-cat').addEventListener('change',   () => { updateExportLink(); loadExpenses(); });
  // SCRUM-920d · el trabajo y la foto se filtran sobre los gastos que YA llegaron: no piden nada al servidor.
  // (El CSV de arriba lleva mes y categoría, que son los que filtra el servidor; estos dos no viajan.)
  document.getElementById('exp-filter-job').addEventListener('change', (ev) => { gastosVista.job = ev.target.value; pintarGastos(); });
  document.querySelectorAll('.gastos-chip').forEach((chip) => {
    chip.addEventListener('click', () => { gastosVista.foto = chip.dataset.foto; pintarGastos(); });
  });
  updateExportLink();

  await Promise.all([loadSummary(), loadExpenses()]);
}

function getMonthOptions() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    months.push(`<option value="${val}"${i===0?' selected':''}>${label}</option>`);
  }
  return months.join('');
}

async function loadSummary() {
  const month = document.getElementById('exp-filter-month')?.value || '';
  try {
    const data = await apiRequest(`/admin/expenses/summary?month=${month}`);
    const el = document.getElementById('exp-summary');
    if (!el) return;
    // Los tres KPI de siempre, con los mismos rótulos y las mismas cuentas. Sólo cambia el marcado:
    // a 390 px son UNA tarjeta de tres renglones (`styles.css`), no tres tarjetas que se comían la
    // primera pantalla antes de la primera fila. La tercera ya no lleva el `&nbsp;` de relleno.
    el.innerHTML = `
      <div class="gasto-kpi gasto-kpi--dinero">
        <div class="gasto-kpi-rotulo">Gasto del mes</div>
        <div class="gasto-kpi-valor">${fmtEuro(data.totalAmount)}</div>
        <div class="gasto-kpi-pie">${data.byCategory?.length || 0} categoría${data.byCategory?.length!==1?'s':''}</div>
      </div>
      <div class="gasto-kpi">
        <div class="gasto-kpi-rotulo">Sin asignar a trabajo</div>
        <div class="gasto-kpi-valor ${data.unassignedAmount>0?'gasto-kpi-valor--aviso':'gasto-kpi-valor--ok'}">${fmtEuro(data.unassignedAmount)}</div>
        <div class="gasto-kpi-pie">no vinculados a un trabajo</div>
      </div>
      <div class="gasto-kpi">
        <div class="gasto-kpi-rotulo">Mayor categoría</div>
        <div class="gasto-kpi-valor gasto-kpi-valor--texto">${topCat(data.byCategory)}</div>
      </div>
    `;
  } catch {}
}

// SCRUM-944 (punto 1) · el nombre humano de la categoría con más gasto; nunca la clave interna
// (antes: «materials» en pantalla). Ordena una COPIA: `sort` sobre `data.byCategory` lo reordenaba.
function topCat(cats) {
  if (!cats || !cats.length) return '—';
  const top = [...cats].sort((a,b) => b.amount - a.amount)[0];
  return categoriaDe(top.category).label;
}

async function loadExpenses() {
  const month = document.getElementById('exp-filter-month')?.value || '';
  const cat   = document.getElementById('exp-filter-cat')?.value   || '';
  const el = document.getElementById('exp-list');
  if (!el) return;
  uiSkeletonCards(el, 4); // A6.2: esqueleto en vez de "Cargando…"
  try {
    const qs = new URLSearchParams({ month });
    if (cat) qs.set('category', cat);
    // SCRUM-135: el trabajo de cada gasto viene YA resuelto en `item.job` (una sola query en
    // listExpenses). Nada de pedir /admin/jobs aquí: eso dejaba la lista esperando por el
    // endpoint más lento solo para poder nombrar la columna.
    const data = await apiRequest(`/admin/expenses?${qs}`);
    gastosVista.items = data.items || [];
    opcionesDeTrabajo(gastosVista.items);
    pintarGastos();
  } catch (err) {
    el.innerHTML = `<div class="gastos-error">Error: ${err.message}</div>`;
  }
}

// SCRUM-920d · el filtro por trabajo ofrece los trabajos QUE TIENEN gastos en la lista que llegó (no pide
// `/admin/jobs`: el trabajo de cada gasto ya viene resuelto en `item.job`, SCRUM-135), más «Todos los
// trabajos» y «Sin trabajo». Si el trabajo elegido ya no está (otro mes, otra categoría), vuelve a «Todos».
function opcionesDeTrabajo(items) {
  const sel = document.getElementById('exp-filter-job');
  if (!sel) return;
  const trabajos = new Map();
  items.forEach((e) => { if (e.job && !trabajos.has(String(e.job.id))) trabajos.set(String(e.job.id), jobLabel(e.job)); });
  const ordenados = [...trabajos].sort((a, b) => a[1].localeCompare(b[1], 'es', { numeric: true }));
  sel.replaceChildren(
    new Option('Todos los trabajos', ''),
    new Option('Sin trabajo', TRABAJO_SUELTO),
    ...ordenados.map(([id, titulo]) => new Option(titulo, id)),
  );
  if (gastosVista.job !== '' && gastosVista.job !== TRABAJO_SUELTO && !trabajos.has(gastosVista.job)) gastosVista.job = '';
  sel.value = gastosVista.job;
}

function coincideTrabajo(e, job) {
  if (job === '') return true;
  if (job === TRABAJO_SUELTO) return !e.job;
  return !!e.job && String(e.job.id) === job;
}

// La suma en CÉNTIMOS: sumar decimales sueltos deja «0,30000000000000004» en el peor renglón.
function sumaDeGastos(gastos) {
  return gastos.reduce((a, e) => a + Math.round(Number(e.amount) * 100), 0) / 100;
}

function conNumero(n, singular, plural) {
  return n + ' ' + (n === 1 ? singular : plural);
}

// Pinta la lista con los dos filtros de esta pantalla puestos. La cuenta de cada chip es la de lo que verás
// al pulsarlo: cuenta sobre los gastos ya filtrados por trabajo, y no sobre todo el mes.
function pintarGastos() {
  const el = document.getElementById('exp-list');
  if (!el) return;
  const { items, job, foto } = gastosVista;
  const cat = document.getElementById('exp-filter-cat')?.value || '';

  const delTrabajo = items.filter((e) => coincideTrabajo(e, job));
  const sinFoto = delTrabajo.filter((e) => !e.tieneFoto);
  const visibles = foto === 'sinfoto' ? sinFoto : delTrabajo;
  document.querySelectorAll('.gastos-chip').forEach((chip) => {
    const n = chip.dataset.foto === 'sinfoto' ? sinFoto.length : delTrabajo.length;
    chip.querySelector('.gastos-chip-n').textContent = ' · ' + n;
    chip.setAttribute('aria-pressed', String(chip.dataset.foto === foto));
  });

  // Sin ningún filtro que lo explique, el mes está vacío: el estado vacío de siempre, palabra por palabra.
  if (!items.length && !cat) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>'
      + '<div class="empty-state-title">Sin gastos este mes</div>'
      + '<div class="empty-state-desc">Registra materiales, desplazamientos y subcontratas para conocer el margen real de cada trabajo.</div>'
      + '<button id="exp-empty-cta" class="btn-primary btn-sm gastos-vacio-cta">+ Añadir mi primer gasto</button></div>';
    const cta = document.getElementById('exp-empty-cta');
    if (cta) cta.addEventListener('click', () => openExpenseModal(null));
    return;
  }

  // Con un filtro puesto y nada que enseñar: se dice, y hay una salida.
  if (!visibles.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div>'
      + '<div class="empty-state-title">Ningún gasto con esos filtros</div>'
      + '<div class="empty-state-desc">Prueba con otro mes, otra categoría u otro trabajo.</div>'
      + '<button id="exp-quitar-filtros" class="btn-secondary btn-sm gastos-vacio-cta">Quitar los filtros</button></div>';
    document.getElementById('exp-quitar-filtros').addEventListener('click', quitarFiltrosDeGastos);
    return;
  }

  // La cabecera del mes: el mes y la cuenta de lo que se ve. Con un filtro puesto es OTRA cifra que la del
  // KPI, así que se dice qué es; sin filtros la suma sería la del KPI y no se repite (sale una sola vez).
  const filtrando = !!cat || job !== '' || foto !== 'todos';
  const mesSel = document.getElementById('exp-filter-month');
  const mesNombre = (mesSel?.selectedOptions[0]?.textContent || '').trim();
  const cabecera = gastoEl('div', 'gastos-mes');
  cabecera.appendChild(gastoEl('b', null, mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)));
  cabecera.appendChild(gastoEl('span', 'gastos-mes-n', '· ' + conNumero(visibles.length, 'gasto', 'gastos')));
  if (filtrando) {
    cabecera.appendChild(gastoEl('span', 'gastos-mes-suma', fmtEuro(sumaDeGastos(visibles))));
    cabecera.appendChild(gastoEl('span', 'gastos-mes-salvedad', 'Es la suma de lo que estás viendo, no la del mes.'));
  }

  // 🔴 SCRUM-920c · AQUÍ MUERE EL SCROLL LATERAL. Esto era un `<table style="min-width:600px">` dentro
  // de un `.table-scroll`: a 390 px las columnas sumaban 628 y había que ARRASTRAR la caja para ver el
  // importe. Ahora son filas en rejilla (`.gasto-fila`, `styles.css`): cinco columnas a escritorio y
  // tres renglones en móvil, sin desbordar. No se toca `.table-scroll .table`, que es de otros usos.
  const lista = gastoEl('div', 'gastos-filas');
  lista.setAttribute('role', 'list');
  visibles.forEach((e) => lista.appendChild(filaDeGasto(e)));
  el.replaceChildren(cabecera, lista);
}

// «Quitar los filtros» los quita TODOS: trabajo y foto (de esta pantalla) y categoría (del servidor, que
// vuelve a pedir el mes entero por el mismo camino que si la hubieras cambiado tú a mano).
function quitarFiltrosDeGastos() {
  gastosVista.job = '';
  gastosVista.foto = 'todos';
  const sel = document.getElementById('exp-filter-job');
  if (sel) sel.value = '';
  const cat = document.getElementById('exp-filter-cat');
  if (cat && cat.value) {
    cat.value = '';
    cat.dispatchEvent(new Event('change'));
  } else {
    pintarGastos();
  }
}

// Una fila de la lista. Tocar la fila abre el gasto (el modal de edición, hasta que exista el detalle);
// el enlace del trabajo y el «⋯» NO la abren. Todo lo que se puede hacer con un gasto está en su «⋯»:
// la papelera de 21 × 29 px que iba pegada a una fila que navega ya no es un botón suelto (AB3).
function filaDeGasto(e) {
  const fila = gastoEl('div', 'gasto-fila');
  fila.setAttribute('role', 'listitem');
  fila.dataset.gastoId = String(e.id);

  const que = gastoEl('div', 'gasto-que');
  que.appendChild(gastoEl('b', null, e.concept));
  if (e.notes) que.appendChild(gastoEl('span', 'gasto-notas', e.notes));
  que.appendChild(gastoEl('span', 'gasto-fecha', new Date(e.date).toLocaleDateString('es', { day: '2-digit', month: 'short' })));

  // SCRUM-920d · la foto del ticket, a la vista en cada fila: un hecho sobre el archivo (`tieneFoto`, que da
  // la lista sin traer la foto: SCRUM-964). SIN miniatura: `GET /admin/expenses/:id/foto` sirve la foto
  // ENTERA (hasta 1,1 MiB, `no-store`), y una `<img>` por fila serían N descargas de ese tamaño.
  const meta = gastoEl('div', 'gasto-meta');
  meta.innerHTML = catPill(e.category);
  meta.appendChild(gastoEl('span', 'gasto-foto ' + (e.tieneFoto ? 'gasto-foto--si' : 'gasto-foto--no'), e.tieneFoto ? 'Foto guardada' : 'Sin foto'));

  const imp = gastoEl('div', 'gasto-imp', fmtEuro(Number(e.amount)));

  // Cada opción CAMBIA EL ESTADO al pulsarla (es el defecto con el que se publicó 917): el guard
  // `guard:lista-gastos` las pulsa una a una con el ratón.
  const opciones = [];
  const opcion = (texto, clase, alPulsar) => {
    const b = gastoEl('button', 'btn-ghost btn-sm' + (clase ? ' ' + clase : ''), texto);
    b.type = 'button';
    b.addEventListener('click', alPulsar);
    opciones.push(b);
  };
  opcion('Editar', '', () => openExpenseModal(e));
  if (e.job) opcion('Ver trabajo', '', () => renderAppView('jobs-detail', { jobId: e.job.id }));
  opcion('🗑 Eliminar', 'gasto-opcion-eliminar', () => deleteExpenseItem(e.id));
  const mas = gastoEl('div', 'gasto-mas');
  mas.appendChild(overflowMenu(opciones, { label: 'Más acciones de ' + e.concept }));

  fila.append(que, meta, celdaTrabajo(e), imp, mas);
  fila.addEventListener('click', (ev) => {
    if (ev.target.closest('a, button')) return;
    openExpenseModal(e);
  });
  return fila;
}

async function deleteExpenseItem(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  try {
    await apiRequest(`/admin/expenses/${id}`, { method: 'DELETE' });
    await Promise.all([loadSummary(), loadExpenses()]);
  } catch (err) {
    showToast('No se pudo eliminar: ' + err.message, 'error');
  }
}

// opts (SCRUM-135, ambos opcionales — sin ellos el modal se comporta igual que antes):
//   opts.job     → { id, quoteId, titulo } : abre el gasto YA vinculado a ESE trabajo y sin
//                  selector (es el alta desde la ficha del Trabajo: no se pregunta lo que ya
//                  se sabe). Es el camino del técnico en obra.
//   opts.onSaved → qué recargar al guardar. Por defecto recarga la vista de Gastos, que es
//                  lo que hacía antes; desde el detalle del Trabajo no existe esa vista.
function openExpenseModal(expense, opts) {
  if (document.getElementById('exp-modal')) return;

  const o = opts || {};
  const fixedJob = o.job || null;
  const isEdit = !!expense;
  const today = new Date().toISOString().slice(0, 10);

  // SCRUM-964 · LA VISTA PREVIA DEL TICKET SE PIDE POR SU RUTA, no viene en la fila de la lista.
  // La lista traía la foto de CADA gasto —medido: 300 MiB con la página llena— para que este modal
  // enseñara UNA. Ahora la lista dice `tieneFoto` y la imagen la sirve
  // `GET /admin/expenses/<id>/foto`, con la cookie de sesión, que viaja sola por ser same-origin.
  // Mismo sitio, mismo tamaño y mismos estilos que antes: no hay cambio visual. El `onerror` la
  // quita en vez de dejar el icono de imagen rota — sin texto nuevo, que tendría que ir firmado.
  //
  // ⚠️ Va AQUÍ FUERA y no como comentario HTML dentro de la plantilla, por lo mismo que el bloque
  // de SCRUM-769 de más arriba: lleva acentos graves y dentro del literal lo CIERRAN. Escrito
  // dentro, el fichero dejaba de parsear y la vista desaparecía — lo cazó `public-js-parsea`.
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-overlay';
  backdrop.id = 'exp-modal';
  // SCRUM-1155 (920f) · EL ALTA REDISEÑADA: foto primero. `hayFotoDeEntrada` es la única rama que
  // distingue alta de edición en este paso — con foto ya guardada se nace en el estado «Foto
  // guardada»; sin ella, en el de elegir. Los pasos 2 y 3 NO son un asistente que oculta pasos: los
  // tres se pintan a la vez (regla de la casa: «el alta sigue siendo MODAL», SCRUM-920 comentario
  // 15992) — «1/2/3» son cabeceras que organizan el scroll, no páginas que se turnan.
  const hayFotoDeEntrada = !!expense?.tieneFoto;
  backdrop.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-body" style="gap:12px">

        <!-- ── 1 · LA FOTO DEL TICKET ────────────────────────────────────────────────────────── -->
        <div class="field">
          <label style="font-weight:700">${TEXTO_PASO1_TITULO}</label>
          <p style="margin:2px 0 8px;font-size:12.5px;color:var(--muted)">${TEXTO_PASO1_AYUDA}</p>
          <label style="font-size:13px" for="exp-receipt">${TEXTO_HAZ_LA_FOTO}</label>

          <div id="exp-foto-elegir" style="display:${hayFotoDeEntrada ? 'none' : 'flex'};gap:8px;flex-wrap:wrap;margin-top:6px">
            <input type="file" id="exp-receipt-camara" accept="image/*" capture="environment" style="display:none"/>
            <button type="button" id="exp-btn-camara" class="btn btn-primary btn-sm">${TEXTO_HACER_FOTO}</button>
            <input type="file" id="exp-receipt" accept="image/*" style="display:none"/>
            <button type="button" id="exp-btn-archivo" class="btn-secondary btn-sm">${TEXTO_ELEGIR_FOTO}</button>
            <button type="button" id="exp-btn-sin-foto" class="btn-ghost btn-sm">${TEXTO_SIN_TICKET}</button>
          </div>

          <div id="exp-foto-elegida" style="display:${hayFotoDeEntrada ? 'block' : 'none'};margin-top:6px">
            <!-- SIN src="" cuando no hay foto: un src vacío hace que el navegador pida la página
                 actual COMO imagen (404 de sobra evitable). Sin foto de entrada, el atributo no se
                 escribe; mostrarFotoElegida/FileReader lo rellenan al elegir una nueva. -->
            <img id="exp-foto-preview" ${hayFotoDeEntrada ? `src="/admin/expenses/${expense.id}/foto"` : ''} alt=""
                 onerror="this.style.display='none'"
                 style="display:${hayFotoDeEntrada ? 'block' : 'none'};max-width:100%;max-height:120px;border-radius:8px;object-fit:contain;border:1px solid var(--neutral-200);margin-bottom:6px"/>
            <p style="margin:0;font-size:12.5px;color:var(--body);font-weight:600">${TEXTO_FOTO_GUARDADA}</p>
            <p style="margin:2px 0 8px;font-size:11.5px;color:var(--neutral-400)">${TEXTO_FOTO_MAL_LEIDA}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" id="exp-foto-ver" class="btn-ghost btn-sm" style="display:${hayFotoDeEntrada ? 'inline-block' : 'none'}">${TEXTO_FOTO_VERLA}</button>
              <button type="button" id="exp-foto-quitar" class="btn-ghost btn-sm">${TEXTO_FOTO_QUITARLA}</button>
              <!-- SCRUM-1038 · rellena los campos de abajo con lo que la IA lee en la foto. Único
                   mecanismo de lectura de la pantalla (SCRUM-1155 lo reconcilia con este paso;
                   antes vivía suelto junto al campo de fichero). Texto firmado, ver la constante. -->
              <button type="button" id="exp-leer-ticket" class="btn-secondary btn-sm" style="display:none">${TEXTO_LEER_TICKET}</button>
            </div>
          </div>
          <!-- SCRUM-324 (E3) · TEXTO OFICIAL APROBADO (regla 30, fundador 10-ago-2026); F1 de la
               17002 lo reubica «de abajo» porque la foto sube al paso 1. -->
          <p style="margin:8px 0 0;font-size:12.5px;color:var(--muted)">${TEXTO_F1_FOTO_ES_COPIA}</p>
        </div>

        <!-- ── 2 · QUÉ ES Y CUÁNTO ───────────────────────────────────────────────────────────── -->
        <div class="field">
          <label style="font-weight:700">${TEXTO_PASO2_TITULO}</label>
        </div>
        <div class="field">
          <label>Concepto *</label>
          <input id="exp-concept" type="text" placeholder="Ej: Tubería PVC 20mm" value="${escHtml(expense?.concept||'')}"/>
          <div class="gasto-descarte" data-para="exp-concept" hidden></div>
        </div>
        <div class="field">
          <label>Importe *</label>
          <input id="exp-amount" type="number" min="0" step="0.01" placeholder="0.00" value="${expense?.amount||''}"/>
          <div class="gasto-descarte" data-para="exp-amount" hidden></div>
        </div>
        <p style="margin:0;font-size:12.5px;color:var(--green-700,#15803d);font-weight:600">${TEXTO_PASO2_BASTA}</p>

        <!-- ── 3 · DATOS DE LA FACTURA DEL PROVEEDOR (opcional) ─────────────────────────────────
             SCRUM-324 (E3) · EL DESGLOSE, que es lo que convierte un apunte en un ASIENTO. «Importe»
             es el TOTAL con IVA. Sin base, tipo y cuota, el libro de facturas recibidas EXCLUYE el
             gasto («libroRecibidas.ts:98»). Los tres son OPCIONALES: sin ellos se guarda igual. -->
        <div class="field">
          <label style="font-weight:700">${TEXTO_PASO3_TITULO} <span style="font-weight:400;color:var(--neutral-400)">(${TEXTO_OPCIONAL})</span></label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div class="field">
            <label>Base imponible</label>
            <input id="exp-base" type="number" min="0" step="0.01" placeholder="0.00" value="${expense?.baseAmount ?? ''}"/>
            <div class="gasto-descarte" data-para="exp-base" hidden></div>
          </div>
          <div class="field">
            <label>Tipo de IVA</label>
            <!-- SCRUM-920 comentario 16175 punto 3 (21-sep-2026): ampliado de 21,10,4,0 a los
                 seis valores que el servidor ya admite, para no dejar un tipo leído (p.ej. 5 %)
                 sin sitio en el desplegable. Decisión ya tomada; se aplica aquí. -->
            <select id="exp-vatrate">
              <option value="">—</option>
              ${[0, 2, 4, 5, 10, 21].map((t) => `<option value="${t}"${Number(expense?.vatRate) === t ? ' selected' : ''}>${t}%</option>`).join('')}
            </select>
            <div class="gasto-descarte" data-para="exp-vatrate" hidden></div>
          </div>
          <div class="field">
            <label>Cuota de IVA</label>
            <input id="exp-vatamount" type="number" min="0" step="0.01" placeholder="0.00" value="${expense?.vatAmount ?? ''}"/>
            <div class="gasto-descarte" data-para="exp-vatamount" hidden></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>Nº de factura del proveedor</label>
            <input id="exp-provinvnum" type="text" placeholder="A-2026/114" value="${escHtml(expense?.providerInvoiceNumber||'')}"/>
            <div class="gasto-descarte" data-para="exp-provinvnum" hidden></div>
          </div>
          <div class="field">
            <label>Fecha de la factura</label>
            <input id="exp-provinvdate" type="date" value="${expense?.providerInvoiceDate ? String(expense.providerInvoiceDate).slice(0,10) : ''}"/>
            <div class="gasto-descarte" data-para="exp-provinvdate" hidden></div>
          </div>
          <div class="field">
            <label>Fecha</label>
            <input id="exp-date" type="date" value="${expense ? new Date(expense.date).toISOString().slice(0,10) : today}"/>
            <div class="gasto-descarte" data-para="exp-date" hidden></div>
          </div>
        </div>
        <div class="field">
          <label>Categoría</label>
          <select id="exp-category">
            ${Object.entries(CATEGORY_LABELS).map(([v,c]) =>
              `<option value="${v}"${expense?.category===v?' selected':''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Trabajo (opcional)</label>
          ${fixedJob
            ? `<div id="exp-job-fixed" data-quote-id="${fixedJob.quoteId}" style="padding:11px 13px;border:1px solid var(--neutral-200);border-radius:var(--r-md);background:var(--neutral-50);font-size:14px;color:var(--ink)">${escHtml(jobLabel(fixedJob))}</div>`
            : `<select id="exp-quoteid"><option value="">Cargando trabajos…</option></select>`}
          <p style="font-size:12px;color:var(--neutral-400);margin:2px 0 0">Vincula este gasto a un trabajo para calcular el margen.</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>Proveedor (opcional)</label>
            <select id="exp-providerid"><option value="">Cargando proveedores…</option></select>
          </div>
          <div class="field">
            <!-- SCRUM-324 (E3) · el tercero de los tres campos del momento. Se teclea aquí y se
                 guarda en la ficha del proveedor, que es donde vive: en el almacén no se entra a
                 una ficha. Si el proveedor ya tenía NIF, este campo lo muestra y no lo pisa. -->
            <label>NIF del proveedor</label>
            <!-- SCRUM-937b · sin proveedor el NIF no tiene dónde guardarse: el campo se bloquea y la
                 ayuda lo dice ANTES de teclear (texto firmado, SCRUM-937 comentario 15873). Nace
                 bloqueado; al llegar la lista de proveedores lo decide aplicarNifSegunProveedor. -->
            <input id="exp-provider-nif" type="text" inputmode="text" autocapitalize="characters"
                   placeholder="B12345678" value="${escHtml(expense?.provider?.taxId||'')}"
                   ${expense?.provider?.taxId ? 'data-origen="ficha"' : ''} readonly
                   aria-describedby="exp-nif-ayuda"/>
            <p id="exp-nif-ayuda" class="gasto-nif-ayuda"${expense?.providerId ? ' hidden' : ''}>${AYUDA_NIF_SIN_PROVEEDOR}</p>
            <div class="gasto-descarte" data-para="exp-provider-nif" hidden></div>
          </div>
        </div>
        <div class="field">
          <label>Notas</label>
          <textarea id="exp-notes" placeholder="Detalles adicionales…" style="height:60px;resize:vertical">${expense?.notes||''}</textarea>
        </div>
        <div id="exp-error" class="alert error" style="display:none"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="exp-cancel">Cancelar</button>
        <button class="btn btn-primary" id="exp-save">${isEdit ? 'Guardar cambios' : 'Añadir gasto'}</button>
      </div>
    </div>
  `;

  // SCRUM-446: la cabecera sale del constructor compartido.
  backdrop.querySelector('.modal').prepend(cabeceraModal({
    titulo: isEdit ? 'Editar gasto' : 'Nuevo gasto', idCierre: 'exp-close',
  }));
  document.body.appendChild(backdrop);

  document.getElementById('exp-close').addEventListener('click', closeExpModal);
  document.getElementById('exp-cancel').addEventListener('click', closeExpModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeExpModal(); });

  // SCRUM-324 (E3): los proveedores, por su nombre y no por un id numérico. Antes había que
  // teclear «ID del proveedor» — de pie en un almacén, nadie se sabe el 47. Mismo patrón que el
  // selector de trabajos, incluido el fallo: si la lista no carga NO se deja un desplegable vacío
  // que borre la vinculación al guardar.
  const provSel = document.getElementById('exp-providerid');
  const nifInput = document.getElementById('exp-provider-nif');
  const ayudaNif = document.getElementById('exp-nif-ayuda');
  // SCRUM-937b · el NIF según el proveedor elegido. Tres estados, y ninguno tira nada en silencio:
  //   · proveedor CON NIF en su ficha → se muestra el de la ficha y no se pisa (SCRUM-324 E3);
  //   · proveedor SIN NIF → se escribe, y el alta lo guarda en su ficha;
  //   · SIN proveedor → solo lectura y la ayuda firmada. Lo que ya se hubiera tecleado NO se borra:
  //     si se guarda así, el servidor dice `sin_proveedor` y el aviso B lo cuenta después.
  // `data-origen="ficha"` distingue el NIF que puso la ficha (se quita al cambiar de proveedor) del
  // que tecleó el profesional (se queda).
  function aplicarNifSegunProveedor() {
    const op = provSel.selectedOptions[0];
    const nifFicha = op ? (op.dataset.nif || '') : '';
    const hayProveedor = !!provSel.value;
    if (nifFicha) {
      nifInput.value = nifFicha;
      nifInput.dataset.origen = 'ficha';
      nifInput.readOnly = true;
    } else {
      if (nifInput.dataset.origen === 'ficha') { nifInput.value = ''; delete nifInput.dataset.origen; }
      nifInput.readOnly = !hayProveedor;
    }
    ayudaNif.hidden = hayProveedor;
  }
  if (provSel) {
    const actualProv = expense?.provider?.id ?? expense?.providerId ?? null;
    apiRequest('/admin/providers')
      .then((r) => {
        if (!document.getElementById('exp-modal')) return;
        const lista = Array.isArray(r) ? r : (r?.items || []);
        provSel.innerHTML = '<option value="">— Sin proveedor —</option>'
          + lista.map((pr) => `<option value="${pr.id}" data-nif="${escHtml(pr.taxId || '')}"`
            + `${pr.id === actualProv ? ' selected' : ''}>${escHtml(pr.name)}</option>`).join('');
        // Al elegir proveedor, su NIF se rellena solo: el que ya está guardado manda sobre lo que
        // se teclee con prisa, y así el usuario ve que ese proveedor ya está resuelto.
        provSel.addEventListener('change', aplicarNifSegunProveedor);
        aplicarNifSegunProveedor();
      })
      .catch(() => {
        if (!document.getElementById('exp-modal')) return;
        provSel.innerHTML = actualProv != null
          ? `<option value="${actualProv}" selected>Proveedor actual (no se pudo cargar la lista)</option>`
          : '<option value="">No se pudo cargar la lista de proveedores</option>';
        aplicarNifSegunProveedor();
      });
  }

  // ═══ SCRUM-1155 (920f) · EL PASO 1, CABLEADO — foto (cámara o archivo), lectura, descartes ═══
  // `POST /admin/expenses/leer-ticket` (SCRUM-912) devuelve `{ propuesta, descartados }` con los
  // MISMOS nombres de campo que este formulario manda al guardar. Aquí dentro de `openExpenseModal`
  // porque necesita `provSel`/`nifInput`/`aplicarNifSegunProveedor`, que son de este cierre.
  //
  // NO GUARDA NADA SOLO (AC#2 de SCRUM-1038): solo rellena los campos; el profesional revisa y
  // pulsa «Guardar» como siempre. Un fallo o una lectura vacía dejan el formulario tal cual estaba.
  //
  // 🔒 UN SOLO MECANISMO DE LECTURA. `exp-leer-ticket` es el mismo botón/texto de SCRUM-1038; lo
  // único que cambia en SCRUM-1155 es DÓNDE vive (paso 1, junto a la foto) y QUÉ dispara su
  // aparición (cualquiera de los dos file inputs, no solo uno).
  const inputCamara = document.getElementById('exp-receipt-camara');
  const inputArchivo = document.getElementById('exp-receipt');
  const btnCamara = document.getElementById('exp-btn-camara');
  const btnArchivo = document.getElementById('exp-btn-archivo');
  const btnSinFoto = document.getElementById('exp-btn-sin-foto');
  const cajaElegir = document.getElementById('exp-foto-elegir');
  const cajaElegida = document.getElementById('exp-foto-elegida');
  const preview = document.getElementById('exp-foto-preview');
  const btnVerla = document.getElementById('exp-foto-ver');
  const btnQuitarla = document.getElementById('exp-foto-quitar');
  const btnLeerTicket = document.getElementById('exp-leer-ticket');

  let fotoQuitada = false; // se envía `receiptData: null` al guardar si se quitó una foto YA guardada
  let previewEsDeUnaFotoNueva = false; // distingue la preview de un fichero recién elegido de la ya guardada

  function inputConFoto() {
    return (inputCamara && inputCamara.files && inputCamara.files[0]) ? inputCamara
      : (inputArchivo && inputArchivo.files && inputArchivo.files[0]) ? inputArchivo : null;
  }

  // `FileReader`, no `URL.createObjectURL`: esto SOLO es una preview de un ficherito ya elegido
  // (no la foto entera que se manda al guardar, que reduce aparte `fotoParaGuardar`), y así el
  // banco de pruebas —que shima `FileReader` para sus ficheros de mentira, no `createObjectURL`—
  // puede ejercitar el modal sin abrir un navegador real.
  function mostrarFotoElegida(file) {
    fotoQuitada = false;
    previewEsDeUnaFotoNueva = true;
    cajaElegir.style.display = 'none';
    cajaElegida.style.display = 'block';
    btnLeerTicket.style.display = 'inline-block';
    if (!file) { btnVerla.style.display = 'none'; return; }
    btnVerla.style.display = 'inline-block';
    const reader = new FileReader();
    reader.onload = () => { preview.src = reader.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  }

  // SCRUM-1038 (comentario 16241) · un `change` con `files` VACÍO —el navegador lo dispara al
  // cancelar el selector con una foto ya puesta— vuelve al estado de elegir, no se queda a medias
  // mostrando el botón de leer sobre un input sin fichero.
  function volverAElegir() {
    previewEsDeUnaFotoNueva = false;
    // Si YA había una foto guardada (edición) y no se quitó a propósito, cancelar el selector de
    // fichero la deja tal cual estaba — no la borra ni oculta lo que no ha cambiado.
    if (hayFotoDeEntrada && !fotoQuitada) return;
    preview.removeAttribute('src'); preview.style.display = 'none';
    cajaElegida.style.display = 'none';
    cajaElegir.style.display = 'flex';
    btnLeerTicket.style.display = 'none';
  }
  if (inputCamara && inputArchivo && btnCamara && btnArchivo) {
    btnCamara.addEventListener('click', () => inputCamara.click());
    btnArchivo.addEventListener('click', () => inputArchivo.click());
    inputCamara.addEventListener('change', () => {
      if (inputCamara.files[0]) { inputArchivo.value = ''; mostrarFotoElegida(inputCamara.files[0]); } else volverAElegir();
    });
    inputArchivo.addEventListener('change', () => {
      if (inputArchivo.files[0]) { inputCamara.value = ''; mostrarFotoElegida(inputArchivo.files[0]); } else volverAElegir();
    });
  }
  if (btnSinFoto && cajaElegir) {
    // «Ahora no tengo el ticket»: no es una acción irreversible ni cambia nada del formulario, solo
    // deja de invitar a hacer la foto — los pasos 2 y 3 ya están a la vista, siempre lo estuvieron.
    btnSinFoto.addEventListener('click', () => {
      cajaElegir.style.display = 'none';
      document.getElementById('exp-concept')?.focus();
    });
  }
  if (btnVerla) {
    // La foto YA guardada se abre por su URL de servidor (misma que la preview, en ese caso); la
    // recién elegida se abre por su `src` en data-URI, que `mostrarFotoElegida` ya dejó puesto.
    btnVerla.addEventListener('click', () => { if (preview.src) window.open(preview.src, '_blank', 'noopener'); });
  }
  if (btnQuitarla && cajaElegir && cajaElegida) {
    btnQuitarla.addEventListener('click', () => {
      if (hayFotoDeEntrada && !previewEsDeUnaFotoNueva) fotoQuitada = true; // era la foto YA guardada
      if (inputCamara) inputCamara.value = '';
      if (inputArchivo) inputArchivo.value = '';
      previewEsDeUnaFotoNueva = false;
      preview.removeAttribute('src'); preview.style.display = 'none';
      cajaElegida.style.display = 'none';
      cajaElegir.style.display = 'flex';
    });
  }

  // Los 9 porqués de la lectura (SCRUM-920 comentario 16175/920h). Se limpian en cada lectura nueva
  // ANTES de aplicar la siguiente: un campo que esta vez SÍ vino bien no puede arrastrar el aviso
  // de la lectura anterior.
  function limpiarDescartes() {
    document.querySelectorAll('.gasto-descarte').forEach((el) => { el.hidden = true; el.textContent = ''; });
  }
  function pintarDescartes(descartados) {
    for (const d of (descartados || [])) {
      const idInput = CAMPO_DESCARTE_A_INPUT[d.campo];
      const texto = MOTIVOS_DESCARTE_TEXTO[d.motivo];
      if (!idInput || !texto) continue; // campo/motivo que este modal no conoce: no se inventa aviso
      const el = document.querySelector(`.gasto-descarte[data-para="${idInput}"]`);
      if (!el) continue;
      el.hidden = false;
      el.textContent = texto;
      el.style.cssText = 'margin:2px 0 0;font-size:11.5px;color:var(--warn,#b45309)';
    }
  }

  if (btnLeerTicket) {
    function aplicarLecturaTicket(propuesta, descartados) {
      const p = propuesta || {};
      limpiarDescartes();
      // «Lectura vacía» (foto borrosa, sin texto, o que no es un ticket): AC#3/comentario 16241.
      // Si NINGÚN campo trajo nada, es indistinguible de un fallo para quien mira la pantalla, y
      // se avisa igual que un fallo en vez de dejar el modal mudo.
      if (Object.values(p).every((v) => v === null || v === undefined)) {
        showExpError(AVISO_LECTURA_TICKET_FALLIDA);
        return;
      }
      const setSiHay = (id, valor) => {
        if (valor === null || valor === undefined) return;
        const el = document.getElementById(id);
        if (el) el.value = valor;
      };
      setSiHay('exp-concept', p.concept);
      setSiHay('exp-amount', p.amount);
      setSiHay('exp-base', p.baseAmount);
      setSiHay('exp-vatrate', p.vatRate);
      setSiHay('exp-vatamount', p.vatAmount);
      setSiHay('exp-provinvnum', p.providerInvoiceNumber);
      setSiHay('exp-provinvdate', p.providerInvoiceDate);
      setSiHay('exp-date', p.date);
      pintarDescartes(descartados);

      // El proveedor, SOLO si el servidor ya lo emparejó por NIF (SCRUM-961b: nunca por nombre).
      // Si no hay proveedor pero sí NIF leído, se escribe en el campo (queda de solo lectura hasta
      // que se elija proveedor, igual que si se tecleara a mano: SCRUM-937b).
      if (p.providerId !== null && p.providerId !== undefined && provSel) {
        provSel.value = String(p.providerId);
        aplicarNifSegunProveedor();
      } else if (p.nifProveedor) {
        nifInput.value = p.nifProveedor;
      }
      // `proveedorNombre` (SCRUM-920 comentario 16173 punto 3): el servidor ya lo lee, pero
      // pintarlo con un texto propio es microcopy NUEVA sin firmar (regla 30). Se propone y se
      // para — no se inventa aquí. De momento el NIF sigue siendo el único camino para emparejar
      // proveedor tras la lectura.
    }

    btnLeerTicket.addEventListener('click', async () => {
      if (btnLeerTicket.disabled) return; // doble clic: SCRUM-1038 comentario 16241
      const file = inputConFoto() && inputConFoto().files[0];
      if (!file) return;
      const textoReposo = btnLeerTicket.textContent;
      btnLeerTicket.disabled = true;
      btnLeerTicket.textContent = TEXTO_LEYENDO_TICKET;
      try {
        const imagen = await fotoParaGuardar(file);
        const r = await apiRequest('/admin/expenses/leer-ticket', { method: 'POST', body: JSON.stringify({ imagen }) });
        aplicarLecturaTicket(r.propuesta, r.descartados);
      } catch (err) {
        // AC#3: el tope de 5/día lleva SU mensaje, claro y en el idioma del usuario — nunca un
        // código técnico. `err.message` es la que compone `fotoParaGuardar` (AVISO_FOTO_NO_SE_ABRE,
        // ya firmada) si la foto no se pudo abrir; para cualquier otro fallo del servidor
        // (sin IA configurada, cuota de Google, formato no parseable, 500) se usa el genérico.
        if (err && err.message === AVISO_FOTO_NO_SE_ABRE) showExpError(AVISO_FOTO_NO_SE_ABRE);
        else if (err && err.code === 'lecturas_agotadas') showExpError(AVISO_TOPE_LECTURAS_TICKET);
        else showExpError(AVISO_LECTURA_TICKET_FALLIDA);
      } finally {
        btnLeerTicket.disabled = false;
        btnLeerTicket.textContent = textoReposo;
      }
    });
  }

  // SCRUM-135: los Trabajos se piden a /admin/jobs (endpoint YA existente; para un técnico
  // viene filtrado a los suyos por SCRUM-23, así que el selector nunca enseña trabajo ajeno).
  // Se rellena DESPUÉS de pintar el modal: el formulario se puede empezar a rellenar mientras.
  const jobSel = document.getElementById('exp-quoteid');
  if (jobSel) {
    const actual = expense?.quote?.id ?? expense?.quoteId ?? null;
    apiRequest('/admin/jobs')
      .then((jobs) => {
        if (!document.getElementById('exp-modal')) return; // lo cerró antes de que llegara
        jobSel.innerHTML = jobOptionsHtml(Array.isArray(jobs) ? jobs : [], actual);
      })
      .catch(() => {
        if (!document.getElementById('exp-modal')) return;
        // Fallo al cargar la lista: NO se deja un desplegable vacío que borre la vinculación
        // al guardar. Se conserva la actual y se dice qué ha pasado.
        jobSel.innerHTML = actual != null
          ? `<option value="${actual}" selected>Vinculación actual (no se pudo cargar la lista)</option>`
          : `<option value="">— Sin trabajo — (no se pudo cargar la lista)</option>`;
      });
  }

  document.getElementById('exp-save').addEventListener('click', async () => {
    const concept    = document.getElementById('exp-concept').value.trim();
    const amount     = Number(document.getElementById('exp-amount').value);
    const date       = document.getElementById('exp-date').value;
    const category   = document.getElementById('exp-category').value;
    // SCRUM-135: o el selector, o el trabajo fijo cuando se abre desde su ficha.
    const quoteId    = fixedJob
      ? String(fixedJob.quoteId ?? '')
      : document.getElementById('exp-quoteid').value;
    const providerId = document.getElementById('exp-providerid').value;
    const notes      = document.getElementById('exp-notes').value.trim();
    // SCRUM-1155 (920f) · dos file inputs ahora (cámara y archivo), mutuamente excluyentes —
    // `mostrarFotoElegida` vacía el otro en cuanto uno tiene fichero.
    const fileNuevo  = inputConFoto() && inputConFoto().files[0];

    if (!concept) { showExpError('El concepto es obligatorio.'); return; }
    if (!amount || amount <= 0) { showExpError('El importe debe ser mayor que 0.'); return; }

    const btn = document.getElementById('exp-save');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      // Leer foto si se seleccionó. SCRUM-947: reducida si no cabe (ver `fotoParaGuardar`).
      //
      // 🔴 SCRUM-964 · SOLO SE MANDA SI SE HA ELEGIDO UNA NUEVA, y esto NO es cosmético: antes se
      // reenviaba la foto que traía la fila de la lista (`expense.receiptData`). Desde que la lista
      // no la trae, ese atajo mandaría `null` y el `PUT` BORRARÍA la foto guardada en CADA edición
      // del gasto — el profesional perdería su justificante por corregir un importe.
      // `undefined` no viaja en el JSON, y el servidor distingue «no lo mandes» (no se toca) de
      // «bórralo» (`null`) desde SCRUM-324: por eso omitir la clave es exactamente «no la toques».
      //
      // SCRUM-1155 · «Quitarla» sobre la foto YA GUARDADA (edición) es la TERCERA vía: ni una
      // nueva ni «no la toques» — `fotoQuitada` manda `null` a propósito, la única forma de que
      // `PUT` la borre.
      let receiptData;
      if (fileNuevo) {
        receiptData = await fotoParaGuardar(fileNuevo);
      } else if (fotoQuitada) {
        receiptData = null;
      }

      const payload = {
        concept, amount, date, category, notes: notes || null,
        quoteId: quoteId ? Number(quoteId) : null,
        providerId: providerId ? Number(providerId) : null,
        nifProveedor: document.getElementById('exp-provider-nif').value.trim() || null,
        // SCRUM-324 (E3) · el desglose. `numeroONull` y no `Number(x)||null`: `Number('')` es 0 y
        // un 0 aquí sería una AFIRMACIÓN («base cero», «cuota cero») donde el profesional no ha
        // escrito nada. Un 0 tecleado a propósito —tipo 0%, exento— sí tiene que llegar como 0.
        baseAmount:  numeroONull(document.getElementById('exp-base').value),
        vatRate:     numeroONull(document.getElementById('exp-vatrate').value),
        vatAmount:   numeroONull(document.getElementById('exp-vatamount').value),
        providerInvoiceNumber: document.getElementById('exp-provinvnum').value.trim() || null,
        providerInvoiceDate:   document.getElementById('exp-provinvdate').value || null,
        // SCRUM-964 · la clave NO VIAJA si no se ha elegido foto nueva (ver arriba). Explícito y no
        // `receiptData,` a secas: que `JSON.stringify` se coma los `undefined` es cierto, pero es
        // un detalle del serializador, y aquí la decisión —no tocar la foto guardada— tiene que
        // verse en el código.
        ...(receiptData !== undefined ? { receiptData } : {}),
        currency: window.appLocale?.currency || 'EUR',
      };

      let creado = null;
      let editado = null;
      if (isEdit) {
        editado = await apiRequest(`/admin/expenses/${expense.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        creado = await apiRequest('/admin/expenses', { method: 'POST', body: JSON.stringify(payload) });
      }

      // SCRUM-324 (E3) · aquí iba el aviso del simplificado, y NO se enciende: es una afirmación
      // fiscal y espera al asesor (ver arriba). El veredicto llega en `creado.justificante` y hoy
      // no se pinta — deliberadamente, y dicho, en vez de pintarse a medias.

      closeExpModal();
      // SCRUM-937b · el NIF tecleado sin proveedor no tiene dónde guardarse, y el servidor lo dice
      // (`destinoDelNif`, #1499). Se avisa ANTES de recargar, para que un fallo al recargar no se
      // lo coma. Solo `sin_proveedor`: `la_ficha_tiene_otro` no se alcanza desde este modal (el NIF
      // de una ficha llena es de solo lectura) y su texto, firmado, no se construye hoy.
      const destinoDelNif = (creado || editado || {}).destinoDelNif;
      if (destinoDelNif === 'sin_proveedor' && typeof showToast === 'function') {
        showToast(AVISO_NIF_SIN_PROVEEDOR, 'warn');
      }
      // SCRUM-135: desde el detalle del Trabajo no existe la vista de Gastos que recargar
      // (y para un técnico esas dos llamadas son 403). El llamador dice qué refrescar.
      if (o.onSaved) await o.onSaved();
      else await Promise.all([loadSummary(), loadExpenses()]);
    } catch (err) {
      showExpError(err.message || 'Error al guardar.');
      btn.disabled = false; btn.textContent = isEdit ? 'Guardar cambios' : 'Añadir gasto';
    }
  });
}

// SCRUM-937b · textos firmados por el orquestador por delegación (SCRUM-937 comentario 15873).
// Ficha en docs/microcopy/2026-09-18-SCRUM-937-nif-del-gasto.md.
const AYUDA_NIF_SIN_PROVEEDOR = 'Elige antes el proveedor: el NIF se guarda en su ficha.';
const AVISO_NIF_SIN_PROVEEDOR = 'Gasto guardado. El NIF no se ha guardado: para guardarlo, el gasto necesita un proveedor.';

// SCRUM-1038 · textos firmados por el orquestador por delegación (SCRUM-1038 comentario 16942).
// Ficha en docs/microcopy/2026-09-25-SCRUM-1038-leer-el-ticket.md.
const TEXTO_LEER_TICKET = 'Leer el ticket';
const TEXTO_LEYENDO_TICKET = 'Leyendo…';
const AVISO_TOPE_LECTURAS_TICKET = 'Has llegado al máximo de 5 lecturas de ticket hoy. Escribe los datos a mano.';
const AVISO_LECTURA_TICKET_FALLIDA = 'No hemos podido leer este ticket. Escribe los datos a mano.';

// SCRUM-920 · el alta rediseñada — textos firmados por el orquestador por delegación permanente
// (SCRUM-920 comentario 15992, 20-sep-2026). Ficha en
// docs/microcopy/2026-09-26-SCRUM-1155-alta-rediseno.md. Construidos en SCRUM-1155 (920f), un mes
// después de firmarse: quedaron escritos y sin aplicar hasta entonces.
const TEXTO_PASO1_TITULO = '1 · La foto del ticket';
const TEXTO_PASO1_AYUDA = 'Hazla ahora, que el papel lo tienes delante. Lo demás lo puedes rellenar luego.';
const TEXTO_HAZ_LA_FOTO = 'Haz la foto del ticket';
const TEXTO_HACER_FOTO = '📷 Hacer foto';
const TEXTO_ELEGIR_FOTO = 'Elegir foto o archivo';
const TEXTO_SIN_TICKET = 'Ahora no tengo el ticket';
const TEXTO_FOTO_GUARDADA = 'Foto guardada';
const TEXTO_FOTO_MAL_LEIDA = 'Si no se lee bien, repítela.';
const TEXTO_FOTO_VERLA = 'Verla';
const TEXTO_FOTO_QUITARLA = 'Quitarla';
const TEXTO_PASO2_TITULO = '2 · Qué es y cuánto';
const TEXTO_PASO2_BASTA = '✓ Con esto ya se guarda. Lo de abajo es opcional.';
const TEXTO_PASO3_TITULO = '3 · Datos de la factura del proveedor';
const TEXTO_OPCIONAL = 'Opcional';
// F1 · «de abajo», no «de arriba»: en el rediseño la foto sube al paso 1, así que los campos
// fiscales que describe quedan DEBAJO de este párrafo, no encima como en el modal viejo.
const TEXTO_F1_FOTO_ES_COPIA = 'Guardamos la foto como tu copia. Los datos fiscales salen de los campos de abajo.';

// SCRUM-920h · los 9 porqués de la lectura — textos firmados por el orquestador por delegación
// permanente (SCRUM-920 comentario 16175, 21-sep-2026, junto con SCRUM-912). Prototipo en su día
// (`docs/prototipos/SCRUM-920/`); conectados a la pantalla real en SCRUM-1155 (920f).
const MOTIVOS_DESCARTE_TEXTO = {
  no_es_numero: 'No hemos podido leer esta cifra. Escríbela tú.',
  fuera_de_rango: 'La cifra que hemos leído no tiene sentido. Escríbela tú.',
  tipo_iva_no_admitido: 'El tipo de IVA que hemos leído no es uno de los que se pueden guardar. Elígelo tú.',
  no_cuadra_con_el_total: 'La base, la cuota y el total no sumaban. Hemos dejado la base vacía: revisa las tres cifras en el ticket.',
  fecha_invalida: 'La fecha que hemos leído no existe. Hemos dejado la de hoy: cámbiala si hace falta.',
  fecha_futura: 'La fecha que hemos leído es posterior a hoy. Hemos dejado la de hoy: cámbiala si hace falta.',
  nif_invalido: 'El NIF que hemos leído no es válido. Compruébalo en el ticket.',
  demasiado_largo: 'Lo que hemos leído es demasiado largo para este campo. Escríbelo tú.',
  no_es_texto: 'No hemos podido leer este dato. Escríbelo tú.',
};
// `campo` de `Descartado` (servidor) → id del input en este modal.
const CAMPO_DESCARTE_A_INPUT = {
  amount: 'exp-amount', baseAmount: 'exp-base', vatRate: 'exp-vatrate', vatAmount: 'exp-vatamount',
  date: 'exp-date', providerInvoiceDate: 'exp-provinvdate', providerInvoiceNumber: 'exp-provinvnum',
  nifProveedor: 'exp-provider-nif', concept: 'exp-concept',
};

function closeExpModal() {
  document.getElementById('exp-modal')?.remove();
}

function showExpError(msg) {
  const el = document.getElementById('exp-error');
  if (el) { el.textContent = msg; el.className = 'alert error'; el.style.display = 'block'; }
}

/**
 * SCRUM-324 (E3) · «vacío» y «cero» no son el mismo número.
 *
 * `Number('')` vale **0**, así que el atajo `Number(x) || null` convierte un campo en blanco en un
 * cero y un cero de verdad en `null` — las dos direcciones mal. Aquí un campo sin tocar es `null`
 * (no se sabe) y un `0` escrito llega como `0` (tipo exento, que existe).
 */
function numeroONull(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ═══ SCRUM-947 · LA FOTO DEL TICKET TIENE QUE CABER EN LA PETICIÓN ════════════════════════════
// La foto viaja en base64 DENTRO del JSON, y el servidor corta el cuerpo a 2 MB
// (`express.json({ limit: '2mb' })`, src/app.ts). El base64 engorda un tercio: una foto de móvil
// normal (3–5 MB) daba 413 y el gasto no se guardaba. Medido en staging el 18-sep-2026.
//
// Se REDUCE aquí, en el panel, y no se sube el límite: el servidor no tiene que recibir ni guardar
// 5 MB por ticket para leer un importe. Lado largo 2000 px, que sigue dejando legible la letra de
// un ticket (lo que necesita la lectura con IA de SCRUM-912).
//
// ✅ Una foto que YA cabía se manda tal cual, como hasta hoy: no se recomprime lo que funcionaba.
const FOTO_LADO_MAXIMO = 2000;
// Caracteres del data-URI. Deja ~0,5 MB para el resto del gasto y la cabecera del JSON.
const FOTO_TECHO_DATAURI = 1.5 * 1024 * 1024;
// Texto firmado por el orquestador por delegación (SCRUM-947, 18-sep-2026). Ficha en
// docs/microcopy/2026-09-18-SCRUM-947-foto-del-gasto.md.
const AVISO_FOTO_NO_SE_ABRE = 'No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del ticket.';

async function fotoParaGuardar(file) {
  const original = await fileToBase64(file);
  if (original.length <= FOTO_TECHO_DATAURI) return original;

  let img;
  try { img = await abrirFoto(file); } catch { throw new Error(AVISO_FOTO_NO_SE_ABRE); }
  const ancho = img.naturalWidth || img.width, alto = img.naturalHeight || img.height;
  if (!ancho || !alto) throw new Error(AVISO_FOTO_NO_SE_ABRE);

  // Primero se baja la calidad (0,8 → 0,6) y, si aún no cabe, el tamaño. Tope de intentos: una
  // foto que no cabe ni así se dice, no se manda para que el servidor la rechace.
  let lado = FOTO_LADO_MAXIMO, calidad = 0.8;
  try {
    for (let intento = 0; intento < 8; intento++) {
      const escala = Math.min(1, lado / Math.max(ancho, alto));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(ancho * escala));
      lienzo.height = Math.max(1, Math.round(alto * escala));
      const ctx = lienzo.getContext('2d');
      // Un PNG con transparencia saldría con fondo negro en JPEG: el ticket va sobre blanco.
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      const uri = lienzo.toDataURL('image/jpeg', calidad);
      if (uri.length <= FOTO_TECHO_DATAURI) return uri;
      if (calidad > 0.65) calidad -= 0.1;
      else lado = Math.round(lado * 0.8);
    }
  } finally {
    if (typeof img.close === 'function') img.close();
  }
  throw new Error(AVISO_FOTO_NO_SE_ABRE);
}

// `createImageBitmap` con `imageOrientation: 'from-image'` respeta el giro EXIF de la cámara del
// móvil; donde no está (o no abre el formato), se prueba con un <img>, que en Safari sí abre HEIC.
// Se llama como `window.createImageBitmap` y no a pelo: es la misma función, y así el censo de
// SCRUM-378 (lo que una página invoca y nadie define) la resuelve contra `window`, que sí conoce.
async function abrirFoto(file) {
  if (typeof window.createImageBitmap === 'function') {
    try { return await window.createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* al <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// P-A66-3: delega en el formateador es-ES compartido (api.js)
function fmtEuro(amount) {
  return fmtMoneyEs(amount, (window.appLocale && window.appLocale.currency) || 'EUR');
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]
  );
}
