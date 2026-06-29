#!/usr/bin/env bash
# guard-dangerous — hook PreToolUse (master Parte AA2, reglas 3 y AA1.8).
# Bloquea: `prisma migrate dev` · `db push` sin preview confirmado · `--force` · `rm -rf`
# fuera del workspace. Recibe por stdin el JSON del tool call; salir con código 2 bloquea
# la ejecución y el mensaje de stderr vuelve a Claude.

input="$(cat)"

block() {
  echo "guard-dangerous BLOQUEADO: $1" >&2
  exit 2
}

# 1) prisma migrate dev — PROHIBIDO siempre (regla 3: Prisma sin TTY)
if echo "$input" | grep -qE 'prisma[^\"]{0,40}migrate +dev'; then
  block "'prisma migrate dev' esta prohibido (regla 3). Usa 'prisma migrate diff' (preview) y luego 'db push' autorizado."
fi

# 2) db push sin preview confirmado — exige sentinel de un solo uso.
#    Flujo: migrate diff -> ensenar diff al fundador -> con su OK crear .claude/allow-db-push
#    (touch) -> el siguiente db push pasa y consume el sentinel.
if echo "$input" | grep -qE 'prisma[^\"]{0,40}db +push'; then
  sentinel="$(dirname "$0")/../allow-db-push"
  if [ -f "$sentinel" ]; then
    rm -f "$sentinel"
  else
    block "'db push' sin preview confirmado. Ejecuta el preview (migrate diff), ensena el diff al fundador y, con su OK, crea .claude/allow-db-push (un solo uso) antes de reintentar."
  fi
fi

# 3) --force (git push --force, npm --force, prisma --force...)
if echo "$input" | grep -qE '(^|[^A-Za-z-])--force(-with-lease)?\b'; then
  block "'--force' esta prohibido por AA2. Si es imprescindible, pide OK explicito al fundador y que lo ejecute el."
fi

# 4) rm -rf fuera del workspace (ruta absoluta, unidad o ~). Relativo dentro del repo se permite.
if echo "$input" | grep -qE 'rm +-[a-zA-Z]*[rR][a-zA-Z]*[fF][a-zA-Z]* +("?(/|~|[A-Za-z]:))'; then
  block "'rm -rf' con ruta absoluta fuera del workspace esta prohibido (AA2). Usa rutas relativas dentro del repo."
fi

exit 0
