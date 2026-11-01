// L'instantané de secours : rouvrir le chapitre et rejouer les premières
// saisies redonne exactement la machine d'alors (le moteur est déterministe).
import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { translator } from '../src/texts';
import { inLanguage } from './names';

const L = (text: string) => inLanguage(translator('fr'), text);
const ERASER = ['lighthouse', 'village', 'root', 'backup'];

describe('Instantané de secours', () => {
  it('revenir à l’instantané annule ce qui a été fait après, et garde ce qui a été fait avant', () => {
    const c = new Console({ language: 'fr', finished: [] });
    c.execute('ssh royaume');
    c.execute('yes');
    expect(c.not).toBe(0);
    c.execute(L('mv Pier/net Harbour/Boathouse'));
    const point = c.not!;
    const before = c.execute(L('ls -a Harbour/Storeroom'));
    // Une erreur après l'instantané : l'ampoule part au mauvais endroit.
    c.execute(L('mv Harbour/Storeroom/.spare_bulb Harbour/Boathouse'));
    expect(c.execute(L('ls -a Harbour/Storeroom'))).not.toBe(before);
    const serial = c.serial;
    expect(c.restore(point)).toBe(true);
    expect(c.serial).toBe(serial);
    expect(c.not).toBe(point);
    expect(c.execute(L('ls -a Harbour/Storeroom'))).toBe(before);
    // Le filet déplacé avant l'instantané est toujours au Hangar.
    expect(c.execute(L('ls Harbour/Boathouse'))).toContain(L('net'));
    c.execute(L('mv Harbour/Storeroom/.spare_bulb Pier/Lighthouse/Stairs/Lantern/bulb'));
    expect(c.remote!.shell.finished).toBe(true);
  });

  it('les enregistrements de nano se rejouent aussi', () => {
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

  it('revenir au poste rend l’instantané impossible ; rouvrir le chapitre change de série', () => {
    const c = new Console({ language: 'fr', finished: [] });
    c.execute('ssh royaume');
    c.execute('yes');
    c.execute('ls');
    const serial = c.serial;
    c.execute('exit');
    expect(c.not).toBeNull();
    expect(c.restore(0)).toBe(false);
    c.execute('ssh royaume');
    // Une session reprise : on ne sait pas tout ce qui y a été tapé.
    expect(c.not).toBeNull();
    c.open(c.remote!.shell.chapter);
    expect(c.not).toBe(0);
    expect(c.serial).toBe(serial + 1);
  });
});
