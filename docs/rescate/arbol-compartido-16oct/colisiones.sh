#!/usr/bin/env bash
# Sólo LEE. ¿Qué rutas NO SEGUIDAS del árbol compartido existen también en origin/main?
# (Sólo la ruta exacta. Mayúsculas y carpeta-contra-fichero se midieron el 16-oct con node: 0.)
# Uso: bash colisiones.sh D:/MILLONARIO/cobroFlash/cobroflash-backend
S="${1:?falta el árbol}"
echo "control positivo (tiene que decir blob): $(echo origin/main:package.json | git -C "$S" cat-file --batch-check)"
echo "control negativo (tiene que decir missing): $(echo origin/main:no-existe.txt | git -C "$S" cat-file --batch-check)"
lista=$(git --no-optional-locks -C "$S" ls-files -o --exclude-standard)
echo "no seguidos: $(printf '%s\n' "$lista" | grep -c .) · origin/main $(git -C "$S" rev-parse --short origin/main)"
choques=$(printf '%s\n' "$lista" | sed 's|^|origin/main:|' | git -C "$S" cat-file --batch-check \
  | paste -d'|' - <(printf '%s\n' "$lista") | grep -v ' missing|' | cut -d'|' -f2)
echo "COLISIONES: $(printf '%s' "$choques" | grep -c .)"
printf '%s\n' "$choques" | sed 's/^/  = /'
