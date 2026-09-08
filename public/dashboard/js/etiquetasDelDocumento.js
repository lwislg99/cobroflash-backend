// public/dashboard/js/etiquetasDelDocumento.js — SCRUM-595 (DOC-05)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL BLOQUE DE ETIQUETAS DE UNA FICHA DE DOCUMENTO. UNA VEZ, PARA LOS DOS.
//
// ⛔ AQUÍ NO SE DECIDE NADA, y conviene decirlo antes que nada. Cómo se lee una etiqueta, cómo se
// comparan dos, cuáles usa un lote y cuáles son los textos vive en `filtroClientes.js` (CONT-07,
// SCRUM-580) y **no se copia aquí**. Esto es sólo la PANTALLA: una sección, un campo y su
// guardado. Si algún día alguien escribe en este fichero una regla sobre etiquetas, está
// empezando el segundo mecanismo.
//
// ── POR QUÉ EXISTE, EN VEZ DE PEGARLO EN LAS DOS FICHAS ────────────────────────────────────
// Las etiquetas son del DOCUMENTO, y en YaQu hay dos: presupuesto y factura. Dos copias de este
// bloque divergen —una gana un aviso de guardado, la otra no; una recorta espacios, la otra no—
// y el profesional acaba viendo dos comportamientos para la misma cosa. Es la misma forma que ya
// tiene `rotulosDelDocumento.js`: una pieza pequeña de pantalla, compartida por sus dos vistas.
//
// ── ⚠️ EL CAMPO NO LLEVA PLACEHOLDER, Y ES DELIBERADO ──────────────────────────────────────
// CONT-07 tiene uno aprobado (`comunidad, administrador, urgencias…`) pero **nombra ejemplos de
// CLIENTE**, y en un documento los ejemplos son otros. Un placeholder para documento sería un
// literal NUEVO, y el microcopy es del fundador (regla 30): se describe en
// `docs/master/SCRUM-595.md` y NO se escribe. El campo se queda sin él antes que inventarlo.
//
// Los tres avisos de guardado (`Escribiendo…`, `✓ Guardado automáticamente`, `Error al guardar`)
// son LOS MISMOS literales que ya usa el bloque de notas internas del presupuesto: misma palabra
// para la misma cosa, ninguna ranura nueva.
// ═════════════════════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  /** Milisegundos de espera antes de guardar. El mismo que el bloque de notas internas. */
  var ESPERA_MS = 1200;

  /**
   * Pinta el bloque de etiquetas y lo cuelga de `contenedor`.
   *
   * @param contenedor  dónde va la sección (la ficha)
   * @param documento   el documento ya cargado; se lee su `.tags`
   * @param endpoint    la ruta que guarda, ya resuelta por quien llama
   *                    (`/admin/quotes/<id>/tags` o `/admin/invoices/<id>/tags`)
   *
   * Devuelve la sección, para que quien llame pueda colocarla si lo necesita.
   */
  function montarEtiquetasDelDocumento(contenedor, documento, endpoint) {
    var FC = window.filtroClientes;
    // Sin la pieza de decisión esto no puede pintar nada coherente. Se sale sin tocar la pantalla
    // en vez de pintar medio bloque: `index.html` la carga antes, y un test vigila ese orden.
    if (!contenedor || !FC || !endpoint) return null;

    var sec = document.createElement('div');
    sec.className = 'detail-section';
    contenedor.appendChild(sec);

    var titulo = document.createElement('h3');
    titulo.className = 'detail-section-title';
    // El rótulo sale de la pieza. Escribirlo aquí sería una segunda copia de un texto aprobado,
    // y una copia deriva sin que nada chille (regla 30).
    titulo.textContent = FC.TEXTOS_ETIQUETAS.rotulo;
    sec.appendChild(titulo);

    // Las etiquetas de ahora mismo, con el componente del inventario (AB3). `textContent` por
    // etiqueta, nunca `innerHTML`: la escribe el profesional.
    var caja = document.createElement('div');
    caja.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px';
    sec.appendChild(caja);

    function pintarChips(lista) {
      caja.innerHTML = '';
      lista.forEach(function (t) {
        var chip = document.createElement('span');
        chip.className = 'badge badge-slate';
        chip.textContent = t;
        caja.appendChild(chip);
      });
      caja.hidden = lista.length === 0;
    }
    pintarChips(FC.tagsDe(documento));

    var campo = document.createElement('input');
    campo.type = 'text';
    campo.className = 'input';
    campo.style.cssText = 'width:100%';
    // Se rellena con lo que hay: si no se rellenara, el profesional las reescribiría cada vez.
    campo.value = FC.tagsDe(documento).join(', ');
    // ⚠️ SIN `placeholder` — ver la cabecera. No es un olvido.
    sec.appendChild(campo);

    var aviso = document.createElement('div');
    aviso.style.cssText = 'font-size:12px;color:var(--muted);margin-top:4px;text-align:right;min-height:16px';
    sec.appendChild(aviso);

    /**
     * 🔴 «AUSENTE ≠ VACÍO» también en lo que VIAJA: sin etiquetas se manda `null`, nunca `[]` ni
     * `""`. Es la misma función que `tagsParaPayload` en la ficha de cliente, y por el mismo
     * motivo: si viajara `[]`, la columna diría «este documento tiene etiquetas».
     *
     * ⚠️ Esto NO es la regla. La regla vive en el SERVIDOR (`normalizarTags`), que es donde no se
     * puede esquivar; aquí sólo se evita mandar ruido.
     */
    function loQueViaja(texto) {
      var partes = String(texto == null ? '' : texto)
        .split(',')
        .map(function (t) { return t.trim(); })
        .filter(function (t) { return t !== ''; });
      return partes.length ? partes : null;
    }

    var temporizador = null;
    campo.addEventListener('input', function () {
      aviso.style.color = 'var(--muted)';
      aviso.textContent = 'Escribiendo…';
      clearTimeout(temporizador);
      temporizador = setTimeout(function () {
        var viaja = loQueViaja(campo.value);
        apiRequest(endpoint, {
          method: 'PUT',
          body: JSON.stringify({ tags: viaja }),
        }).then(function () {
          aviso.textContent = '✓ Guardado automáticamente';
          // Los chips se repintan con lo que se acaba de mandar, no con lo que había: dejarlos
          // viejos enseñaría al profesional un estado que ya no es el suyo.
          pintarChips(viaja || []);
          setTimeout(function () { aviso.textContent = ''; }, 2500);
        }).catch(function () {
          aviso.style.color = 'var(--red-600)';
          aviso.textContent = 'Error al guardar';
        });
      }, ESPERA_MS);
    });

    return sec;
  }

  if (typeof window !== 'undefined') {
    window.montarEtiquetasDelDocumento = montarEtiquetasDelDocumento;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { montarEtiquetasDelDocumento };
  }
})();
