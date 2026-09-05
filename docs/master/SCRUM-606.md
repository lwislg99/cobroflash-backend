# SCRUM-606 (ALB-01) — nuevo albarán desde presupuesto · microcopy CANDIDATA, sin firmar

**Escrita el 5-sep-2026 · ninguno de estos textos está aprobado** (regla 30).

**Medido contra:** `origin/main` = `78ca15a35f1765d141688258eb34ae0ef396731c` · 2026-09-05T16:25:32+01:00

> El ancla se escribió **después** de mezclar ese `main` dentro de la rama y comprobando que es
> ancestro de `HEAD`, no antes: en esta sesión `main` se movió dos veces (`28b04585` → `78ca15a3`)
> mientras se trabajaba, y un ancla escrita antes del merge nace caduca. La segunda de esas
> vueltas trajo SCRUM-751, que arregla justo el defecto que esta rama había medido y registrado.

## ⚠️ Por qué este fichero NO está en `docs/microcopy/`

Se escribió primero ahí y **el guard de SCRUM-726 lo tiró, con razón**. Aquel directorio es «el
registro de cada microcopy que **aprueba** el fundador», un fichero por **aprobación**, y todos sus
ficheros tienen que llevar su firma: `constaAprobado()` la exige. Un registro de **candidatos** con
`firmante: null` allí dentro es exactamente lo que ese guard existe para impedir — un texto que
parece aprobado por estar donde se guardan las aprobaciones.

Así que vive aquí, en el registro de trabajo por ticket. **El día que el asesor firme**, ese acto sí
estrena su fichero en `docs/microcopy/` con la línea de firma, y este documento se queda como lo que
es: la medición que había delante cuando se decidió.

Mientras no haya firma, los siete salen en pantalla con el marcador `[PENDIENTE microcopy oficial]`
**visible a propósito** (SCRUM-402/667).

## Los candidatos

| Ranura | Dónde vive | Candidato (sin el marcador) |
|---|---|---|
| Rótulo del botón | `atajoNuevo.TEXTOS.albaranes` | Nuevo albarán |
| Título del modal | *el mismo* — lo lee de `atajoNuevo.textoDe('albaranes')` | Nuevo albarán |
| Placeholder del buscador | `albaranDesdePresupuestoModal.js` · `COPY.buscar` | Busca por nº de presupuesto, cliente o teléfono |
| Vacío de la búsqueda | `COPY.vacio` | Ningún presupuesto coincide con esa búsqueda |
| Motivo `sin_trabajo` | `COPY.sin_trabajo` | Todavía no tiene trabajo: acepta el presupuesto y vuelve |
| Motivo `trabajo_no_visible` | `COPY.trabajo_no_visible` | Su trabajo no es tuyo |
| Aviso de lista cortada | `COPY.truncado` | Puede haber más: afina la búsqueda |
| Aviso de fallo de carga | `COPY.error` | No se han podido cargar los presupuestos |

Son **ocho ranuras y siete textos**: el rótulo del botón y el título del modal son **la misma
cadena leída de un solo sitio**, para que la firma no deje uno de los dos con el marcador puesto.

Contadores que lo declaran, y que caen si alguien añade una novena sin decirlo:

* `atajoNuevo.js` → `SIN_APROBAR` **0 → 1** (sólo el rótulo; los otros tres siguen firmados).
* `albaranDesdePresupuestoModal.js` → `ALB_ORIGEN_SIN_APROBAR = 6` (los seis textos del modal).
* Censo de SCRUM-402 → entran `atajoNuevo.js: 1` y `albaranDesdePresupuestoModal.js: 1`
  (un literal cada uno; los seis del modal salen de una sola constante `MARCA`).

## Las cajas, medidas en navegador real

Chromium, CSS de producción (`public/tokens.css` + `public/dashboard/css/styles.css` embebidos) con
la cabecera y el modal reproducidos. **Los textos se leen de las fuentes**, no se reescriben en la
página de medición: si alguien cambia uno, se mide el nuevo.

