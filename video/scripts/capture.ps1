# Captures Net Tools (demo mode) for the explainer videos.
# The app records its own window to PNG frames ("--demo --capture <folder>", each named by its UTC tick time),
# while this script drives it with UI Automation and notes when each step happens. Afterwards the frames are
# matched to the steps and saved to public\shots, with a timeline (captions, cursor targets, zoom areas,
# frame timings) in src\timeline.json.
#
#   npm run capture      (from the video folder; needs a signed-in, connected desktop)
#
# Demo mode uses sample adapters and devices, so nothing on the real network changes.
param([string]$Exe = (Join-Path $PSScriptRoot '..\..\preview-build\Cre8Labs-NetTools.exe'))

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$shotDir = Join-Path $root 'public\shots'
$frameDir = Join-Path $env:TEMP 'nettools-capture'
foreach ($d in $shotDir, $frameDir) {
    Remove-Item -Recurse -Force $d -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $d | Out-Null
}

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Cap {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
  public struct RECT { public int L, T, R, B; }
}
"@
# Work in physical pixels, so positions do not depend on how Windows scales this script.
[Cap]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
$A = [System.Windows.Automation.AutomationElement]
$TW = 1600; $TH = 900   # the app's capture size, in its own units

# ------------------------------------------------------------------ app

