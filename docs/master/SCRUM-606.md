# SCRUM-606 (ALB-01) — nuevo albarán desde presupuesto · microcopy APROBADA POR EL ASESOR

**Aprobada por el asesor** el 5-sep-2026, en **SCRUM-606**, y **aplicada en el mismo commit**:
textos escritos, marcadores retirados y contadores a 0 a la vez. Cuatro firmó tal cual, dos con
cambio, y el placeholder se acortó antes de enseñárselo.

> ⚠️ **Falta la firma del FUNDADOR, y por eso este registro NO está en `docs/microcopy/`.**
> Ese directorio es de aprobaciones del fundador —`firmanteDe()` sólo cuenta «Aprobado por el
> fundador» (SCRUM-726)— y escribir ahí su nombre por una firma del asesor sería exactamente
> la misuscripción que ese guard existe para impedir.
>
> **Es el flujo normal de la casa, no un hueco raro.** SCRUM-599 estuvo en este mismo estado:
> «el asesor la había aprobado el 3-sep y quedaba a la espera», y su fichero de
> `docs/microcopy/` nació el 4-sep, cuando firmó el fundador. Aquí igual.
>
> **Consecuencia medida, para que nadie la descubra tarde:** `constaAprobado()` NO cuenta estos
> siete literales como aprobados mientras tanto. Hoy eso no rompe nada —SCRUM-402 vigila que no
> se PINTE un marcador (y ya no hay ninguno) y SCRUM-514 vigila el sentido contrario, que todo
> lo aprobado esté pintado—, pero es un hecho declarado, no un olvido.

**Medido contra:** `origin/main` = `78ca15a35f1765d141688258eb34ae0ef396731c` · 2026-09-05T16:25:32+01:00

> El ancla se escribió **después** de mezclar ese `main` dentro de la rama y comprobando que es
> ancestro de `HEAD`, no antes: en esta sesión `main` se movió dos veces (`28b04585` → `78ca15a3`)
> mientras se trabajaba, y un ancla escrita antes del merge nace caduca. La segunda de esas
> vueltas trajo SCRUM-751, que arregla justo el defecto que esta rama había medido y registrado.

## Los siete textos aprobados, literales

| Ranura | Dónde vive | Texto aprobado |
|---|---|---|
| Rótulo del botón | `atajoNuevo.TEXTOS.albaranes` | Nuevo albarán |
| Título del modal | *el mismo* — lo lee de `atajoNuevo.textoDe('albaranes')` | Nuevo albarán |
| Placeholder del buscador | `albaranDesdePresupuestoModal.js` · `COPY.buscar` | Buscar por nº, cliente o teléfono |
| Vacío de la búsqueda | `COPY.vacio` | Ningún presupuesto coincide con esa búsqueda |
| Motivo `sin_trabajo` | `COPY.sin_trabajo` | Aún no tiene trabajo: acepta el presupuesto y vuelve |
| Motivo `trabajo_no_visible` | `COPY.trabajo_no_visible` | Su trabajo no está a tu nombre |
| Aviso de lista cortada | `COPY.truncado` | Puede haber más: afina la búsqueda |
| Aviso de fallo de carga | `COPY.error` | No se han podido cargar los presupuestos |

Ocho ranuras y **siete textos**: el rótulo del botón y el título del modal son la misma cadena
leída de un solo sitio. Firmar una y dejar la otra con marcador habría sido el defecto que hoy
tuvo `main` en rojo.

### Qué cambió el asesor, y por qué

| Ranura | Candidato entregado | Aprobado | Motivo |
|---|---|---|---|
| Placeholder | Busca por nº de presupuesto, cliente o teléfono | **Buscar por nº, cliente o teléfono** | Acortado **antes** de enseñárselo: el primero medía 314,0 px en 314,0 útiles. Se derivó del hermano ya firmado de la misma pantalla y se corrigió la única palabra falsa («trabajo» → «teléfono»). |
| `sin_trabajo` | Todavía no tiene trabajo: acepta el presupuesto y vuelve | **Aún** no tiene trabajo: acepta el presupuesto y vuelve | «Todavía» → «Aún» dice lo mismo y devuelve holgura. Era la ranura más justa: +19,9 px. |
| `trabajo_no_visible` | Su trabajo no es tuyo | **Su trabajo no está a tu nombre** | «No es tuyo» suena a reproche y el profesional no ha hecho nada mal. Dice el mismo hecho sin acusar y sin filtrar de quién es el Trabajo, que era el requisito. |

Los otros cinco, firmados tal cual. Del vacío dijo expresamente que **no se acortara** para
meterlo en una línea: es un estado vacío centrado y ahí envolver es lo correcto.

### Los contadores, movidos en el MISMO commit

* `atajoNuevo.js` → `SIN_APROBAR` **1 → 0** (subió y volvió a bajar el mismo día).
* `albaranDesdePresupuestoModal.js` → `ALB_ORIGEN_SIN_APROBAR` **6 → 0**, y `MARCA` se retira
  ENTERA: una constante de marcado sin consumidores invita a marcar texto nuevo en vez de
  someterlo (precedente de `MARCA_651`).
* Censo de SCRUM-402 → las dos entradas se **borran**, no se ponen a 0.

**Y el tope de cada ranura queda atado por guard** (`tests/scrum606-…`), que era la exigencia
al firmar: alargar cualquiera **cae**, no se recorta en pantalla. El tope se **calcula** dentro
del test —`floor(útil × líneas ÷ (px medidos ÷ caracteres))`— y se contrasta con el declarado,
para que un número copiado a mano no se quede viejo en silencio.

## Las cajas, medidas en navegador real

