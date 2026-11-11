# SCRUM-1693 · PARTES · el parte FIRMADO se lee en el orden de un papel (PILOTO-1)

**Medido contra:** `origin/main` = `f54f9e9a70ff37e6a3e7a9ca95ba53c1d8b4e237` · 2026-11-11T11:18:58Z

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: no hay componente, token, estilo inline ni texto nuevo —sólo se mueve la sección `.parte-datos-del-parte` ya existente, con sus líneas plegables de 48 px—; capturas antes/después a 390 abajo)

A9: comprobación → `tests/scrum1693-parte-firmado-orden-papel.test.mjs`

## Origen

X4 de la ③ de SCRUM-1686 (Jira c.21459; registro `docs/master/SCRUM-1686.md` §SCRUM-1686b), anomalía d
(`evidencias/SCRUM-1658/capturas/22-parte-firmado-1280.txt:31-45`): en un parte FIRMADO, «Datos del
parte» salía DEBAJO de las firmas que cierran el documento. Firma de D1-D3: SCRUM-1686 c.21461.
Ticket abierto por el orquestador desde el borrador de S4.

## Qué cambia

`public/dashboard/js/parteDetailView.js` (`renderParte`), carril S4:

- **Firmado** (`puedeEditarContenido.ok === false`, que en el servidor es todo estado que no es
  `borrador`, `parteTrabajo.ts:358-364`): cabecera → **Datos del parte** → horas → mano de obra →
  materiales → firmas → «Volver al trabajo».
- **Borrador: sin cambio** (SCRUM-1175 PR-C: allí manda lo que se apunta; lo sigue fijando
  `tests/scrum1175c-datos-del-parte-plegados.test.mjs`).
- **Sin texto nuevo** (regla 39): sólo se mueve una sección ya pintada. Los datos siguen plegados,
  con su resumen a la vista en la línea.

## Pruebas

- Rojo primero: `tests/scrum1693-…` falló sobre `f54f9e9a7` con «en el parte firmado «datos del
  parte» no va antes que «horas»»; los otros dos casos (control del borrador, inventario de datos)
  ya pasaban, como deben.
- Verde: el nuevo + `scrum1175c`, `scrum1677*`, `scrum1475*`, `scrum1302b*` = 26/26.
- Captura a 390, vista y CSS reales, medida en el DOM (banco `evidencias/SCRUM-1693/banco/capturar.mjs`,
  antes = copia de `origin/main` en `banco/antes/`):
  - antes: `cabecera → horas → mano_obra → materiales → firmas → volver → datos`
  - después: `cabecera → datos → horas → mano_obra → materiales → firmas → volver`
  - `evidencias/SCRUM-1693/antes-firmado-390.png` · `despues-firmado-390.png`

## Pendiente

- Ver en yaqu.app a 390 tras el merge (regla 42) con un parte firmado de la cuenta QA.
- Visto en la captura, no tocado: entre la última línea plegada («Notas») y «Horas y desplazamiento»
  queda poco aire. Lo daría `margin-bottom` en `.parte-datos-del-parte`, que vive en `styles.css`
  (contenedor de S2); no lo meto en esta pieza.

## Verificado en yaqu.app (regla 42) · 2026-11-11T14:40Z

- `main` = `412ddc20d0233162159567d4e7705bf845f71404` (merge #3060 = `c1fbaddae`). El
  `parteDetailView.js` SERVIDO por yaqu.app contiene la marca `SCRUM-1693` (128 855 bytes).
- Cuenta QA, 390 px, JS de producción, orden medido en el DOM (no leído del código):
  - **PT-2026-005 (id 13, firmado por cliente y técnico):** `cabecera → datos → horas → mano_obra →
    materiales → firmas → volver` · `prod-11nov/firmado-pt005-390.png`
  - **Control, PT-2026-003 (id 11, borrador):** `cabecera → horas → mano_obra → materiales →
    firmas → datos` (sin cambio, como debe) · `prod-11nov/borrador-pt003-390.png`
- Resultado: aceptación cumplida. Lo del aire entre «Notas» y «Horas y desplazamiento» sigue
  igual (CSS de S2, fuera de esta pieza).
