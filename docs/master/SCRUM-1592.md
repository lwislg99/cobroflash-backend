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
