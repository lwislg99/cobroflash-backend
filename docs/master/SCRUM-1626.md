# SCRUM-1626 · «Plan Fundador» en la barra lateral (hermano de SCRUM-1623)

**Medido contra:** `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29` · 2026-10-29T10:04:54Z (cabecera `Date:` de GitHub al escribir esto)

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin tokens, estilos ni componentes nuevos: una entrada más en un mapa de rótulos que ya existía.

A9: sin fallo que generalice — el defecto se reprodujo por ejecución antes de tocar nada, y la firma se leyó en su comentario de Jira (c.21169), no en el encargo ni en el traspaso (que decía c.21167).

Puesto S2, rama `scrum-1626-plan-fundador`, worktree `s2-29oct-1626`. Carril: `node scripts/carriles.mjs de public/dashboard/js/app.js` → S2 (contenedor), `dos-equipos.md:150`.

## APILADA sobre SCRUM-1623

Las dos tocan la MISMA línea (`app.js:184`, `planLabels`) y 1623 (#2960) no ha entrado en `main`. Basada en `main` habría sido un conflicto seguro sobre una línea; por eso esta rama sale de la punta de 1623 (`bb2c51571`). Mientras 1623 no entre, el diff de este PR la incluye.

## El defecto, por ejecución

`planLabels` no conocía `founding` y el subtítulo de la tarjeta de usuario cae a `me.plan` en crudo: el dueño de una cuenta del plan de los primeros leía «founding».

**Rojo primero** (`tests/scrum1626-plan-fundador-en-la-barra.test.mjs`, 3 casos) sobre la punta de 1623: cae ① con `actual: 'founding'`, `expected: 'Plan Fundador'`; pasan los dos controles.

## La firma, en su fuente

SCRUM-1626 c.21169 (27-oct-2026, transcrita por el orquestador del equipo de Luis). La respuesta literal del fundador: «si Plan Fundador me gusta». El comentario la da por firma después de pedirle expresamente que la confirmara o dijera otra. Cubre exactamente el texto puesto.

## El arreglo

`app.js:184`: `founding: 'Plan Fundador'` en `planLabels`, con la cita de c.21169 **en la misma línea**, detrás de la de 1623. `app.js` no cambia de número de líneas (hay tests anclados a líneas suyas: `scrum601` en la 388).

## El test

El mismo mecanismo que el de 1623: saca por AST el tramo de `initApp` que pinta `#sidebar-user`, lo ejecuta en una caja de arena y lee el `innerHTML` (patrón con hueco para atributos, SCRUM-553).

- ① dueño con `plan: 'founding'` → «Plan Fundador».
- ② control: `pro` → «Plan Pro» y `equipo` → «Plan Equipo», sin cambios.
- ③ control: quien no es el dueño sigue viendo «Operario · Reformas Ruiz», también con `founding`.

Con el arreglo: 3 de 3; y `scrum1623`, `scrum553` y `scrum601` en verde.

## En yaqu.app: NO SE PUEDE MIRAR, y por qué

`plan = 'founding'` sólo lo escribe el servidor tras pagar el checkout `founding` de Stripe (`subscriptions.routes.ts:110-131`, precio `founding_monthly`, 9,90 €/mes) y su webhook. La cuenta de QA está en `pro`. Para verlo haría falta un pago real (STOP: dinero real) o escribir el plan en la base (no es de este puesto). No lo he intentado.
