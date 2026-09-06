# Fetches the Beltline's pictures and video into this folder.
# Run once:  powershell -ExecutionPolicy Bypass -File download.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host 'downloading 01-a.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/69583a2e9f54dce2f2d3b39b_85937eb2d57a7307e76a7909d5f49158_start%20A.jpg' -OutFile (Join-Path $here '01-a.jpg')
Write-Host 'downloading 01-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/697bb30e20f0440fbcc1002d_start%20B.jpg' -OutFile (Join-Path $here '01-b.jpg')
Write-Host 'downloading 02-a.mp4'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c%2F6957fd3545ce9f962ebb6ffb_belt%20%282%29_mp4.mp4' -OutFile (Join-Path $here '02-a.mp4')
Write-Host 'downloading 04-a.mp4'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c%2F6957fd3411956902ab40fe89_belt%20%283%29_mp4.mp4' -OutFile (Join-Path $here '04-a.mp4')
Write-Host 'downloading 04-b.mp4'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c%2F6957fd35469bfb31b30e0a54_belt%20%284%29_mp4.mp4' -OutFile (Join-Path $here '04-b.mp4')
Write-Host 'downloading 05-a.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/697bb4b0cb4db740b4bd7a56_marlee%202%20ARROW.jpg' -OutFile (Join-Path $here '05-a.jpg')
Write-Host 'downloading 05-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/697bb55c2fa5afc6aeb4f03c_Marlee%203_arrows.jpg' -OutFile (Join-Path $here '05-b.jpg')
Write-Host 'downloading 06-a.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/697bb7e89bd1ac3f124f5400_Allan%209%20ARROW.jpg' -OutFile (Join-Path $here '06-a.jpg')
Write-Host 'downloading 06-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/695a9641f1d531906034d88e_Allan%2011a.jpg' -OutFile (Join-Path $here '06-b.jpg')
Write-Host 'downloading 06-c.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/695a9652ba2de3fdc9adb822_allan%2011b.jpg' -OutFile (Join-Path $here '06-c.jpg')
Write-Host 'downloading 07-a.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/695c1cca5ade87337c775548_17a0d41d757864600ebcffa9909fdfc4_bad%20crossing%202_ARROW.jpg' -OutFile (Join-Path $here '07-a.jpg')
Write-Host 'downloading 08-a.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/698e245ba84f1720c70b8f4a_crossing%20island%20AFTER%201.jpg' -OutFile (Join-Path $here '08-a.jpg')
Write-Host 'downloading 08-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/698e246af3d684c836765a83_crossing%20island%20AFTER%202.jpg' -OutFile (Join-Path $here '08-b.jpg')
Write-Host 'downloading 08-c.mp4'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c%2F6957fd344626e7c304b1cfae_belt%20%286%29_mp4.mp4' -OutFile (Join-Path $here '08-c.mp4')
Write-Host 'downloading 08-d.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/696836096f00c6896ce3a08f_oriole.jpg' -OutFile (Join-Path $here '08-d.jpg')
Write-Host 'downloading 09-a.mp4'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c%2F6957fd3589cc6f663a73ac44_belt%20%285%29_mp4.mp4' -OutFile (Join-Path $here '09-a.mp4')
Write-Host 'downloading 09-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/698e27acfff71553488fb01a_cemetary%204.jpg' -OutFile (Join-Path $here '09-b.jpg')
Write-Host 'downloading 10-a.mp4'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c%2F6957fd351a42820e2405ad07_belt%20%287%29_mp4.mp4' -OutFile (Join-Path $here '10-a.mp4')
Write-Host 'downloading 10-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/69682ef9215d1791f5e216c0_cemetary%203_ARROW.jpg' -OutFile (Join-Path $here '10-b.jpg')
Write-Host 'downloading 11-a.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/6962c4198762588c785dc7ec_crossing.jpg' -OutFile (Join-Path $here '11-a.jpg')
Write-Host 'downloading 11-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/6962b8f4c49090d7e4a610c6_stairs.jpg' -OutFile (Join-Path $here '11-b.jpg')
Write-Host 'downloading 12-a.mp4'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c%2F6957fd3412ece718f23674f9_belt%20%289%29_mp4.mp4' -OutFile (Join-Path $here '12-a.mp4')
Write-Host 'downloading 12-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/695817e253b207ec2c5c3f6b_148bff1388d3bf6889f92cf278c298dc_beltline%20%282%29.jpg' -OutFile (Join-Path $here '12-b.jpg')
Write-Host 'downloading 12-c.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/6962b654642e2f07b0bf65fc_under%20bridge.jpg' -OutFile (Join-Path $here '12-c.jpg')
Write-Host 'downloading 13-a.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/696826f13de53e0fdbf7d611_BRICK%202A_ARROW.jpg' -OutFile (Join-Path $here '13-a.jpg')
Write-Host 'downloading 13-b.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/696839589862f0843ed9ef67_BRICK%202B%20ARROW.jpg' -OutFile (Join-Path $here '13-b.jpg')
Write-Host 'downloading 13-c.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/69682a2d0f3ae7a20e6d12a3_brickworks%20trail%202A_ARROW.jpg' -OutFile (Join-Path $here '13-c.jpg')
Write-Host 'downloading 13-d.jpg'
Invoke-WebRequest -Uri 'https://cdn.prod.website-files.com/62e49ab216c2b10748052c8c/697bacfcc7a6e9369853d0ec_brickworks%20trail%202B%20ARROW.jpg' -OutFile (Join-Path $here '13-d.jpg')
Write-Host 'done — 28 files'
