# SCRUM-1698 · PARTES · «Sin apuntar» en los campos vacíos del parte firmado (PILOTO-1)

**Medido contra:** `origin/main` = `7c470d06a1ee321a11b244b8c6e330280b85f184` · 2026-11-11T14:55:52Z

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente, clase, token ni estilo nuevos —sólo
cambia el texto del hueco—; capturas antes/después a 390 abajo)

A9: comprobación → `tests/scrum1698-sin-apuntar-en-el-parte-firmado.test.mjs`

## Origen y firma

T5 de la ③ de SCRUM-1686 (Jira c.21459; registro `docs/master/SCRUM-1686.md` §SCRUM-1686b), anomalía e:
firmar sólo exige alguna línea (`puedeFirmarse`, `parteTrabajo.ts`), así que se firma un parte sin horas
ni desplazamiento, y en el firmado el hueco salía «—», que no distingue «no se apuntó» de «cero».
**Texto FIRMADO:** N3 de la tanda N1-N13, SCRUM-1686 c.21470: «Sin apuntar».

## Qué cambia

`public/dashboard/js/parteDetailView.js` (carril S4):

- `TEXTOS.sinApuntar = 'Sin apuntar'`, citando su firma.
- `campo()` gana un parámetro opcional `vacio` (lo que dice el hueco cuando no hay casilla). Sin él
  sigue «—», así que nada fuera de `pintarHoras` cambia.
- `pintarHoras` lo pasa en sus cuatro campos: entrada, salida, desplazamiento y kilómetros.
- Vacío = `null`, `undefined` o `''`. **Un 0 no es vacío**: «0» y «0 km» se pintan como hasta ahora.
- Borrador: sin cambios (allí hay casilla). Los datos del parte (obra, técnicos, notas) tampoco
  cambian: tienen sus propios textos firmados y quedan fuera del alcance de N3.

## Pruebas

- **Rojo primero** sobre `7c470d06a`: falla ① con «entrada = null en un parte firmado se pinta «—»». Los
  demás (cero, valor, borrador, alcance) ya pasaban, como deben.
- **Verde:** el nuevo + los del parte (`scrum1175*`, `1693`, `818*`, `1215*`, `720*`, `1233e`, `889`,
  `890*`, `1302*`, `1475*`, `1677*`, `1157*`, `1306*`, `700*`) = 289/289.
- **Tanda completa** (13 201 tests): fallan sólo los conocidos de un worktree fresco (1199, 1321, 245,
  385, 471, 475, 476, 976), más `scrum267`, por la cabecera de este registro (le faltaba el sha
  completo). Corregida: 14/14.
- Captura a 390 con la vista y el CSS reales (banco `evidencias/SCRUM-1698/banco/capturar.mjs`; antes =
  copia de `origin/main` en `banco/antes/`), parte firmado con `entrada: null`, `salida: ''`,
  `desplazamientos: null`, `kilometros: 0`:
  - antes: `— · — · — · 0 km` · `antes-firmado-390.png`
  - después: `Sin apuntar · Sin apuntar · Sin apuntar · 0 km` · `despues-firmado-390.png`

## Pendiente

- Verlo en yaqu.app tras el merge (regla 42) con un parte firmado de la cuenta QA que tenga algún campo
  vacío. Hoy ninguno lo tiene (PT-2026-005 lo lleva todo apuntado), así que habrá que crear uno.
- Lo otro de la anomalía e queda fuera de esta pieza: que se pueda firmar sin horas (`puedeFirmarse`) es
  del servidor (S1) y es una decisión de producto.
