# SCRUM-1078 · Un técnico escribe precios en su propio parte con `PATCH {precios:[…]}`

**Medido contra:** `origin/main` = `29e80483a14be1432463dc1ceb68b421cec20641` · 2026-09-21T18:10:26Z (cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1078-precios-solo-admin` · **Carril:** S1 · **Decisión:** el fundador, vía orquestador (precios SOLO admin, petición entera rechazada, como SCRUM-164).

## Paso 0
Hallazgo de SCRUM-992 (sonda: 200 y el importe queda en la fila). `permisoDeCampos` solo mira el estado del parte. La única pantalla que manda `precios` es `parteOficinaView.js` (oficina): el gate no rompe ninguna pantalla.

## Lo que cambia
- `roleCapabilities.ts` · `adminOnlyParteField(body)`: `'precios'` si viene; declarada en `FIELD_LEVEL_ROLE_GATES` (`adminRouteDeclarations.ts`).
- `partes.routes.ts` · `PATCH /:id`: con `!seesAllJobs(rol)` y `precios` → 403 `forbidden` (`required_role: admin`, `field`), antes de `permisoDeCampos`: no se aplica nada. Sin texto nuevo para el usuario.

## El juez: `tests/scrum1078-precios-del-parte-solo-admin.test.mjs` (sin banco; regla pura + AST del handler)
Regla, control positivo (`seesAllJobs`), declaración y cableado (gate antes de `permisoDeCampos`, solo a quien no ve todo, con 403). 4 tests + los 7 de `scrum164` en verde.

## Mutaciones (3, todas caen en rojo; restaurado, verde)
M1 gate invertido (`seesAllJobs` sin `!`) · M2 respuesta 400 en vez de 403 · M3 la regla sustituida por `null`.

## Límite
No hay prueba con banco de «técnico 403 / admin 200» sobre la app real: el cableado se verifica por AST. Cubierto por la red estructural de `scrum992` para el resto de rutas.
