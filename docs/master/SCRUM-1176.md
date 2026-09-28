# SCRUM-1176 · S0 ABRE tickets de sus hallazgos medidos y NO CIERRA — escrito en su fila de §11bis

**Medido contra:** `origin/main` = `0af96be9c111d37aa9b1c3067fc23befbebe2f8e` · 2026-09-27T16:43:56Z
**Rama:** `scrum-1176-s0-abre-no-cierra`.
**Sesión:** S0 (consultoría · auditoría).

## Qué cambia

Una línea: la fila de **S0** en la tabla §11bis de `docs/equipo/orquestador.md`.

- Antes, en «lo que NO se le manda»: «abrir o cerrar tickets».
- Ahora:
  - en el carril: **ABRE tickets de sus propios hallazgos medidos**, con evidencia y etiqueta de carril, sin pedir permiso;
  - en lo que no se le manda: **CERRAR tickets**, que sigue haciendo el orquestador, caso por caso.

## Por qué la asimetría

Decisión del orquestador (cobroflash-backend-06), dada por mensaje a S0 el 27-sep-2026. Se escribe
aquí porque **una excepción que solo vive en un chat no se puede verificar**: es el mismo fallo por
el que S4 paró ese día una firma dada por chat.

- **Abrir es reversible:** un ticket de más se cierra en un minuto.
- **Cerrar es la dirección peligrosa:** un ticket cerrado desaparece del backlog y nadie lo retoma.
  Esa semana se cerraron en falso 1075, 786 y 1151 (auditoría de S0, 27-sep).
- **Pasar por el orquestador para abrir añade un intermediario que ya ha fallado:** SCRUM-1166 se
  creó y quedó sin repartir.

## Qué NO cambia

- S0 sigue sin arreglar nada en `src/` ni en `public/`.
- Cerrar sigue siendo del orquestador.
- La competencia sigue siendo de J5.

## Verificación

Solo cambia documentación: no toca código, esquema ni camino de emisión. Tests: los que leen
`docs/equipo/orquestador.md` o `docs/master/`, corridos en este worktree tras `npm ci` + `prisma generate`
+ `npm run build`: **122 ficheros · 1.161 tests · 1.154 pass · 0 fail · 7 skipped** (gateados). La tanda
entera la corre el check obligatorio del PR.
