[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = 'https://shadow-depths.vercel.app'
$html = (Invoke-WebRequest "$base/" -UseBasicParsing).Content
if ($html -match 'assets/(index-[A-Za-z0-9]+\.js)') {
  $bundle = $Matches[1]
  Write-Host "bundle:" $bundle
} else {
  Write-Host "bundle: (not found in index.html)"
  exit 1
}
$js = (Invoke-WebRequest "$base/assets/$($Matches[1])" -UseBasicParsing).Content
Write-Host "iron-clad:" $js.Contains('iron-clad')
Write-Host "drawIronPanel:" $js.Contains('drawIronPanel')
Write-Host "old Volume:" $js.Contains('Volume: ')
