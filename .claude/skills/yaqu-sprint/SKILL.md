---
name: yaqu-sprint
description: Abrir y ejecutar un sprint de YaQu según el protocolo AA1 del master — registry → sprint activo → plan de archivos → OK del fundador → UNA tarea → done/rollback. Usar al empezar cualquier trabajo de sprint o cuando el usuario invoque /yaqu-sprint.
---

# /yaqu-sprint — Abrir sprint (protocolo AA1)

> Derivado de `docs/YAQU_MASTER.md` Parte AA (regla 35). Si esta skill y el master
> divergen, gana el master.

## Pasos (en orden, sin saltarse ninguno)

1. **Registry.** Abrir `docs/YAQU_MASTER.md` → Parte U (Sprint Registry, cola única — regla 31).
   Localizar el sprint activo y su detalle (U1.x). El orden de U es estricto: no reordenar
   ni intercalar sin cambio de master. Duda → preguntar al fundador, nunca asumir.
2. **Sprint activo.** Confirmar dependencias de la fila ("Depende de") y flags implicados
   (Parte P). Si una dependencia no está ✅, parar y avisar.
3. **Plan de archivos ANTES de tocar código.** Para la tarea atómica elegida, listar:
   archivos a crear/modificar, si hay schema (¿aditivo?), si hay flags, tests relevantes
   y el criterio de Done + Rollback que da el master para esa tarea.
4. **OK.** Presentar el plan al fundador y esperar su OK si la tarea toca cualquier
   stop condition de AA1.4: claims fiscales/VeriFactu · dinero real o flujo de cobro en
   producción · plantillas/categoría de Meta · schema no aditivo · datos de clientes ·
   flags de la Parte P a nivel global.
5. **UNA tarea → un commit → push.** Tests relevantes en verde (`npm test`) antes del
   commit. Verificación en **yaqu.app** (no localhost) antes de cerrar la tarea.
6. **Done/Rollback.** Comprobar el criterio de Done del master para la tarea; dejar
   constancia (en U si el master lo pide, en BUGS.md si salieron bugs). Si algo se rompe:
   aplicar el rollback documentado de la fila (normalmente: flag off o revert atómico).

## Recordatorios duros
- Prohibido inventar estados, transiciones, flags o textos (Partes L, P, N5, K1).
- Bugs encontrados → `docs/BUGS.md` con su formato; nada de arreglos "de paso".
- Schema: siempre `prisma migrate diff` (preview) antes de `db push`; `migrate dev` PROHIBIDO.
- Cierre de sprint → usar `/yaqu-release-check`.
