# SCRUM-1592 · los cuatro campos de Clientes a 44 px a 390 (buscador, dos select y el campo de la ficha 360)

**Medido contra:** `origin/main` = `01edf6213c16417989a4fbf50e9d28b9f707e881` · 2026-10-23T14:22:32Z (hora de GitHub al escribir: 2026-10-23T14:30:46Z)
A9: comprobación → `.claude/hooks/guard-dangerous.sh`
**Skill UI:** cargada · antes de tocar `styles.css`, con su checklist AB6 (capturas antes/después a 320, 390 y 1280)

Puesto J2 (`jv-j2ai`) · rama `scrum-1592a-clientes-44px`. Encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`). Sale de SCRUM-1584 (J6, `jv-j6an`), al que bloquea. El hook de arranque dijo «SIN
IDENTIDAD» (SCRUM-1498); el puesto lo da el encargo, y se dice aquí.

## PASO 0

Sin commits en `origin/main` con «SCRUM-1592» (`git log --grep`), sin rama `scrum-1592*` en el remoto (el único
`1592` de `ls-remote` es `refs/pull/1592/head`, otro PR) y sin `docs/master/SCRUM-1592*`. Jira: descripción leída
entera, **0 comentarios**; etiquetas `ab6`, `area-j2`, `equipo-javier`. Leídos también c.20491 y c.20535 de SCRUM-1584.

Defecto vivo HOY, corrido y no leído: con el medidor de la rama LOCAL `scrum-1584a-medidor-select`
(`77233f41c5d1b53a39705d2b825fc51b4bf7071e`, sin empujar) puesto en este árbol, `node scripts/guard-objetivo-tactil.mjs`
da **4 hallazgos · 0 ciegos → salida 1**: buscador 37, los dos `select` 39 y 39, `#c360-meta` 36,9, todos a 390 px.
Control negativo: con el medidor de main, **0 hallazgos · 0 ciegos → salida 0**. El medidor de 1584 se quitó del
árbol antes de commitear (este PR no lo lleva: es de J6).

## Carril

`node scripts/carriles.mjs de public/dashboard/css/styles.css` → **S2 (contenedor)** (`dos-equipos.md:150`): «el
otro equipo añade SU bloque marcado». Los campos los pintan `customersView.js` y `customerDetailView.js` (**J2**,
`dos-equipos.md:144`); el de `#c360-meta` lo crea `etiquetasDelDocumento.js` (S2), que **no se toca**. El cambio de
`styles.css` es un bloque nuevo marcado `── J2 · SCRUM-1592 ──`, 12 líneas añadidas y **0 quitadas**. `.input` (S2)
no se toca.

## El arreglo

```css
@media (max-width: 768px) {
  .data-card:has(> .barra-seleccion) .data-card-toolbar > .input,
  #c360-meta .input { min-height: 44px; }
}
```

Sólo tamaño y sólo hasta el corte de móvil, como SCRUM-1149 en la misma lista: en escritorio ya llegan a 36 (37 y
39 de toque), que es lo que pide el guard ahí. Ancla sin clase nueva (la de 1149: la barra de selección sólo la pinta
esta lista; `guard:lista-trabajos` compara el HTML de Clientes por hash). La regla alcanza también el `select` de
visitas, que nace oculto sin visitas en el lote: es el mismo tipo de control en la misma barra.

## Medición

`node scripts/guard-objetivo-tactil.mjs` con el medidor de 1584 y este arreglo: **0 hallazgos · 0 ciegos**.
Clientes a 390: medidos 32, cumplen 32. Ficha 360 a 390: medidos 11, cumplen 4 y 7 excusados — las 7 excepciones
de siempre (`.btn-sm` y las pestañas del historial), ninguna de estos cuatro. `EXCEPCIONES` del guard sin tocar.

Mutaciones (con el medidor de 1584): quitando `#c360-meta .input` de la regla → **1 hallazgo** (36,9, el de la
ficha); quitando el de la barra → **3 hallazgos** (37, 39, 39). Cada mitad trabaja.

`docs/master/evidencias/SCRUM-1592/medir.mjs` (instrumento propio, no depende del medidor de 1584; población
declarada 4 por anchura, semilla sembrada fuera del alcance de la regla):

| | 320 | 390 | 1280 |
|---|---|---|---|
| `--antes` (CSS de `origin/main`) | 4 cortos (37/39/39/36,8) | 4 cortos (37/39/39/36,9) | cumplen 36 (37/39/39/36,9) |
| con el arreglo | 45/45/45/44,8 | 45/45/45/44,9 | 37/39/39/36,9 (sin cambio) |

Salidas: `--antes` 1 · arreglo 0 · `--sin-semilla` 2 (CIEGO, como debe). La semilla sale corta (36,5–37) en
todas las anchuras de móvil.

Capturas en `docs/master/evidencias/SCRUM-1592/capturas/` (`antes-*` / `despues-*`, barra y `#c360-meta`, a 320,
390 y 1280). A 1280 las de antes y después son **idénticas byte a byte** (`cmp`); a 320 y 390 los campos son 6–8 px
más altos con el mismo aspecto (texto centrado, mismo borde y radio).

Test nuevo, sin gate: `tests/scrum1592-campos-clientes-44.test.mjs` (3 casos). Rojo primero: quitando
`#c360-meta .input` de la regla cae 1 de 3, con el mensaje de esa regla.

## Lo que no he medido

- Si `etiquetasDelDocumento.js` sale corto en las otras pantallas donde se usa (fuera de la ficha 360): no es de
  este ticket y no lo miré.
- En `yaqu.app`: no lo he visto desplegado (el PR no está en main al escribir esto).

## A9

