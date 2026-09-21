#!/usr/bin/env bash
# SCRUM-935 · EJERCITA el paso del aviso, no lo lee. Tres casos: el que DEBE avisar, el que NO
# debe, y el suelo (sin marca de arranque). Corrido o no cuenta.
set -uo pipefail
PASO="$1"   # el .sh volcado del `run:` del paso que mide
OUT="$2"

echo "== bash -n de todos los pasos volcados =="
malos=0
for f in "$(dirname "$PASO")"/paso-*.sh; do
  if bash -n "$f"; then echo "  OK sintaxis  $(basename "$f")"; else echo "  ROTO         $(basename "$f")"; malos=$((malos+1)); fi
done
echo "  pasos revisados: $(ls "$(dirname "$PASO")"/paso-*.sh | wc -l) · rotos: $malos"

corre() {
  local etiqueta="$1"; shift
  local resumen="$OUT/summary-$etiqueta.txt"
  : > "$resumen"
  echo ""
  echo "== CASO $etiqueta =="
  ( export GITHUB_STEP_SUMMARY="$resumen" PRESUPUESTO_S=1800 AVISO_S=1200
    "$@"
    bash "$PASO" ) > "$OUT/stdout-$etiqueta.txt" 2>&1
  echo "  EXIT=$?"
  echo "  --- stdout ---"; sed 's/^/  /' "$OUT/stdout-$etiqueta.txt"
  echo "  --- resumen del job ---"; sed 's/^/  /' "$resumen"
}

ahora=$(date +%s)

# (a) POSITIVO: lleva 1.300 s, por encima del umbral de 1.200 → TIENE que avisar
export META_INICIO=$(( ahora - 1300 ))
corre positivo true

# (b) NEGATIVO: lleva 100 s → NO puede avisar
export META_INICIO=$(( ahora - 100 ))
corre negativo true

# (c) SUELO: sin marca de arranque → «NO PUDE MIRAR», nunca un silencio
unset META_INICIO
corre suelo true

echo ""
echo "VEREDICTO:"
a=$(grep -c 'se acerca a su techo' "$OUT/stdout-positivo.txt" || true)
b=$(grep -c 'se acerca a su techo' "$OUT/stdout-negativo.txt" || true)
# ⚠️ ERROR PROPIO, 20-sep: esto miraba stdout, y el «NO PUDE MIRAR» va al RESUMEN DEL JOB
# (stdout lleva el ::warning, con otra grafía). La primera pasada dio (c)=0 sobre un paso sano:
# no era un hallazgo, era la aserción mirando otro sitio. Se cuentan LOS DOS.
c=$(cat "$OUT/stdout-suelo.txt" "$OUT/summary-suelo.txt" | grep -ci 'no pude mirar' || true)
echo "  (a) positivo avisa: $a (tiene que ser >=1)"
echo "  (b) negativo avisa: $b (tiene que ser 0)"
echo "  (c) suelo dice NO PUDE MIRAR: $c (tiene que ser >=1)"
if [ "$malos" -eq 0 ] && [ "$a" -ge 1 ] && [ "$b" -eq 0 ] && [ "$c" -ge 1 ]; then echo "EXIT=0"; exit 0; fi
echo "EXIT=1"; exit 1
