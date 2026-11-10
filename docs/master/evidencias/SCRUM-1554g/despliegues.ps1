$gh = "C:\Program Files\GitHub CLI\gh.exe"
$out = $args[0]
$ids = & $gh api "repos/lwislg99/cobroflash-backend/deployments?per_page=100" --jq .[].id
$shas = & $gh api "repos/lwislg99/cobroflash-backend/deployments?per_page=100" --jq .[].sha
$fechas = & $gh api "repos/lwislg99/cobroflash-backend/deployments?per_page=100" --jq .[].created_at
$filas = @()
for ($i = 0; $i -lt $ids.Count; $i++) {
  $st = & $gh api "repos/lwislg99/cobroflash-backend/deployments/$($ids[$i])/statuses?per_page=1" --jq .[0].state
  $filas += "$($fechas[$i]) $($shas[$i].Substring(0,9)) $st"
}
$filas | Out-File -Encoding utf8 $out
