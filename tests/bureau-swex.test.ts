// Le dossier SW Exporter — chantier application-bureau, lot 9, décision 15
// (bureau/swexPur.ts, src/components/BlocApplication.tsx).
//
// ⚠️ Ce module décide quel fichier de l'utilisateur est lu et quand : un nom
// mal reconnu suivrait le mauvais compte, un réglage mal relu inventerait un
// chemin, une décision « donner » trop large réannoncerait sans cesse.

import { aDonner, exportsDuDossier, lireNomExport, lireReglage } from '../bureau/swexPur';
import { presentationSwex } from '../src/components/BlocApplication';
import { egal, ok, titre } from './outils';

export default function testBureauSwex() {
  titre('bureau · SW Exporter — reconnaître un export de compte');
  // Les noms d'un vrai dossier SW Exporter.
  egal(lireNomExport('tototriou-12889591.json'), { fichier: 'tototriou-12889591.json', nom: 'tototriou', id: '12889591' }, 'nom simple');
  egal(lireNomExport('Killian26~-738882.json')?.nom, 'Killian26~', 'un « ~ » dans le nom');
  egal(lireNomExport('✨Vincent✨-1321384.json')?.nom, '✨Vincent✨', 'des emojis dans le nom');
  egal(lireNomExport('Jean-Pierre-42.json'), { fichier: 'Jean-Pierre-42.json', nom: 'Jean-Pierre', id: '42' }, 'un tiret dans le nom : l’identifiant est le DERNIER groupe');
  for (const pasUnExport of ['ca.pem', 'settings.json', '-123.json', 'tototriou.json', 'tototriou-12a.json', 'tototriou-123.json.bak'])
    egal(lireNomExport(pasUnExport), null, `pas un export : ${pasUnExport}`);
  egal(
    exportsDuDossier(['ZzzzzZ-5281814.json', 'cert', 'tototriou-12889591.json', 'notes.txt', 'Quentin000-2105714.json']).map((e) => e.nom),
    ['Quentin000', 'tototriou', 'ZzzzzZ'],
    'les exports d’un dossier, triés par nom, le reste écarté'
  );

  titre('bureau · SW Exporter — le réglage relu avec méfiance');
  egal(lireReglage(null), { dossier: null, fichier: null, dernierLu: null }, 'premier lancement : rien');
  egal(lireReglage('abîmé'), { dossier: null, fichier: null, dernierLu: null }, 'fichier abîmé : rien');
  const bon = { dossier: 'C:\\SWEX', fichier: 'tototriou-12889591.json', dernierLu: 1759737040000 };
  egal(lireReglage(bon), bon, 'réglage complet : relu tel quel');
  egal(lireReglage({ ...bon, fichier: '..\\..\\Windows\\win.ini' }).fichier, null, 'un CHEMIN à la place du nom de fichier : refusé');
  egal(lireReglage({ ...bon, fichier: 'sous/tototriou-1.json' }).fichier, null, 'un sous-dossier : refusé');
  egal(lireReglage({ ...bon, dernierLu: 'hier' }).dernierLu, null, 'date illisible : oubliée');

  titre('bureau · SW Exporter — donner l’export à la page, ou pas');
  egal(aDonner(1000, null, false), { donner: true, nouveau: true }, 'jamais lu : donné, annoncé');
  egal(aDonner(2000, 1000, false), { donner: true, nouveau: true }, 'plus récent que le dernier lu : donné, annoncé');
  egal(aDonner(1000, 1000, false), { donner: false, nouveau: false }, 'déjà lu, la page a son compte : rien');
  egal(aDonner(1000, 1000, true), { donner: true, nouveau: false }, 'déjà lu, page SANS compte : redonné en silence');

  titre('bureau · SW Exporter — ce que montre le bloc « Application »');
  const aucun = presentationSwex(null);
  ok(aucun.options.length === 0 && aucun.invocateur === 'Aucun dossier choisi.', 'sans dossier : sélecteur vide, « Aucun dossier choisi. »');
  const etat = {
    dossier: 'C:\\SWEX',
    fichier: 'tototriou-12889591.json',
    exports: [
      { fichier: 'tototriou-12889591.json', nom: 'tototriou', id: '12889591', modifie: 2000 },
      { fichier: 'Sam-1.json', nom: 'Sam', id: '1', modifie: 1 },
      { fichier: 'Sam-2.json', nom: 'Sam', id: '2', modifie: 1 },
    ],
    dernierLu: 2000,
    introuvable: false,
  };
  egal(presentationSwex(etat).options.map((o) => o.libelle), ['tototriou', 'Sam (1)', 'Sam (2)'], 'deux homonymes : l’identifiant les sépare');
  ok(presentationSwex(etat).invocateur.endsWith('— lu.'), 'export suivi déjà appliqué : « — lu. »');
  ok(presentationSwex({ ...etat, dernierLu: 1000 }).invocateur.endsWith('lecture en cours…'), 'export plus récent que le dernier lu : « lecture en cours… »');
  egal(presentationSwex({ ...etat, fichier: null }).invocateur, 'Choisis l’invocateur à suivre.', 'dossier choisi, invocateur non');
  egal(presentationSwex({ ...etat, exports: [] }).invocateur, 'Aucun export de compte à la racine de ce dossier.', 'dossier sans export');
  ok(presentationSwex({ ...etat, introuvable: true }).invocateur.startsWith('Dossier introuvable'), 'dossier disparu : dit');
}
