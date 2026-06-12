# S1-C — Valida tmp/registros-sample.xml contra los XSD OFICIALES de VERI*FACTU
# (vendorizados en src/modules/fiscal/verifactu/xsd) usando System.Xml.Schema (.NET).
# Uso: npm run build; node scripts/gen-registros-sample.mjs; powershell -File scripts/validate-registros-xsd.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$xsdDir = Join-Path $root 'src\modules\fiscal\verifactu\xsd'
$xmlPath = Join-Path $root 'tmp\registros-sample.xml'

if (-not (Test-Path $xmlPath)) { Write-Error "Falta $xmlPath (corre gen-registros-sample.mjs)"; exit 1 }

$set = New-Object System.Xml.Schema.XmlSchemaSet
$set.XmlResolver = $null  # nada de red: todos los XSD en local

# Cargar cada XSD ignorando sus schemaLocation remotos (el import de xmldsig apunta a w3.org)
function Add-Xsd([string]$file, [string]$ns) {
  $settings = New-Object System.Xml.XmlReaderSettings
  $settings.XmlResolver = $null
  # xmldsig-core-schema.xsd declara una DTD; ignorarla (no la necesitamos para validar)
  $settings.DtdProcessing = [System.Xml.DtdProcessing]::Ignore
  $reader = [System.Xml.XmlReader]::Create((Join-Path $xsdDir $file), $settings)
  try { [void]$set.Add($ns, $reader) } finally { $reader.Close() }
}
Add-Xsd 'xmldsig-core-schema.xsd'    'http://www.w3.org/2000/09/xmldsig#'
Add-Xsd 'SuministroInformacion.xsd'  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'
Add-Xsd 'SuministroLR.xsd'           'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'
$set.Compile()

$errors = New-Object System.Collections.ArrayList
$settings = New-Object System.Xml.XmlReaderSettings
$settings.ValidationType = [System.Xml.ValidationType]::Schema
$settings.Schemas = $set
$settings.XmlResolver = $null
$handler = [System.Xml.Schema.ValidationEventHandler]{
  param($s, $e)
  [void]$errors.Add("[$($e.Severity)] linea $($e.Exception.LineNumber): $($e.Message)")
}
$settings.add_ValidationEventHandler($handler)

$reader = [System.Xml.XmlReader]::Create($xmlPath, $settings)
try { while ($reader.Read()) {} } finally { $reader.Close() }

if ($errors.Count -eq 0) {
  Write-Host "VALIDO: tmp/registros-sample.xml conforme a SuministroLR.xsd + SuministroInformacion.xsd" -ForegroundColor Green
  exit 0
} else {
  Write-Host "NO VALIDO ($($errors.Count) errores):" -ForegroundColor Red
  $errors | ForEach-Object { Write-Host "  $_" }
  exit 1
}
