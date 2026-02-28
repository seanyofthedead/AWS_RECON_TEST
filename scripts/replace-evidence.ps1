param(
  [int]$CaseCount = 100,
  [string]$SourceRoot = "C:\Users\peder\Downloads\new_data",
  [string]$DestRoot = "C:\Users\peder\Documents\AWS_recon_test\public\evidence"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "${DestRoot}-archive-$timestamp"

if (Test-Path $DestRoot) {
  Rename-Item -Path $DestRoot -NewName $backupRoot
}

New-Item -ItemType Directory -Path $DestRoot | Out-Null

for ($i = 1; $i -le $CaseCount; $i += 1) {
  $txNumber = 1000000 + $i
  $sourceFolderName = "VAR-{0:D6}_TX-{1:D7}" -f $i, $txNumber
  $sourceFolder = Join-Path $SourceRoot $sourceFolderName
  $caseFolderName = "CASE-{0:D5}" -f $i
  $caseFolder = Join-Path $DestRoot $caseFolderName

  if (-not (Test-Path $sourceFolder)) {
    Write-Warning "Missing source folder: $sourceFolder"
    continue
  }

  New-Item -ItemType Directory -Path $caseFolder | Out-Null

  $invoice = Get-ChildItem -Path $sourceFolder -Filter "*Supplier_Invoice*.pdf" | Select-Object -First 1
  $po = Get-ChildItem -Path $sourceFolder -Filter "*Purchase_Order*.pdf" | Select-Object -First 1
  $receipt = Get-ChildItem -Path $sourceFolder -Filter "*Goods_Receipt*.pdf" | Select-Object -First 1
  $gl = Get-ChildItem -Path $sourceFolder -Filter "*GL_Posting_Extract*.pdf" | Select-Object -First 1

  if ($invoice) { Copy-Item -Path $invoice.FullName -Destination (Join-Path $caseFolder "Invoice.pdf") }
  else { Write-Warning "Invoice missing for $sourceFolderName" }

  if ($po) { Copy-Item -Path $po.FullName -Destination (Join-Path $caseFolder "Purchase_Order.pdf") }
  else { Write-Warning "PO missing for $sourceFolderName" }

  if ($receipt) { Copy-Item -Path $receipt.FullName -Destination (Join-Path $caseFolder "Receipt.pdf") }
  else { Write-Warning "Receipt missing for $sourceFolderName" }

  if ($gl) { Copy-Item -Path $gl.FullName -Destination (Join-Path $caseFolder "GL_Posting.pdf") }
  else { Write-Warning "GL posting missing for $sourceFolderName" }
}

Write-Output "Evidence refresh complete. Backup: $backupRoot"