Chromium, CSS de producción (`public/tokens.css` + `public/dashboard/css/styles.css` embebidos) con
la cabecera y el modal reproducidos. **Los textos se leen de las fuentes**, no se reescriben en la
página de medición: si alguien cambia uno, se mide el nuevo.

Control positivo del propio instrumento: el `<kbd>N</kbd>` **desaparece a 390 px** y se ve a 929,
que es lo que `styles.css:2761` promete. Si la página de medición no cargara el CSS real, ese
`<kbd>` habría salido igual en las dos y la medición no valdría nada.

**Ancho útil vs. ancho del texto CANDIDATO** (sin el marcador), en píxeles:

| Ranura | Literal candidato | 929: útil / texto / holgura | 390: útil / texto / holgura |
|---|---|---|---|
| Botón | Nuevo albarán | 441 / **128,1** / +312,9 | 284 / **128,1** / +155,9 |
| Título del modal | Nuevo albarán | 340 / **109,9** / +230,1 | 288 / **109,9** / +178,1 |
| Placeholder | Buscar por nº, cliente o teléfono | 484 / **212,2** / +271,8 | 314 / **212,2** / **+101,8** |
| Vacío | Ningún presupuesto coincide con esa búsqueda | 464 / **318,2** / +145,8 | 294 / **318,2** / −24,2 → 2 líneas |
| Motivo `sin_trabajo` | Todavía no tiene trabajo: acepta el presupuesto y vuelve | 486 / **296,1** / +189,9 | 316 / **296,1** / **+19,9** ⚠️ |
| Motivo `trabajo_no_visible` | Su trabajo no es tuyo | 486 / **112,6** / +373,4 | 316 / **112,6** / +203,4 |
| Aviso truncado | Puede haber más: afina la búsqueda | 482 / **214,9** / +267,1 | 312 / **214,9** / +97,1 |
| Aviso error | No se han podido cargar los presupuestos | 482 / **251,9** / +230,1 | 312 / **251,9** / +60,1 |

Cajas tal y como salen HOY, **con el marcador puesto** (ancho × alto):

| Ranura | A 929 px | A 390 px |
|---|---|---|
| Botón | 472,9 × 36 | 316 × 44 |
| Título del modal | 339,5 × 24,8 | 288,4 × 49,6 |
| Buscador | 512 × 44,5 | 342 × 44,5 |
| Aviso truncado / error | 512 × 42,3 | 342 × 62,5 |
| Motivo `sin_trabajo` | 486 × 18,6 | 316 × 37,2 |
| Vacío | 512 × 142,5 | 342 × 142,5 |

La página **no scrollea en horizontal** en ninguno de los dos anchos.

## 🔴 Lo que la medición dijo, y qué pasó con cada cosa

1. ✅ **El recorte se acabó.** Con marcador, el botón necesitaba 404 px en 284 útiles y se leía
   «DIENTE microcopy oficial] Nuevo alb»; el placeholder se cortaba en los dos anchos.
   **Re-medido tras la firma a 390 px: CERO elementos recortados** (`scrollWidth > clientWidth`
   sobre las ocho ranuras) y sin scroll horizontal. Los dos motivos caben en UNA línea cada uno
   (18,6 px de alto), y el vacío en dos, como se firmó.

2. ✅ **La ranura más justa dejó de serlo.** `sin_trabajo` tenía +19,9 px, que es lo primero que
   se parte el día que alguien toque una fuente o un padding. Con «Aún» en vez de «Todavía»:
   277,4 px en 316 útiles, **+38,6**. La mejora real es de **18,7 px** — el asesor estimó unos
   30 y el número medido es menor; se anota el medido.

3. 📌 **Hallazgo que no es de este ticket: el mecanismo de marcado DEGRADA la interfaz mientras
   espera firma.** El marcador no es sólo deuda de proceso — mientras está puesto, el botón y el
   placeholder salen recortados en producción. Tiene su lado bueno (el coste de no firmar se ve)
   y su lado malo (un marcador olvidado es un defecto de UI, no una nota). El asesor lo apunta
   como cosa de la casa; aquí sólo queda la medición que lo demuestra.

## Lo que queda: la firma del FUNDADOR

Los siete textos **ya están en pantalla** con la aprobación del asesor. Lo que falta es un solo
paso, y es de él:

* crear `docs/microcopy/2026-09-05-SCRUM-606-nuevo-albaran-desde-presupuesto.md` con la línea
  `**Aprobado por el fundador** el <fecha>, en **SCRUM-606**.` y los siete literales;
* con eso, `constaAprobado()` empieza a contarlos y `literalesAprobados()` los incluye.

**No hay nada que retirar de la pantalla mientras tanto** —así lo decidió SCRUM-726 a propósito:
un texto sin firma del fundador «no se borra de la pantalla, se LISTA para que la firme»— y
ningún guard está rojo por esto. Es el mismo camino que recorrió SCRUM-599 entre el 3 y el 4 de
septiembre.

## Los guards que atan todo esto

* `tests/scrum606-albaran-desde-presupuesto.test.mjs` — compara los seis textos del modal
  **ranura a ranura**, exige que el botón diga exactamente «Nuevo albarán» y **sin** marcador, y
  topa cada ranura recalculando su límite desde la medición.
* `tests/scrum599-navegacion-documentos-y-atajo.test.mjs` — los cuatro rótulos del atajo y
  `SIN_APROBAR = 0`, con la suma atada (`aprobados + sin firmar = total`), que es más fuerte que
  la igualdad simple: un quinto rótulo sin firma sube el total y tiene que subir el contador.
* `tests/scrum591-alta-desde-el-documento.test.mjs` — el contador, desde el otro lado.
* `tests/scrum402-marcador-no-se-pinta.test.mjs` — el censo, con las dos entradas ya borradas.
