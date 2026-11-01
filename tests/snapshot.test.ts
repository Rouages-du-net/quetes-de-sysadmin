// The rescue snapshot: reopening the chapter and replaying the first inputs
// gives back exactly the machine as it was then (the engine is deterministic).
import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { translator } from '../src/texts';
import { inLanguage } from './names';

const L = (text: string) => inLanguage(translator('fr'), text);
const ERASER = ['lighthouse', 'village', 'root', 'backup'];

describe('Rescue snapshot', () => {
  it('going back to the snapshot undoes what was done after it, and keeps what was done before', () => {
    const c = new Console({ language: 'fr', finished: [] });
    c.execute('ssh royaume');
    c.execute('yes');
    expect(c.not).toBe(0);
    c.execute(L('mv Pier/net Harbour/Boathouse'));
    const point = c.not!;
    const before = c.execute(L('ls -a Harbour/Storeroom'));
    // A mistake after the snapshot: the light bulb goes to the wrong place.
    c.execute(L('mv Harbour/Storeroom/.spare_bulb Harbour/Boathouse'));
    expect(c.execute(L('ls -a Harbour/Storeroom'))).not.toBe(before);
    const serial = c.serial;
    expect(c.restore(point)).toBe(true);
    expect(c.serial).toBe(serial);
    expect(c.not).toBe(point);
    expect(c.execute(L('ls -a Harbour/Storeroom'))).toBe(before);
    // The net moved before the snapshot is still in the Hangar.
    expect(c.execute(L('ls Harbour/Boathouse'))).toContain(L('net'));
    c.execute(L('mv Harbour/Storeroom/.spare_bulb Pier/Lighthouse/Stairs/Lantern/bulb'));
    expect(c.remote!.shell.finished).toBe(true);
  });

  it('nano saves are replayed too', () => {
    const c = new Console({ language: 'fr', finished: [...ERASER, 'datacenter', 'second-day'] });
    c.execute('ssh datacenter');
    c.execute('yes');
    c.execute('nano note.txt');
    c.save('premier jet\n');
    c.quitEdition();
    const point = c.not!;
    c.execute('rm note.txt');
    expect(c.execute('cat note.txt')).toContain('note.txt');
    expect(c.restore(point)).toBe(true);
    expect(c.execute('cat note.txt')).toBe('premier jet');
  });

  it('going back to the workstation makes the snapshot impossible; reopening the chapter starts a new series', () => {
    const c = new Console({ language: 'fr', finished: [] });
    c.execute('ssh royaume');
    c.execute('yes');
    c.execute('ls');
    const serial = c.serial;
    c.execute('exit');
    expect(c.not).toBeNull();
    expect(c.restore(0)).toBe(false);
    c.execute('ssh royaume');
    // A resumed session: we do not know everything that was typed in it.
    expect(c.not).toBeNull();
    c.open(c.remote!.shell.chapter);
    expect(c.not).toBe(0);
    expect(c.serial).toBe(serial + 1);
  });
});
