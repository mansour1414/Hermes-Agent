<#
  Generates the OpenCode inventory consumed by the Models page
  (see src/services/adapters/opencode/inventory.ts).

  READ-ONLY towards OpenCode and Hermes:
    * `opencode models`      -> the authoritative list of enabled model ids
    * https://models.dev/api.json -> public model metadata (context, cost,
      capabilities, modalities). No API keys, no account data.

  Output: public/opencode-inventory.json  (schemaVersion 1.0)
#>
[CmdletBinding()]
param(
  [string]$OutFile
)

if (-not $OutFile) {
  $OutFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\public\opencode-inventory.json"
}

$ErrorActionPreference = "Stop"
trap {
  Write-Host ("TRAP at line " + $_.InvocationInfo.ScriptLineNumber + ": " + $_.Exception.Message)
  Write-Host ("  statement: " + $_.InvocationInfo.Line)
  exit 1
}
$env:NO_COLOR = "1"

function Get-ProviderMeta([string]$providerId) {
  switch ($providerId) {
    "opencode" { return @{ name = "OpenCode"; } }
    "google"   { return @{ name = "Google"; } }
    default    { return @{ name = $providerId; } }
  }
}

Write-Host "1/3  Reading the live OpenCode model list (read-only)..."
$rawList = & opencode models 2>&1 | Out-String
$ids = @(
  $rawList -split "`r?`n" |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match "^[a-z0-9_.-]+/[A-Za-z0-9_.:-]+$" } |
    Sort-Object -Unique
)
Write-Host ("     {0} model ids" -f $ids.Count)

Write-Host "2/3  Downloading the public models.dev catalogue..."
$catalogPath = Join-Path $env:TEMP "modelsdev-api.json"
if (-not (Test-Path $catalogPath) -or ((Get-Item $catalogPath).Length -lt 100000)) {
  Invoke-WebRequest -Uri "https://models.dev/api.json" -UseBasicParsing -TimeoutSec 120 -OutFile $catalogPath
}
$catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json

Write-Host "3/3  Building the inventory..."
$entries = New-Object System.Collections.Generic.List[object]
$unmatched = New-Object System.Collections.Generic.List[string]

foreach ($id in $ids) {
  $parts = $id.Split("/", 2)
  $providerId = $parts[0]
  $modelKey = $parts[1]

  $meta = $null
  $providerNode = $catalog.$providerId
  if ($providerNode -and $providerNode.models) {
    $meta = $providerNode.models.$modelKey
  }
  if (-not $meta) { $unmatched.Add($id) | Out-Null }

  $costIn = 0.0
  $costOut = 0.0
  $context = 0
  $maxOut = 0
  $reasoning = $false
  $toolCall = $false
  $vision = $false
  $jsonMode = $false
  $releaseDate = ""
  $description = "Imported from the read-only OpenCode model list."
  $displayName = $modelKey
  $family = ""
  $verified = $false

  if ($meta) {
    if ($meta.cost) {
      if ($null -ne $meta.cost.input) { $costIn = [double]$meta.cost.input }
      if ($null -ne $meta.cost.output) { $costOut = [double]$meta.cost.output }
    }
    if ($meta.limit) {
      if ($null -ne $meta.limit.context) { $context = [int]$meta.limit.context }
      if ($null -ne $meta.limit.output) { $maxOut = [int]$meta.limit.output }
    }
    $reasoning = [bool]$meta.reasoning
    $toolCall = [bool]$meta.tool_call
    $jsonMode = [bool]$meta.structured_output
    if ($meta.modalities -and $meta.modalities.input) {
      $vision = @($meta.modalities.input) -contains "image"
    }
    if ($meta.release_date) { $releaseDate = [string]$meta.release_date }
    if ($meta.description) { $description = [string]$meta.description }
    if ($meta.name) { $displayName = [string]$meta.name }
    if ($meta.family) { $family = [string]$meta.family }
    $verified = $true
  }

  $isFree = ($costIn -eq 0 -and $costOut -eq 0)
  $providerMeta = Get-ProviderMeta $providerId

  $tags = New-Object System.Collections.Generic.List[string]
  $tags.Add($providerId) | Out-Null
  $tags.Add($(if ($isFree) { "free" } else { "paid" })) | Out-Null
  $tags.Add($(if ($reasoning) { "reasoning" } else { "no-reasoning" })) | Out-Null
  if ($vision) { $tags.Add("vision") | Out-Null }
  if ($toolCall) { $tags.Add("tools") | Out-Null }
  if ($family) { $tags.Add($family) | Out-Null }
  $tags.Add($(if ($verified) { "metadata-verified" } else { "metadata-missing" })) | Out-Null

  $entries.Add([ordered]@{
    modelId        = $id
    name           = $displayName
    providerId     = $providerId
    providerName   = $providerMeta.name
    pricing        = $(if ($isFree) { "free" } else { "paid" })
    inputPrice     = $costIn
    outputPrice    = $costOut
    contextWindow  = $context
    maxOutputTokens = $maxOut
    capabilities   = [ordered]@{
      reasoning  = $reasoning
      vision     = $vision
      toolCalling = $toolCall
      streaming  = $true
      jsonMode   = $jsonMode
    }
    releaseDate    = $releaseDate
    tags           = @($tags)
    description    = $description
    configured     = $true
    authenticated  = $true
    verified       = $verified
  }) | Out-Null
}

$ocVersion = (& opencode --version 2>&1 | Out-String).Trim()

$inventory = [ordered]@{
  schemaVersion = "1.0"
  generatedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  source        = "opencode"
  opencodeVersion = $ocVersion
  models        = $entries.ToArray()
}

$outFull = [System.IO.Path]::GetFullPath($OutFile)
$outDir = Split-Path -Parent $outFull
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
[System.IO.File]::WriteAllText($outFull, ($inventory | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("Wrote {0} models -> {1}" -f $entries.Count, $outFull)
if ($unmatched.Count -gt 0) {
  Write-Host ("Models without public metadata ({0}): {1}" -f $unmatched.Count, ($unmatched -join ", "))
}
