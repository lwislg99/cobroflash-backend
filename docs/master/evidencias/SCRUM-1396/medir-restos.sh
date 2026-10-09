#!/usr/bin/env bash
# SCRUM-1396 · ¿dejan resto las 24 llamadas que acusa el censo por variable? Camino feliz y camino de FALLO.
#
#   bash docs/master/evidencias/SCRUM-1396/medir-restos.sh <carpeta de trabajo>
#
# La carpeta de trabajo va FUERA del repositorio y SIN ESPACIOS en la ruta (con espacios,
# tests/scrum1289b-reporters-como-argumentos.test.mjs cae por su cuenta: medido el 8-oct). Se crea si no
# existe y NO se borra: ahí quedan el TAP y el log del espía de cada pasada.
#
# Cada fichero de test corre SOLO, con TEMP/TMP/TMPDIR en una carpeta vacía propia y el espía
# (espia-mkdtemp.cjs) cargado por NODE_OPTIONS. Al acabar se mira cuáles de los directorios que el espía
# anotó siguen existiendo. En la pasada de fallo, tras cada llamada acusada el siguiente método de
# `assert` lanza un AssertionError: el test cae por un assert, no por un exit.
#
# El control (control-del-espia.fixture.txt) se guarda como TEXTO y se copia a la carpeta de trabajo para
# correrlo: es un test que FUGA a propósito, y como .mjs dentro del árbol el censo lo acusaría con razón.
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../../../.." && pwd)"
T="${1:?uso: medir-restos.sh <carpeta de trabajo, fuera del repo y sin espacios>}"
case "$T" in *" "*) echo "NO-PUDE-MIRAR: la carpeta de trabajo lleva espacios"; exit 2;; esac
mkdir -p "$T" && T="$(cd "$T" && pwd)"
case "$T/" in "$RAIZ"/*) echo "NO-PUDE-MIRAR: la carpeta de trabajo cae dentro del repositorio"; exit 2;; esac
nativa() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
# Con barras hacia delante: dentro de NODE_OPTIONS una `\` es un escape y la ruta llega sin separadores.
if command -v cygpath >/dev/null 2>&1; then ESPIA="$(cygpath -m "$AQUI/espia-mkdtemp.cjs")"; else ESPIA="$AQUI/espia-mkdtemp.cjs"; fi
cd "$RAIZ" || exit 2

# pasada <etiqueta> <fichero> <nombre> <líneas a armar, o -> [VAR=valor]
pasada() {
  local D="$T/$1/$3" armar="$4" extra="${5:-SIN_EXTRA=1}"
  mkdir -p "$D/tmp"
  local W L TAP rc nv=0 vivos="" tipo quien dir resto
  W="$(nativa "$D/tmp")"; L="$D/espia.log"; TAP="$D/tanda.tap"
  [ "$armar" = "-" ] && armar=""
  env "$extra" ESPIA_ARMAR="$armar" ESPIA_LOG="$(nativa "$L")" NODE_OPTIONS="--require \"$ESPIA\"" TEMP="$W" TMP="$W" TMPDIR="$W" \
    node --test --test-force-exit --test-reporter=tap --test-reporter-destination="$TAP" "$2" >/dev/null 2>&1
  rc=$?
  touch "$L"
  while IFS=$'\t' read -r tipo quien dir resto; do
    [ "$tipo" = "C" ] || continue
    if [ -d "$dir" ]; then nv=$((nv+1)); vivos="$vivos $quien"; fi
  done < "$L"
  echo "$1 · $3 · salida $rc · tests $(grep -cE '^(not )?ok ' "$TAP" 2>/dev/null) · rojos $(grep -c '^not ok ' "$TAP" 2>/dev/null) · creados $(grep -c '^C' "$L") · armados $(grep -c '^A' "$L") · disparados $(grep -c '^F' "$L") · en TEMP al final $(ls -A "$D/tmp" | wc -l) · creados que siguen vivos $nv${vivos:+ →$vivos}"
}

echo "REPOSITORIO $(git rev-parse HEAD) · $(node --version) · $(uname -s)"
echo
echo "== CONTROLES DEL INSTRUMENTO (esperado: 0 · 1 · 0 · 1 creados que siguen vivos)"
C="$T/control-del-espia.test.mjs"; cp "$AQUI/control-del-espia.fixture.txt" "$C"
pasada control-1-pasa-y-borra "$C" control -
pasada control-2-pasa-y-nadie-borra "$C" control - CONTROL_FUGA=1
pasada control-3-falla-con-finally "$C" control control-del-espia.test.mjs:11
pasada control-4-falla-sin-finally "$C" control control-del-espia.test.mjs:12

echo
echo "== LOS 18 FICHEROS DE TEST (20 de las 24 llamadas)"
for f in $(cut -d: -f1 "$AQUI/las-24-llamadas.txt" | grep '\.test\.mjs$' | sort -u); do
  n="$(basename "$f" .test.mjs)"
  arm="$(grep "^$f:" "$AQUI/las-24-llamadas.txt" | sed 's#^tests/##' | paste -sd, -)"
  pasada feliz "$f" "$n" -
  pasada fallo "$f" "$n" "$arm"
done

echo
echo "== LOS 4 AYUDANTES (las otras 4 llamadas), por los tests que los importan"
ARM="$(grep '^tests/_' "$AQUI/las-24-llamadas.txt" | sed 's#^tests/##' | paste -sd, -)"
for f in $(git grep -lE "_(alcance-desde-entradas|comparador-alcance|export-que-sobra|huerfanos-en-modulos-vivos)\.mjs" -- 'tests/*.test.mjs' | sort -u); do
  n="$(basename "$f" .test.mjs)"
  pasada ayudantes-feliz "$f" "$n" -
  pasada ayudantes-fallo "$f" "$n" "$ARM"
done

echo
echo "== POR LÍNEA ACUSADA, pasadas de fallo: fallos inyectados (F) y directorios suyos que quedan"
for l in $(sed 's#^tests/##' "$AQUI/las-24-llamadas.txt"); do
  f=0; q=0
  for log in "$T"/fallo/*/espia.log "$T"/ayudantes-fallo/*/espia.log; do
    [ -f "$log" ] || continue
    while IFS=$'\t' read -r tipo quien dir resto; do
      [ "$quien" = "$l" ] || continue
      [ "$tipo" = "F" ] && f=$((f+1))
      [ "$tipo" = "C" ] && [ -d "$dir" ] && q=$((q+1))
    done < "$log"
  done
  echo "  $l · fallos inyectados $f · quedan $q"
done
