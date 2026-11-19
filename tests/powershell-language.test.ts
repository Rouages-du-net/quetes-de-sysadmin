// The Windows engine, step 2: PowerShell's functions and loops (function,
// param(), [switch], [CmdletBinding()], [Parameter(Mandatory)],
// [ValidateSet()], begin/process/end, return, $args; while, do/while,
// do/until, for, switch with its forms, break, continue), dot-sourcing and
// Import-Module of a script, Get-Command and Get-Help on a function, the
// guard against endless loops. On the test server LEDGER.

import { describe, expect, it } from 'vitest';
import type { Shell } from '../src/engine/shell';
import { ledger } from './windows-fixture';

const run = (s: Shell, ...lines: string[]) => lines.map((l) => s.execute(l) ?? '').filter(Boolean).join('\n');

describe('PowerShell: functions', () => {
  it('simple functions: Name($a), param() with types and defaults, [switch], $args, return', () => {
    const s = ledger();
    expect(run(s, 'function Get-Double($n) { $n * 2 }', 'Get-Double 21')).toBe('42');
    run(s, 'function Greet { param([string]$Name = "world", [switch]$Loud) $m = "Hello $Name"; if ($Loud) { $m.ToUpper() } else { $m } }');
    expect(run(s, 'Greet', 'Greet -Name Ada', 'Greet Ada -Loud', 'Greet -N Ada')).toBe('Hello world\nHello Ada\nHELLO ADA\nHello Ada');
    expect(run(s, 'function Show-Args { "count: $($args.Count), first: $($args[0])" }', 'Show-Args a b c')).toBe('count: 3, first: a');
    // return ends the function, after what it already wrote.
    expect(run(s, 'function f { foreach ($i in 1..5) { $i; if ($i -eq 2) { return } } }', 'f')).toBe('1\n2');
    expect(run(s, 'function Add($a, $b) { return $a + $b }', '(Add 2 3) * 10')).toBe('50');
    // A [int] parameter converts, or refuses.
    run(s, 'function Twice([int]$n) { $n * 2 }');
    expect(run(s, 'Twice "21"')).toBe('42');
    expect(run(s, 'Twice abc')).toContain('Cannot convert value "abc" to type "System.Int32"');
  });

  it("a function's variables are its own; it reads the caller's", () => {
    const s = ledger();
    run(s, '$level = 1', 'function Up { $level = $level + 10; $level }');
    expect(run(s, 'Up', '$level')).toBe('11\n1');
    run(s, 'function Set-Global { $global:count = 7 }', 'Set-Global');
    expect(run(s, '$count')).toBe('7');
  });

  it('advanced functions: strict binding, a mandatory parameter asked for, ValidateSet', () => {
    const s = ledger();
    run(s, 'function Need { [CmdletBinding()] param([Parameter(Mandatory)][string]$Name) "hi $Name" }');
    expect(run(s, 'Need -Nam x')).toBe('hi x');
    const bad = run(s, 'Need -Bogus 1');
    expect(bad).toContain("Need : A parameter cannot be found that matches parameter name 'Bogus'.");
    expect(bad).toContain('NamedParameterNotFound,Need');
    // Missing: PowerShell asks for it, then runs the statement with the answer.
    expect(run(s, 'Need')).toBe('cmdlet Need at command pipeline position 1\nSupply values for the following parameters:');
    expect(run(s, 'Ada')).toBe('hi Ada');
    run(s, 'function Pick { param([ValidateSet("Domain","Private")]$Profile) $Profile }');
    expect(run(s, 'Pick domain')).toBe('domain');
    expect(run(s, 'Pick Public')).toContain('The argument "Public" does not belong to the set "Domain,Private" specified by the ValidateSet attribute.');
  });

  it('the pipeline: process runs per item, ValueFromPipeline, begin and end', () => {
    const s = ledger();
    expect(run(s, 'function Sq { process { $_ * $_ } }', '1..3 | Sq')).toBe('1\n4\n9');
    run(s, 'function Measure-Len { param([Parameter(ValueFromPipeline)]$Item) begin { $total = 0 } process { $total += $Item.Length } end { "total $total" } }');
    expect(run(s, '"ab","cde" | Measure-Len')).toBe('total 5');
    expect(run(s, 'function Count-Input { $input.Count }', '1,2,3 | Count-Input')).toBe('3');
  });

  it('Get-Command and Get-Help show a function; Tab completes it', () => {
    const s = ledger();
    run(s, 'function Get-Tide { <#\n.SYNOPSIS\nThe next high tide.\n#> param([string]$Port, [switch]$Utc) "06:12" }');
    expect(run(s, 'Get-Command Get-Tide')).toMatch(/Function +Get-Tide/);
    const help = run(s, 'Get-Help Get-Tide');
    expect(help).toContain('Get-Tide [[-Port] <string>] [-Utc]');
    expect(help).toContain('The next high tide.');
    expect(s.complete('Get-Ti')).toBe('Get-Tide ');
  });

  it('dot-sourcing a script keeps its functions; Import-Module of a .psm1 too; a module that is not there', () => {
    const s = ledger();
    run(s, 'Set-Content C:\\Scripts\\lib.ps1 \'function Get-Tide { "06:12" }\'');
    // Run normally, the script's functions go with it.
    run(s, 'C:\\Scripts\\lib.ps1');
    expect(run(s, 'Get-Tide')).toContain("The term 'Get-Tide' is not recognized");
    expect(run(s, '. C:\\Scripts\\lib.ps1', 'Get-Tide')).toBe('06:12');
    run(s, 'Set-Content C:\\Scripts\\tools.psm1 \'function Get-Moon { param($Day = 1) "moon $Day" }\'');
    expect(run(s, 'Import-Module C:\\Scripts\\tools.psm1', 'Get-Moon -Day 3')).toBe('moon 3');
    expect(run(s, 'Import-Module ActiveDirectory')).toContain("The specified module 'ActiveDirectory' was not loaded because no valid module file was found in any module directory.");
    expect(run(s, 'Get-Module -ListAvailable | Where-Object Name -eq NetSecurity | Select-Object -ExpandProperty Name')).toBe('NetSecurity');
  });
});

