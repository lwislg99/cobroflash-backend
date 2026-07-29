---
name: cerebro-yaqu
description: Cerebro operativo de YaQu para sesiones de Claude Code. Usar SIEMPRE al
  arrancar cualquier tarea en cobroflash-backend, antes de abrir un PR, antes de cerrar
  o reportar un ticket, y antes de tocar schema, staging, dinero, fiscal o superficie
  pública. Contiene arranque, disparadores anti-error y STOPs.
---

# Cerebro YaQu — jerarquía: YAQU_MASTER.md > esta skill > cualquier otra

## Al arrancar (siempre, en este orden)
1. Lee docs/CLAUDE.md, docs/YAQU_MASTER.md (gobierna), docs/ASESOR.md, docs/ERRORES_ASESOR.md.
2. `git ls-remote --heads origin` en listado COMPLETO (no filtrado): ¿existe ya rama o
   worktree con tu número de ticket? Si sí → PARA y repórtalo. Han pasado 4 duplicados.
3. Worktree PROPIO siempre. Jamás trabajes en main.

## Disparadores anti-error ("el vocabulario estaba, faltaba el disparador")
- Vas a AFIRMAR un estado → míralo en la fuente (R1). Código: léelo. Config externa:
  ábrela en la herramienta. Nunca deduzcas por el síntoma ni por el nombre.
- Vas a decir "hecho/mergeado/ya existe" → `git merge-base --is-ancestor <commit>
  origin/main` o ls-remote completo (R2). Jamás el estado de Jira ni un resumen en prosa.
- Escribes un guard → pruébalo EN ROJO con un caso que caiga DENTRO del mecanismo
  (ojo a ventanas y tolerancias: un desvío enorme se sale del margen y el rojo no sale).
  Si el rojo no aparece, la primera hipótesis es "caso mal elegido", no "guard de sobra".
- Un guard de TEXTO se caza a sí mismo en el comentario que explica la prohibición.
  Para vigilar código, análisis estático del árbol (AST), no `grep`.
- Ves un verde → pregúntate qué mediría ese verde si el sistema estuviera roto.
- Un artefacto que no corre en `npm test` no existe: el scratchpad es efímero y el CI
  no lo ve. Todo guard nuevo nace dentro de la suite.
- Cualquier script (también desechable) que toque una URL de BD → parseBDSegura de
  _db-guard.mjs. Nunca parseo a mano (R7: una credencial se protege impidiendo que
  el error salga, no redactando mensajes).

## STOPs — para y pide GO del fundador con diff/preview
Schema (orden: staging → yaqu_dev_javier → producción; prisma/schema.prisma es dominio
exclusivo del fundador) · Dinero · Fiscal · Superficie pública.

## Hallazgos (regla 37)
Se arregla DENTRO solo si las TRES: misma zona que tocas + bloquea tu tarea + cabe en el
PR. Si no → ticket con carril, siguiente acción concreta y gate. Hallazgo de otro carril:
se reporta, no se arregla (regla 9).

## Antes de abrir el PR
- Compare completo: https://github.com/lwislg99/cobroflash-backend/compare/main...<rama>
- `gh` NO está instalado a propósito: el PR lo abre el fundador. Deja el cuerpo escrito.
- Microcopy: solo textos oficiales del máster (regla 30). Dependencia nueva: OK del
  fundador (regla 36). Suite completa en verde.
- Entrada en YAQU_MASTER.md al final. Conflicto ahí = conservar AMBAS entradas por nº
  de ticket. Descripciones de Jira <1.500 caracteres.

## Vetos permanentes
YaQu NO es un ERP ni un CRM (parte Z) · WhatsApp = Meta Cloud API directa, jamás
WATI/Zoko/n8n · INVOICING_ES_ENABLED OFF para merchants reales · VeriFactu se responde
SOLO con el guion H2 · Semáforo fiscal: se impide solo lo ROJO (irreversible); un ÁMBAR
jamás se bloquea — se avisa y se registra en AuditLog.
