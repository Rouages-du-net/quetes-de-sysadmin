// L'instantané de secours : rouvrir le chapitre et rejouer les premières
// saisies redonne exactement la machine d'alors (le moteur est déterministe).
import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { traducteur } from '../src/texts';
import { dansLaLangue } from './names';

const L = (texte: string) => dansLaLangue(traducteur('fr'), texte);
const EFFACEUR = ['eveil', 'bourg', 'racine', 'sauvegarde'];

describe('Instantané de secours', () => {
  it('revenir à l’instantané annule ce qui a été fait après, et garde ce qui a été fait avant', () => {
    const c = new Console({ langue: 'fr', termines: [] });
    c.executer('ssh royaume');
    c.executer('yes');
    expect(c.pas).toBe(0);
    c.executer(L('mv Jetee/filet Port/Hangar'));
    const point = c.pas!;
    const avant = c.executer(L('ls -a Port/Remise'));
    // Une erreur après l'instantané : l'ampoule part au mauvais endroit.
    c.executer(L('mv Port/Remise/.ampoule_de_secours Port/Hangar'));
    expect(c.executer(L('ls -a Port/Remise'))).not.toBe(avant);
    const serie = c.serie;
    expect(c.restaurer(point)).toBe(true);
    expect(c.serie).toBe(serie);
    expect(c.pas).toBe(point);
    expect(c.executer(L('ls -a Port/Remise'))).toBe(avant);
    // Le filet déplacé avant l'instantané est toujours au Hangar.
    expect(c.executer(L('ls Port/Hangar'))).toContain(L('filet'));
    c.executer(L('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule'));
    expect(c.distant!.shell.termine).toBe(true);
  });

  it('les enregistrements de nano se rejouent aussi', () => {
    const c = new Console({ langue: 'fr', termines: [...EFFACEUR, 'datacenter', 'deuxieme-jour'] });
    c.executer('ssh datacenter');
    c.executer('yes');
    c.executer('nano note.txt');
    c.enregistrer('premier jet\n');
    c.quitterEdition();
    const point = c.pas!;
    c.executer('rm note.txt');
    expect(c.executer('cat note.txt')).toContain('note.txt');
    expect(c.restaurer(point)).toBe(true);
    expect(c.executer('cat note.txt')).toBe('premier jet');
  });

  it('revenir au poste rend l’instantané impossible ; rouvrir le chapitre change de série', () => {
    const c = new Console({ langue: 'fr', termines: [] });
    c.executer('ssh royaume');
    c.executer('yes');
    c.executer('ls');
    const serie = c.serie;
    c.executer('exit');
    expect(c.pas).toBeNull();
    expect(c.restaurer(0)).toBe(false);
    c.executer('ssh royaume');
    // Une session reprise : on ne sait pas tout ce qui y a été tapé.
    expect(c.pas).toBeNull();
    c.ouvrir(c.distant!.shell.chapitre);
    expect(c.pas).toBe(0);
    expect(c.serie).toBe(serie + 1);
  });
});
