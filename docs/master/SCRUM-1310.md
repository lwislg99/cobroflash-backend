# SCRUM-1310 · 13 de las 37 claves ajenas de producción no tienen DDL en el repositorio (re-medición y preguntas)

**Medido contra:** `origin/main` = `0a7eef15c907acc7646ed7ab33cab9176f8f1bc0` · 2026-10-24T10:50:07Z (hora de GitHub)

A9: aviso → cicatriz J5 «Di por ausente un `CREATE TABLE "customers"` porque mi patrón no admitía el prefijo `"public".` de las migraciones congeladas, y el 1-oct el ticket lo publicó como hecho» — no se pudo comprobar: un patrón que no casa da cero igual que una tabla que falta, y ningún guard sabe qué formas de DDL previó el patrón de una sesión; el instrumento de este tramo siembra las tres formas del árbol y dice CIEGO si pierde una (mutante sin el prefijo: «2 de 3 vistos → CIEGO»).

Sesión J5 (`jv-j5ah`, 24-oct, equipo de Javier). Encargo del orquestador `cobroflash-backend-95`: **solo medir y preguntar**.
No se conecta a ninguna base, no se compila y no se corre ninguna tanda. Lo que se entrega: el comentario **SCRUM-1310 c.20753**
(medición y preguntas ✅/❌ para el fundador), este registro, el instrumento y su salida en `docs/master/evidencias/SCRUM-1310/`,
y una línea en `docs/equipo/cicatrices/J5.md`.

## Ⓐ Estado

- **(i)**: decidida en c.17665 (Javier, 1-oct: «1-Si se para el guard»). En `main` no hay ningún guard de clave ajena.
- **(ii)**: **abierta**. Nadie la ha empezado: no hay commits con el número, ninguna rama `scrum-1310*` en el remoto y ningún PR.
- **No está resuelto por efecto.** El estado «Acción del fundador» sigue siendo el correcto: la P1 de c.20753 espera al fundador.

## Ⓑ Re-medición

`node docs/master/evidencias/SCRUM-1310/medir-fk.mjs 0a7eef15c907acc7646ed7ab33cab9176f8f1bc0` → `salida.txt`.

- **Población:** 75 fuentes (15 congeladas y 60 de `docs/sql/`), 33 modelos.
- **Claves ajenas:** 37, y casa con el recuento por texto de `@relation(fields:)`. Hay **24 con DDL** y **13 sin fuente**, repartidas en 8 tablas. Son las mismas 13 que el 1-oct, y ninguna declara `onDelete` en el esquema.
- **Controles:** un FK sembrado con CASCADE, que se ve; tres `CREATE TABLE` sembrados, que se ven los 3; y un cero derivado de la hora, que da 0 aciertos. Sin semilla, el instrumento dice CIEGO.

## Ⓒ Lo que el ticket daba por cierto

1. **«`customers` no tiene CREATE TABLE»: falso ya el 1-oct.** Está en `20250919125018_init_schema/migration.sql:17`, con el prefijo `"public".`. Las tablas sin `CREATE TABLE` son 6: `auth_sessions`, `expenses`, `quote_requests`, `quote_templates`, `team_members` y `customer_events`. La clave ajena `customers_merchant_id_fkey` sí sigue sin DDL.
2. **SCRUM-1307:** está Finalizada y en `main` (#2025, `ae8cb3180`). El ticket la daba por «en construcción».
3. **«Nadie lo vigila»:** sigue siendo cierto para las 13. `docs/sql/verificacion-deriva-produccion.sql:58` solo mira 2 de las 37 claves ajenas (las de `job_assignees`).
4. **Una sonda ya espera la (ii):** `docs/master/evidencias/SCRUM-1550/sondas.json:52` busca `invoices_rectifies_id_fkey` en `docs/sql`.

## Ⓓ Preguntas (el texto, en c.20753 §4)

- **P1 (recomiendo ✅):** volcar las 13 a `docs/sql/`. Javier corre en las tres bases un `SELECT` de solo lectura sobre `pg_constraint`, y la sesión lo pasa a un fichero.
- **P2:** el alcance. Recomiendo el mínimo: las 13 claves ajenas con su `ON DELETE`.
- **P3:** un trinquete por ficheros que impida que el hueco crezca. Solo si la P1 sale ✅: puede leerse como lo que c.17665 rechazó.

Carril: `docs/sql/`, `prisma/schema.prisma` y esta carpeta de evidencias salen «sin fila en §3» en `carriles.mjs de`. El ticket no lleva etiqueta `area-*`.

**Sin medir, y lo digo:** las reglas reales de borrado de las 13 en las bases (solo consta `rectifies` = SET NULL, del 1-oct). Tanda local: NO CORRIDA (encargo de solo docs).
