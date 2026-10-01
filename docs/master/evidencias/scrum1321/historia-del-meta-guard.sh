#!/usr/bin/env bash
# SCRUM-1321 · ¿Desde cuándo dice el job «meta-guard» lo que dice de scrum853 y de scrum859?
#
# Lee el LOG del job «meta-guard» de los últimos N runs de ci.yml y saca, por run: cuántas veces
# dictó `scrum853 · MUDO`, cuántas `scrum859 · CIEGO`, y su línea de recuento.
#
# Uso:  bash historia-del-meta-guard.sh <dir de salida FUERA del árbol> [N=260]
# Sale: <dir>/historia.tsv  (id · creado · evento · rama · sha · conclusión · 853 · 859 · recuento · bytes)
#
# DOS TRAMPAS, medidas al escribirlo (y la primera me dio 50 filas de «853 = 0» que no eran un dato):
#   · `gh api …/actions/jobs/<id>/logs` devuelve CERO bytes y sale 1 («the response contains
#     terminal escape sequences»). Un log vacío da 0 en los dos recuentos, igual que un run sano.
#     Por eso se usa `gh run view --job <id> --log`, y por eso la columna `bytes` y el rótulo
#     SIN-RECUENTO: una fila sin recuento NO se cuenta como «0 mudos».
#   · FORCE_COLOR en el entorno tiñe la salida de node. Se quita.
set -u
T="${1:?falta el directorio de salida}"; N="${2:-260}"
REPO="lwislg99/cobroflash-backend"
unset FORCE_COLOR
OUT="$T/historia.tsv"
if [ -e "$OUT" ]; then echo "ya existe $OUT: bórralo tú o da otro directorio"; exit 2; fi
gh run list --repo "$REPO" --workflow ci.yml --limit "$N" \
  --json databaseId,headSha,createdAt,headBranch,event \
  --jq '.[] | [.databaseId, .createdAt, .event, .headBranch, .headSha[0:8]] | @tsv' > "$T/runs.tsv" || exit 2
n=0
while IFS=$'\t' read -r id creado evento rama sha; do
  n=$((n+1))
  job=$(gh api "repos/$REPO/actions/runs/$id/jobs?per_page=50" \
        --jq '.jobs[] | select(.name|startswith("meta-guard")) | "\(.id)\t\(.conclusion)"' 2>/dev/null | head -1)
  jid="${job%%$'\t'*}"; concl="${job##*$'\t'}"
  if [ -z "$jid" ]; then
    printf '%s\t%s\t%s\t%s\t%s\tSIN-JOB\t-\t-\t-\t-\n' "$id" "$creado" "$evento" "$rama" "$sha" >> "$OUT"; continue
  fi
  log="$T/log-$id.txt"
  gh run view --repo "$REPO" --job "$jid" --log > "$log" 2>/dev/null
  bytes=$(wc -c < "$log")
  m853=$(grep -c 'scrum853-avisador-solo-obligatorio.test.mjs · MUDO' "$log")
  c859=$(grep -c 'scrum859-identidad-y-motivo-cerrado.test.mjs · CIEGO' "$log")
  rec=$(grep -o 'vivas [0-9]* · mudas [0-9]* · ciegas [0-9]* · ficheros muertos [0-9]*' "$log" | head -1)
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$id" "$creado" "$evento" "$rama" "$sha" "$concl" "$m853" "$c859" "${rec:-SIN-RECUENTO}" "$bytes" >> "$OUT"
  rm -f "$log"
done < "$T/runs.tsv"
echo "POBLACION=$n FILAS=$(wc -l < "$OUT")"
echo "EXIT=0"