describe('PowerShell: loops and switch', () => {
  it('while, do/while, do/until, for, $i++', () => {
    const s = ledger();
    expect(run(s, '$i = 0; while ($i -lt 3) { $i; $i++ }')).toBe('0\n1\n2');
    expect(run(s, '$n = 0; do { $n++ } until ($n -ge 5); $n')).toBe('5');
    expect(run(s, '$n = 10; do { $n-- } while ($n -gt 7); $n')).toBe('7');
    expect(run(s, 'for ($i = 0; $i -lt 3; $i++) { "line $i" }')).toBe('line 0\nline 1\nline 2');
    expect(run(s, '$t = 1; for ($k = 0; $k -lt 4; $k++) { $t *= 2 }; $t')).toBe('16');
  });

  it('break and continue; foreach keeps its variable', () => {
    const s = ledger();
    expect(run(s, 'for ($i = 0; $i -lt 10; $i++) { if ($i -eq 2) { continue }; if ($i -eq 4) { break }; $i }')).toBe('0\n1\n3');
    expect(run(s, 'foreach ($f in "a","b","c") { if ($f -eq "b") { break }; $f }', '$f')).toBe('a\nb');
  });

  it('switch: values, several matches, default, -Wildcard, -Regex, script blocks, break, arrays', () => {
    const s = ledger();
    expect(run(s, 'switch (3) { 1 {"one"} 3 {"three"} default {"other"} }')).toBe('three');
    expect(run(s, 'switch (9) { 1 {"one"} default {"other"} }')).toBe('other');
    // Every clause that matches runs, unless break.
    expect(run(s, 'switch (5) { {$_ -gt 3} {"big"} {$_ -gt 1} {"medium"} }')).toBe('big\nmedium');
    expect(run(s, 'switch (5) { {$_ -gt 3} {"big"; break} {$_ -gt 1} {"medium"} }')).toBe('big');
    expect(run(s, 'switch -Wildcard ("report.pdf","notes.txt") { "*.pdf" {"pdf: $_"} default {"other: $_"} }')).toBe('pdf: report.pdf\nother: notes.txt');
    expect(run(s, 'switch -Regex ("error 42") { "(\\d+)" { "code " + $Matches[1] } }')).toBe('code 42');
    expect(run(s, 'switch ("Running") { running {"up"} }', 'switch -CaseSensitive ("Running") { running {"up"} default {"case"} }')).toBe('up\ncase');
    expect(run(s, 'switch (1,2,3) { 2 { continue } default { $_ } }')).toBe('1\n3');
  });

  it('a loop that never ends is stopped by the game; a parse error keeps 5.1\'s layout', () => {
    const s = ledger();
    expect(run(s, 'while ($true) { }')).toContain('The game stopped this line: its loops ran more than 10000 times');
    expect(run(s, 'do { 1 }')).toContain('Missing while or until keyword in do loop.');
    expect(run(s, 'for ($i = 0; $i -lt 3) { }')).toContain("Missing ';' in 'for' statement.");
    // A stray return at the prompt: its value, then nothing more.
    expect(run(s, 'return 5; "no"')).toBe('5');
  });

  it('in French too: the guard speaks the language of the game', () => {
    const s = ledger({}, 'fr');
    expect(run(s, 'while ($true) { }')).toContain('Le jeu a arrêté cette ligne');
    expect(run(s, 'function f { "ok" }', 'f')).toBe('ok');
  });
});
