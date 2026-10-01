#!/usr/bin/env bash
# correr.sh <modo> <via> <salida.tap>
#   via = opciones : los reporters van en NODE_OPTIONS (como ci.yml en main)
#   via = argumentos : los reporters van como argumentos del `node --test` (como propone #2000)
# Escribe el TAP en <salida.tap> y la consola en <salida.tap>.consola. Imprime EXIT= al final.
set -u
cd "$(dirname "$0")"
modo="$1"; via="$2"; tap="$3"
unset FORCE_COLOR NODE_TEST_CONTEXT NODE_OPTIONS
rm -f "$tap" "$tap.consola" "$tap.testigo"
export MODO="$modo" TESTIGO="$tap.testigo"
if [ "$via" = "opciones" ]; then
  NODE_OPTIONS="--test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=$tap" \
    node --test --test-force-exit --test-concurrency=1 a.test.mjs b.test.mjs c.test.mjs > "$tap.consola" 2>&1
else
  node --test --test-force-exit --test-concurrency=1 \
    --test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination="$tap" \
    a.test.mjs b.test.mjs c.test.mjs > "$tap.consola" 2>&1
fi
echo "modo=$modo via=$via EXIT=$? testigo=$(cat "$tap.testigo" 2>/dev/null | tr '\n' ';')"
