#!/usr/bin/env bash
# pasadas.sh <etiqueta> <N> <segundos de carga> <fichero de test> [flags extra de node --test…]
# Corre N pasadas del fichero SOLO bajo carga (10 procesos ocupando CPU que se apagan solos) y
# cuenta las salidas. Cada pasada en su propio fichero. POBLACION en la primera linea, EXIT al final.
unset FORCE_COLOR NODE_OPTIONS NODE_TEST_CONTEXT
et="$1"; n="$2"; seg="$3"; f="$4"; shift 4
out="$CLAUDE_JOB_DIR/tmp/$et"; mkdir -p "$out"
echo "POBLACION: $n pasadas de $f · flags: --test $* · carga ${seg}s x10"
if [ "$seg" != "0" ]; then
  for i in 1 2 3 4 5 6 7 8 9 10; do
    node -e "const t=Date.now();while(Date.now()-t<${seg}000){}" &
  done
fi
ok=0; nativas=0; otras=0
for i in $(seq 1 "$n"); do
  node --test "$@" --test-reporter=tap "$f" > "$out/p$i.tap" 2>&1
  c=$?
  if [ "$c" = "0" ]; then ok=$((ok+1));
  elif grep -q "exitCode: 3221226505\|Assertion failed" "$out/p$i.tap"; then nativas=$((nativas+1));
  else otras=$((otras+1)); fi
done
echo "RESULTADO $et: ok=$ok · muertes nativas=$nativas · otros rojos=$otras · de $n"
echo "EXIT=0"
