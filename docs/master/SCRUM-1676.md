# SCRUM-1676 · PARTES · la firma deja de ser la acción principal de un parte VACÍO (PILOTO-1)

**Medido contra:** `origin/main` = `09212d6fbdb3373b96f1cd89b10707e1418bdd73` · 2026-11-10T18:12:00Z

A9: sin fallo que generalice — arreglo verificado contra la vista y el CSS reales (banco), sin tropiezo propio que generalizar

**Puesto:** S4 · **Rama:** `scrum-1676-firma-no-primaria-parte-vacio` (sale de ese `main`; fusionada después con `main` tras entrar SCRUM-1675, #3047)
**Skill UI:** cargada (`yaqu-premium-ui`; tokens existentes de `.btn-secondary`, ninguno nuevo)

## Firma del texto

Entrada 7 de la tanda única de PILOTO-1 (SCRUM-1656 c.21405), **firmada por el fundador**:
SCRUM-1656 comentario 21408 («si firmo todo dale…», localizador en el propio comentario). La
rectificación SCRUM-1656 c.21411 solo deja sin efecto lo que c.21408 daba por cubierto del máster y
del flag de invitados; las entradas 1-23 siguen firmadas tal cual. Ficha:
`docs/microcopy/2026-11-10-SCRUM-1676-apunta-primero.md`.

> Apunta primero lo que has hecho: al firmar ya no se puede cambiar.

## Causa, medida

- `public/dashboard/css/styles.css:3876-3881` (en `origin/main`): `[data-parte-firmar]` pinta el
  botón de firma del cliente en `var(--brand)` **siempre**, sin mirar si el parte tiene líneas.
- `public/dashboard/js/parteDetailView.js` `pintarLasDosFirmas` (`:1141` en main): pinta el botón
  igual con el parte vacío o lleno, y el aviso «Con la primera firma, lo apuntado queda fijo.» no
  dice qué hacer antes.
- Matiz a la descripción del ticket: el operario **no** llega a congelar un parte vacío. Desde
  SCRUM-890 el pad no se abre con cero líneas (`firmarParte`, aviso `parteVacioNoSeFirma`) y el
  servidor lo rechaza (`partes.routes.ts:676` y `:760`, 409 `parte_vacio`, regla `puedeFirmarse` en
  `parteTrabajo.ts:437`). El defecto real es de jerarquía: la acción irreversible y además imposible
  era la única verde (canon de SCRUM-823).

## Arreglo

- **«Vacío» = la pregunta del servidor**: cero líneas (`puedeFirmarse`). La aceptación decía «sin
  líneas ni horas»; con horas y sin líneas el servidor rechaza la firma igual, así que se usa la
  regla del dominio y no otra (con horas sola, la firma seguiría siendo un callejón).
- Vista: con el parte vacío, los botones de firma llevan `data-parte-firma-en-espera="1"` y el
  aviso de arriba es el texto firmado (en el sitio de «queda fijo», que dice lo mismo sin el qué
  hacer). Con una línea, todo vuelve a como estaba.
- CSS (bloque propio marcado S4 en el contenedor de S2): `[data-parte-firmar][data-parte-firma-en-espera]`
  vuelve al aspecto secundario (fondo `--surface`, texto `--ink`, borde `--border`; hover de `.btn-secondary`).
- El botón **sigue** ahí con su camino: si se pulsa, SCRUM-890 dice por qué no se firma.

## Prueba

- `tests/scrum1676-firma-no-es-primaria-en-parte-vacio.test.mjs` — 4 casos contra lo PINTADO por la
  vista real (vm) y el CSS real. **Rojo sin el cambio** (vista y CSS de `origin/main`): ① y ③ caen
  («la firma sigue siendo la acción principal de un parte vacío», «nadie lee la marca: el botón
  sigue verde»); ② y ④ (controles positivos) en verde. Con el cambio: 4/4.
- `tests/scrum653c-firmas-sin-coletilla.test.mjs` sigue 4/4 (su parte tiene una línea).
- Tanda entera en local (`node --test tests/*.test.mjs`, TAP a fichero fuera del árbol): los rojos
  son los mismos con y sin este cambio — 1199, 245, 385, 471, 475, 476 (árbol sin `node_modules`
  propio ni CLI de Prisma), 1321 (temporal en C: y árbol en D:, SCRUM-1655) y 1266b/1244c, que caen
  de forma intermitente: 1266b a solas dio 1 rojo en 3 vueltas en este árbol, y 0/5 con la vista de
`main` en el árbol de SCRUM-1677 (el traspaso de S4 ya lo daba intermitente en `main`, 1/8). Este
  registro faltaba en 267 (sin ancla): corregido. Árbitro: el obligatorio del CI.

## Capturas (banco con la vista y el CSS REALES, `evidencias/SCRUM-1676/banco/servir.mjs`)

| caso | 390 | estilo medido del botón del cliente |
| --- | --- | --- |
| antes · vacío (main) | `evidencias/SCRUM-1676/antes-vacio-390.png` | fondo `rgb(22,163,74)`, texto blanco · aviso «queda fijo» |
| después · vacío | `evidencias/SCRUM-1676/despues-vacio-390.png` | fondo `rgb(255,255,255)`, texto `rgb(15,28,23)` · aviso «Apunta primero…» |
| después · con una línea | `evidencias/SCRUM-1676/despues-con-linea-390.png` | fondo `rgb(22,163,74)` (vuelve a primaria) · aviso «queda fijo» |

A 1280 (medido, sin captura): después · vacío = fondo `rgb(255,255,255)`, marca puesta. El
«antes» en yaqu.app es el de SCRUM-1658: `evidencias/SCRUM-1658/capturas/08-parte-abierto-390.png`.

**Falta:** la verificación en **yaqu.app** del «después», que sólo existe cuando el PR entre en
`main` (regla 42: el ticket no se cierra hasta entonces).