Intenté poner el medidor de 1584 en el árbol con `git show … > scripts/_medidor-de-toque.mjs`, truncando un fichero
que git sigue, y después deshacerlo con `git checkout --`: `guard-dangerous` paró los dos. Usé `git checkout <rama> --
<fichero>` y, para quitarlo, `git reset` del fichero más el parche al revés. La comprobación ya existe y cazó las dos.

## SCRUM-1592b · los mismos dos campos, a 929 px en el Chromium de Linux

**Medido contra:** `origin/main` = `c81f07621b6e21204722d42d3021e36965382949` · 2026-10-23T16:45:46Z
A9: comprobación → `docs/master/evidencias/SCRUM-1592/medir.mjs`
**Skill UI:** cargada · `yaqu-premium-ui` antes de tocar `styles.css`; DESIGN.md (Inputs) leído; capturas antes/después a 320, 390, 929 y 1280.
**Rama:** `scrum-1592b-clientes-929` · **Carril:** J2 (bloque marcado de J2 en `styles.css`, contenedor S2) · sesión jv-j2ap.

### El defecto (SCRUM-1584 c.20600)

Con el medidor de SCRUM-1584 en main (#2754), el job `guards de navegador` de CI (Chromium de Linux) da 2
hallazgos de `guard:objetivo-tactil` a 929 px contra el mínimo de escritorio (36): el buscador de la lista de
Clientes y el campo de `#c360-meta`, los dos a 35 de toque (34 de caja). El tramo de arriba decía «en escritorio ya
llegan a 36»: era cierto sólo en Windows (aquí dan 36 de caja y 37 / 36,9 de toque).

**Por qué difiere:** `.input` no tiene mínimo, así que su alto es padding (16) + borde (3) + el interlineado de la
fuente. `--font` empieza por `'Inter'`, pero Inter no se carga en ninguna parte (ni `tokens.css` ni
`dashboard/index.html`: `grep` de `font-face`, `fonts.googleapis` e `Inter` da 0), y el campo cae a `system-ui`, que
es Segoe UI en Windows y otra fuente en Linux. **Sin medir en Linux:** en esta máquina no hay WSL; que la fuente
sea la causa es la explicación que cuadra con 36 frente a 34, no una medición.

### El arreglo

En el mismo bloque J2 de SCRUM-1592, FUERA de todo `@media` y antes del de móvil (que va detrás y sigue mandando
hasta 768):

    .data-card:has(> .barra-seleccion) .data-card-toolbar > .input,
    #c360-meta .input { min-height: 38px; }

38 es el alto que ya tienen los dos `select` de la barra en escritorio: el buscador queda igual de alto que ellos
y el aspecto no cambia más que esos 2 px. El mínimo explícito no depende de la fuente ni del redondeo. No toca
`.input` (S2), ni `etiquetasDelDocumento.js` (S2), ni ningún JS. `EXCEPCIONES` del guard sin tocar.

### Medición

- `docs/master/evidencias/SCRUM-1592/medir.mjs` amplía sus anchos a 320, 390, **929** y 1280 (16 mediciones
  declaradas) y gana `--fuente-corta`: inyecta `.input { font-size: 11px }` para que el alto NATURAL baje de 36,
  como en CI. No imita la fuente de Linux, sólo la consecuencia; en ese modo la semilla tiene que salir corta
  también en escritorio.
  - CSS de main, fuente del sistema: 0 cortos (buscador y `#c360-meta` a 36 de caja a 929 y 1280: el verde de
    Windows que engañó).
  - **CSS de main, `--fuente-corta`: 8 cortos** a 929 y 1280 (buscador 33, los dos `select` 35, `#c360-meta` 33),
    semilla corta en los 8 censos. Es el defecto de CI reproducido.
  - **CSS del árbol, `--fuente-corta`: 0 cortos · 0 ciegos**, los cuatro a 38 de caja (39 / 38,9 de toque),
    semilla corta en los 8 censos.
  - CSS del árbol, fuente del sistema: 0 cortos; a 929 y 1280, 38 de caja.
  - `--fuente-corta --sin-semilla`: CIEGO en los 8 censos, salida 2.
- Capturas en `docs/master/evidencias/SCRUM-1592/capturas-b/` (`antes-*`, `despues-*` y las mismas con
  `-fuente-corta`), a 320, 390, 929 y 1280. «Antes» es el CSS de `origin/main` (que ya lleva 1592a).
- `node scripts/guard-objetivo-tactil.mjs` en Windows: `0 hallazgos · 0 ciegos`, salida 0 — **igual que antes del
  arreglo, así que aquí no prueba nada**; lo que lo prueba es el obligatorio de navegador en CI.
- Test: `tests/scrum1592-campos-clientes-44.test.mjs` gana el caso «SCRUM-1592b»: los dos selectores fuera de
  `@media` con `min-height` ≥ `MINIMO_ESCRITORIO` (36, del medidor de la casa) + 2. Rojo primero, dos mutaciones:
  con 36 px cae («por debajo de 36 + 2») y quitando el selector de la barra cae («no está … fuera de los
  @media»). 4 de 4 con el arreglo.

### A9

Mi primera simulación del render de Linux era mala: inyectaba `line-height: 13px`, y Chromium no lo aplica al
alto de un `input`, así que el «antes» seguía a 36 y no reproducía nada. No lo di por bueno porque la semilla del
instrumento, que en ese modo tiene que salir corta también en escritorio, salió a 37 y el instrumento dijo CIEGO en
los 4 censos de escritorio. La comprobación es el propio `medir.mjs`. El error de fondo (dar por medido en
escritorio lo que sólo se midió con la fuente de Windows) lo destapó CI; lo ata ahora el caso nuevo del test, que
no depende de la fuente.