Get-Process Cre8Labs-NetTools -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*preview-build*' } | Stop-Process -Force
$p = Start-Process (Resolve-Path $Exe) -ArgumentList '--demo', '--capture', "`"$frameDir`"" -PassThru
for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 300; $p.Refresh(); if ($p.MainWindowHandle -ne 0) { break } }
Start-Sleep -Milliseconds 2000
$h = $p.MainWindowHandle
$win = $A::FromHandle($h)

function Rect([IntPtr]$hwnd) { $r = New-Object Cap+RECT; [Cap]::GetWindowRect($hwnd, [ref]$r) | Out-Null; $r }
function Now() { [DateTime]::UtcNow.Ticks }

function Prop($root, $prop, $value, $type = $null) {
    $cond = New-Object System.Windows.Automation.PropertyCondition($prop, $value)
    if ($type) { $cond = New-Object System.Windows.Automation.AndCondition($cond, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $type))) }
    for ($i = 0; $i -lt 15; $i++) {
        $el = $root.FindFirst('Descendants', $cond)
        if ($el) { return $el }
        Start-Sleep -Milliseconds 200
    }
    throw "UI element not found: $value"
}
function ByName($root, $name) { Prop $root $A::NameProperty $name }
function ById($root, $id) { Prop $root $A::AutomationIdProperty $id }
function ButtonByName($root, $name) { Prop $root $A::NameProperty $name ([System.Windows.Automation.ControlType]::Button) }

# The open dialog of this app, if any.
function Dialog() {
    # Owned dialogs are listed under their owner window; check there first, then at the top level.
    $windowType = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)
    foreach ($w in $win.FindAll('Children', $windowType)) { return $w }
    $cond = New-Object System.Windows.Automation.AndCondition(
        (New-Object System.Windows.Automation.PropertyCondition($A::ProcessIdProperty, $p.Id)), $windowType)
    foreach ($w in $A::RootElement.FindAll('Children', $cond)) {
        if ([IntPtr]$w.Current.NativeWindowHandle -ne $h) { return $w }
    }
    $null
}

function WaitDialog() {
    for ($i = 0; $i -lt 25; $i++) { $d = Dialog; if ($d) { return $d }; Start-Sleep -Milliseconds 200 }
    throw 'Dialog did not open'
}

# Position of an element in the app's frames (its own units, measured from the main window's corner).
function Box($el) {
    $b = $el.Current.BoundingRectangle
    $m = Rect $h
    $s = [Cap]::GetDpiForWindow($h) / 96
    @{ x = [int](($b.X - $m.L) / $s); y = [int](($b.Y - $m.T) / $s); w = [int]($b.Width / $s); h = [int]($b.Height / $s) }
}

# ------------------------------------------------------------------ steps

$chapters = New-Object System.Collections.ArrayList
$script:steps = $null

function Chapter([string]$id, [string]$title, [string]$subtitle) {
    $script:steps = New-Object System.Collections.ArrayList
    [void]$chapters.Add(@{ id = $id; title = $title; subtitle = $subtitle; steps = $script:steps })
    Write-Host "== $title"
}

# zoom: 'target' (around the cursor target), 'none', or @{x;y;w;h} in app units.
function Step([string]$caption, $target, [scriptblock]$action, [int]$filmMs = 1200, $zoom = 'target', [string]$kind = 'click') {
    $box = if ($target) { Box $target } else { $null }
    Start-Sleep -Milliseconds 150
    $t0 = Now
    if ($action) { & $action }
    Start-Sleep -Milliseconds $filmMs
    [void]$script:steps.Add(@{ caption = $caption; kind = $(if ($target) { $kind } else { 'none' }); target = $box; zoom = $zoom; t0 = $t0; tAction = $t0; tEnd = (Now) })
    Write-Host "   $caption"
}

# Types into a text box one character at a time, so the video shows the typing.
function TypeStep([string]$caption, $box, [string]$text, $zoom = 'target') {
    $value = $box.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $value.SetValue('')
    $target = Box $box
    Start-Sleep -Milliseconds 250
    $t0 = Now
    for ($i = 1; $i -le $text.Length; $i++) {
        $value.SetValue($text.Substring(0, $i))
        Start-Sleep -Milliseconds 110
    }
    Start-Sleep -Milliseconds 700
    [void]$script:steps.Add(@{ caption = $caption; kind = 'type'; text = $text; target = $target; zoom = $zoom; t0 = $t0; tAction = $t0; tEnd = (Now) })
    Write-Host "   $caption"
}

function Invoke($el) { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }
function Toggle($el) { $el.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern).Toggle() }
function PickPage($el) { $el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() }
function ScrollTo($el) {
    # Focusing a WPF control brings it into view inside its scroll viewer; ScrollItem is a fallback.
    try { $el.SetFocus() } catch { }
    try { $el.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern).ScrollIntoView() } catch { }
    Start-Sleep -Milliseconds 400
}
# Rough window areas (1600 x 900) used for zooms on results.
$RightColumn = @{ x = 470; y = 70; w = 1110; h = 810 }
$LeftColumn = @{ x = 100; y = 70; w = 380; h = 810 }

try {
    # ---------------------------------------------------------------- 1. presets
    Chapter 'presets' 'Switch IP in one click' 'Presets, DHCP and keyboard shortcuts'
    Step 'Net Tools shows the selected adapter, its live address, link speed and DNS' $null $null 2200 $LeftColumn
    $office = ByName $win 'Apply Office LAN'
    Step 'Click a preset to switch. The adapter changes in about a second' $office { Invoke $office } 2200 $RightColumn
    $dhcp = ByName $win 'Switch to DHCP'
    Step 'Back to automatic addressing (DHCP) with one click, or press 0' $dhcp { Invoke $dhcp } 2200 $RightColumn
    $site = ByName $win 'Apply Site A cameras'
    Step 'Each preset has its own key: press 2 or click to switch to Site A cameras' $site { Invoke $site } 2000 $RightColumn

    $new = ButtonByName $win 'New preset'
    Step 'Save the networks you work on as presets' $new { Invoke $new } 1000 'none'
    $d = WaitDialog
    TypeStep 'Give it a name' (ById $d 'NameBox') 'Site B NVR'
    TypeStep 'Enter the IP address' (ById $d 'IpBox') '192.168.50.20'
    TypeStep 'Type the mask as 255.255.255.0 or simply /24' (ById $d 'MaskBox') '/24'
    TypeStep 'Gateway and DNS are optional, and the subnet is checked as you type' (ById $d 'GatewayBox') '192.168.50.1'
    $save = ButtonByName $d 'Save preset'
    Step 'Save, and the new preset is ready on its own tile with its own key' $save { Invoke $save } 1600 $RightColumn

    $keys = ButtonByName $win 'Keyboard shortcuts'
    Step 'Shortcuts can be reassigned, turned off, or made to work from any app' $keys { Invoke $keys } 2200 'none'
    $d = WaitDialog
    $cancel = ButtonByName $d 'Cancel'
    Step 'Close the shortcuts window' $cancel { Invoke $cancel } 700 'none'

    # ---------------------------------------------------------------- 2. DHCP pool
    Chapter 'dhcp' 'DHCP pool for cameras' 'Hand out addresses when there is no router'
    $nav = ByName $win 'DHCP pool page'
    Step 'Open the DHCP pool page' $nav { PickPage $nav } 900 'none'
    TypeStep 'Choose the network to serve. The server address and range fill in for you' (ById $win 'PoolNetworkBox') '192.168.1.0/24' $LeftColumn
    $start = ByName $win 'Start DHCP pool'
    Step 'Start the pool, plug in the cameras, and watch them get addresses' $start { Invoke $start } 8000 $RightColumn
    $pin = ByName $win 'Reserve IP for CAM-Gate'
    Step 'Pin a camera to its planned address with a reservation' $pin {
        # The device list refreshes every 2 seconds, so find the button again right before clicking.
        for ($try = 0; $try -lt 4 -and -not (Dialog); $try++) { Invoke (ByName $win 'Reserve IP for CAM-Gate'); Start-Sleep -Milliseconds 700 }
    } 900 'none'
    $d = WaitDialog
    TypeStep 'Name it so everyone knows which camera it is' (ById $d 'NameBox') 'Cam 1 - Gate'
    TypeStep 'Set the address it should always get' (ById $d 'IpBox') '192.168.1.11'
    $ok = ButtonByName $d 'Save'
    Step 'The camera moves to its reserved address at its next renewal' $ok { Invoke $ok } 2400 $RightColumn
    $stop = ButtonByName $win 'Stop DHCP pool'
    Step 'Stop the pool and the adapter goes back to how it was' $stop { Invoke $stop } 2200 $LeftColumn

    # ---------------------------------------------------------------- 3. scan
    Chapter 'scan' 'Scan and find cameras' 'Every device on the network, even on other subnets'
    $nav = ByName $win 'Scan page'
    Step 'Open the Scan page' $nav { PickPage $nav } 900 'none'
    $use = ByName $win "Use the selected adapter's network"
    Step "Use adapter fills in the network you are plugged into" $use { Invoke $use } 900 'target'
    $scan = ByName $win 'Start or stop scan'
    Step 'Scan: each device shows its maker, address, response time and open ports' $scan { Invoke $scan } 6000 $RightColumn
    $reach = ByName $win 'Reach 192.168.0.64'
    Step 'A camera still on its factory address? Reach it adds a matching IP so you can open it' $reach { Invoke $reach } 2600 $RightColumn

    # ---------------------------------------------------------------- 4. monitor
    Chapter 'monitor' 'Monitor a whole site' 'Live latency and an alert the moment a device drops'
    $nav = ByName $win 'Monitor page'
    Step 'Open the Monitor page' $nav { PickPage $nav } 900 'none'
    $add = ByName $win 'Add scan results'
    Step 'Add everything from the scan with one click' $add { Invoke $add } 1200 $RightColumn
    # The demo camera at .21 drops out for 12 seconds of every 40: start just before that.
    while (((Get-Date).Second % 40) -ne 5) { Start-Sleep -Milliseconds 200 }
    $go = ByName $win 'Start or stop monitoring'
    Step 'Start watching: every device is pinged once a second' $go { Invoke $go } 7500 $RightColumn
    Step 'If a device stops answering, it turns red and you get an alert straight away' $null $null 6500 $RightColumn
    Step 'When it comes back, Net Tools tells you how long it was down' $null $null 4500 $RightColumn
    Invoke $go

    # ---------------------------------------------------------------- 5. tools
    Chapter 'tools' 'Troubleshooting tools' 'Ports, video streams, routes, DNS and cable health'
    $nav = ByName $win 'Tools page'
    Step 'Open the Tools page' $nav { PickPage $nav } 900 'none'
    TypeStep 'Check which ports a device has open' (ById $win 'PortHostBox') '192.168.1.20' $RightColumn
    $check = ByName $win 'Check ports'
    Step 'Open ports are shown by name: web, RTSP video, Hikvision SDK and more' $check { Invoke $check } 1800 $RightColumn
    $rtsp = ById $win 'RtspUrlBox'
    ScrollTo $rtsp
    TypeStep "Prove a camera is serving video, without playing it" $rtsp 'rtsp://192.168.1.20:554/Streaming/Channels/101' $RightColumn
    $rcheck = ByName $win 'Check RTSP stream'
    Step 'Net Tools reads the stream details: codec and audio, with camera login if needed' $rcheck { Invoke $rcheck } 1800 $RightColumn
    $trace = ById $win 'TraceTargetBox'
    ScrollTo $trace
    TypeStep 'Trace the route to any address, from the adapter you chose' $trace '8.8.8.8' $RightColumn
    $tgo = ByName $win 'Start or stop traceroute'
    Step 'Each hop and its response time appear as they are found' $tgo { Invoke $tgo } 2200 $RightColumn
    $link = ByName $win 'Refresh link health'
    ScrollTo $link
    Step 'Link health shows traffic, errors and dropped packets on the cable' $link { Invoke $link } 1600 $RightColumn
}
finally {
    Start-Sleep -Milliseconds 300
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------ match frames to steps

$frames = @(Get-ChildItem $frameDir -Filter 'f*.png' | ForEach-Object { [pscustomobject]@{ ticks = [long]$_.BaseName.Substring(1); file = $_ } } | Sort-Object ticks)
if ($frames.Count -lt 10) { throw "Only $($frames.Count) frames were recorded. Is the desktop connected?" }
$used = @{}
$blank = 0
foreach ($c in $chapters) {
    foreach ($s in $c.steps) {
        # The frame on screen when the step began, then every new frame until it ended.
        $start = $frames | Where-Object { $_.ticks -le $s.t0 } | Select-Object -Last 1
        if (-not $start) { $start = $frames[0] }
        $list = @(@{ file = "shots/$($start.file.Name)"; ms = 0 })
        $used[$start.file.Name] = $start.file
        foreach ($fr in $frames) {
            if ($fr.ticks -gt $s.t0 -and $fr.ticks -le $s.tEnd) {
                $list += @{ file = "shots/$($fr.file.Name)"; ms = [int](($fr.ticks - $s.t0) / 10000) }
                $used[$fr.file.Name] = $fr.file
            }
        }
        $s.frames = $list
        $s.actionMs = [int](($s.tAction - $s.t0) / 10000)
        $s.durationMs = [int](($s.tEnd - $s.t0) / 10000)
        $s.Remove('t0'); $s.Remove('tAction'); $s.Remove('tEnd')
    }
}
foreach ($file in $used.Values) {
    Copy-Item $file.FullName $shotDir
    if ($file.Length -lt 20000) { $blank++ }
}

$json = @{ chapters = $chapters } | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText((Join-Path $root 'src\timeline.json'), $json, (New-Object Text.UTF8Encoding($false)))
Write-Host ("Recorded {0} frames, used {1} ({2} look blank), {3} chapters, {4} steps" -f $frames.Count, $used.Count, $blank, $chapters.Count, ($chapters | ForEach-Object { $_.steps.Count } | Measure-Object -Sum).Sum)