Control positivo del propio instrumento: el `<kbd>N</kbd>` **desaparece a 390 px** y se ve a 929,
que es lo que `styles.css:2761` promete. Si la página de medición no cargara el CSS real, ese
`<kbd>` habría salido igual en las dos y la medición no valdría nada.

**Ancho útil vs. ancho del texto**, en píxeles:

| Ranura | 929: útil | 929: candidato | 929: con marcador | 390: útil | 390: candidato | 390: con marcador |
|---|---|---|---|---|---|---|
| Botón | 441 | **128,1** | 404 | 284 | **128,1** | 404 ⚠️ |
| Título del modal | 340 | **109,9** | 346,4 ⚠️ | 288 | **109,9** | 346,4 |
| Placeholder | 484 | **314,0** | 519,6 ⚠️ | 314 | **314,0** 🔶 | 519,6 ⚠️ |
| Vacío | 464 | **318,2** | 523,8 | 294 | **318,2** (2 líneas) | 523,8 |
| Motivo `sin_trabajo` | 486 | **296,1** | 460,6 | 316 | **296,1** | 460,6 |
| Motivo `trabajo_no_visible` | 486 | **112,6** | 277,1 | 316 | **112,6** | 277,1 |
| Aviso truncado | 482 | **214,9** | 399,9 | 312 | **214,9** | 399,9 |
| Aviso error | 482 | **251,9** | 436,9 | 312 | **251,9** | 436,9 |

Cajas resultantes (ancho × alto), tal y como salen hoy **con el marcador puesto**:

| Ranura | A 929 px | A 390 px |
|---|---|---|
| Botón | 472,9 × 36 | 316 × 44 |
| Título del modal | 339,5 × 24,8 | 288,4 × 49,6 |
| Buscador | 512 × 44,5 | 342 × 44,5 |
| Aviso truncado | 512 × 42,3 | 342 × 62,5 |
| Aviso error | 512 × 42,3 | 342 × 62,5 |
| Fila no elegible (con sus dos motivos) | 512 × 111 | 316 × 37,2 + 18,6 |
| Vacío | 512 × 142,5 | 342 × 142,5 |

La página **no scrollea en horizontal** en ninguno de los dos anchos.

## 🔴 Tres cosas que la medición dice y hay que decir

1. **Con el marcador puesto, el botón se recorta a 390 px.** Medido: el texto necesita 404 px y el
   botón tiene 284 útiles, y `.btn` no parte línea — en la captura se lee
   «DIENTE microcopy oficial] Nuevo alb». **El candidato solo cabe de sobra** (128,1 en 284), así
   que esto se cura firmando, no cambiando el CSS. Mientras tanto, es feo a propósito.
2. **El placeholder también se recorta con el marcador**, en los dos anchos.
3. 🔶 **El placeholder candidato queda JUSTO en el límite a 390 px: 314,0 px de texto en 314,0 px
   útiles.** No es una holgura, es un empate — con otra fuente, otro zoom o una «ñ» de más, se
   corta. Si el asesor quiere firmar esa ranura, conviene un texto más corto (el buscador acepta
   número, cliente y teléfono, pero el placeholder no tiene por qué enumerar los tres).

## Cómo se aplica una firma

Cuando el asesor firme, en el MISMO acto:

* se escribe el texto sin marcador en su constante,
* baja `SIN_APROBAR` / `ALB_ORIGEN_SIN_APROBAR`,
* se **borra** la entrada del censo de SCRUM-402 —no se pone a 0 (precedente SCRUM-424/405)—,
* y se añade aquí la fecha de la firma.

Los guards que lo atan: `tests/scrum599-navegacion-documentos-y-atajo.test.mjs`,
`tests/scrum591-alta-desde-el-documento.test.mjs`, `tests/scrum402-marcador-no-se-pinta.test.mjs` y
`tests/scrum606-albaran-desde-presupuesto.test.mjs` (que exige el marcador en el botón mientras no
haya firma).
