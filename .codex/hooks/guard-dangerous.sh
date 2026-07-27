#!/usr/bin/env bash
# guard-dangerous (espejo de Codex) — hook PreToolUse (master Parte AA2, reglas 3 y AA1.8).
#
# SCRUM-176: este fichero YA NO tiene copia de las reglas. Delega en la MISMA lógica que usa
# Claude Code (`.claude/hooks/guard-dangerous.mjs`).
#
# Por qué se colapsó en vez de arreglar las dos copias: eran byte a byte idénticas y el máster
# (AA2) ya avisaba de que "al tocar uno, revisar el espejo" — o sea, la divergencia estaba
# reconocida como riesgo y confiada a que alguien se acordara. Ya había divergido en algo real:
# esta copia buscaba el sentinel en `.codex/allow-db-push` mientras su PROPIO mensaje de error
# mandaba crear `.claude/allow-db-push`. Un Codex que siguiera la instrucción al pie de la letra
# seguía bloqueado, sin pista de por qué. Con una sola implementación eso no puede repetirse.
#
# FAIL-CLOSED: sin node no se puede evaluar la regla → se bloquea y se dice.

set -u

LOGICA="$(dirname "$0")/../../.claude/hooks/guard-dangerous.mjs"

if [ ! -f "$LOGICA" ]; then
  echo "guard-dangerous BLOQUEADO: no encuentro la logica del guard en $LOGICA (AA2). Sin evaluacion no hay paso." >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "guard-dangerous BLOQUEADO: no encuentro 'node' para evaluar el guard (AA2). Sin evaluacion no hay paso." >&2
  exit 2
fi

exec node "$LOGICA"
