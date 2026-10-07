// La mise à jour de l'application de bureau, côté page — chantier
// application-bureau, lot 5 (décisions 11 et 12 ; src/components/BlocApplication.tsx).
//
// ⚠️ Ce que le bloc « Application » des Réglages promet : la mise à jour
// remise à plus tard reste faisable ICI, le bouton ne disparaît jamais, et
// rien ne se télécharge sans un clic sur « Mettre à jour ».

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { presentationMiseAJour } from '../src/components/BlocApplication';
import { TELECHARGEMENTS } from '../src/lib/bureau';
import { egal, ok, titre } from './outils';

export default function testBureauMiseAJour() {
  titre('bureau · mise à jour — le bloc « Application », phase par phase');
  const v = '2.0.1';
  const cas: [Parameters<typeof presentationMiseAJour>[0], string, boolean][] = [
    [null, 'Rechercher', true],
    [{ phase: 'aucune', version: '2.0.0' }, 'Rechercher', true],
    [{ phase: 'recherche', version: '2.0.0' }, 'Recherche…', false],
    [{ phase: 'a-jour', version: '2.0.0' }, 'Rechercher', true],
    [{ phase: 'injoignable', version: '2.0.0' }, 'Rechercher', true],
    [{ phase: 'disponible', version: v }, 'Mettre à jour', true],
    [{ phase: 'telechargement', version: v }, 'Téléchargement…', false],
    [{ phase: 'prete', version: v }, 'Redémarrer', true],
    [{ phase: 'echec', version: v }, 'Réessayer', true],
  ];
  for (const [etat, libelle, actif] of cas) {
    const p = presentationMiseAJour(etat);
    const nom = etat?.phase ?? 'rien reçu';
    egal(p.libelle, libelle, `${nom} : « ${libelle} »`);
    egal(!!p.action, actif, `${nom} : bouton ${actif ? 'actif' : 'désactivé — mais affiché'}`);
    ok(p.texte.length > 0, `${nom} : une ligne d'explication (hauteur constante)`);
  }
  ok(presentationMiseAJour({ phase: 'disponible', version: v }).texte.includes(v), 'disponible : la version est dite');
  ok(presentationMiseAJour({ phase: 'prete', version: v }).texte.includes('fermeture'), 'prête : installée à la fermeture, dit');

  titre('bureau · mise à jour — rien sans un clic');
  // Aucune phase ne télécharge d'elle-même : seules « disponible » et
  // « echec » mènent à un téléchargement, et seulement par leur bouton.
  const versTelechargement = cas.filter(([e]) => {
    const p = presentationMiseAJour(e);
    return p.libelle === 'Mettre à jour' || p.libelle === 'Réessayer';
  });
  egal(versTelechargement.map(([e]) => e?.phase), ['disponible', 'echec'], 'seuls « disponible » et « echec » proposent de télécharger');

  // Lot 6, décision 13 : l'accueil du site télécharge le fichier par une
  // adresse FIXE. Ses noms doivent être ceux qu'electron-builder produit.
  titre('bureau · téléchargements — l\'accueil vise les fichiers construits');
  const config = readFileSync(join(process.cwd(), 'electron-builder.yml'), 'utf8');
  const nom = (cible: string) => {
    const bloc = config.split(/\n(?=\S)/).find((b) => b.startsWith(`${cible}:`)) ?? '';
    return bloc.match(/artifactName:\s*(\S+)/)?.[1];
  };
  egal(nom('nsis'), 'SW-Blacksmith-Setup.${ext}', 'installeur Windows : nom sans version');
  egal(nom('linux'), 'SW-Blacksmith.${ext}', 'AppImage : nom sans version');
  ok(TELECHARGEMENTS.windows.endsWith('/releases/latest/download/SW-Blacksmith-Setup.exe'), 'Windows : la dernière release, le fichier construit');
  ok(TELECHARGEMENTS.linux.endsWith('/releases/latest/download/SW-Blacksmith.AppImage'), 'Linux : la dernière release, le fichier construit');
  const publish = config.match(/publish:\s*\n\s+provider:\s*(\S+)\s*\n\s+owner:\s*(\S+)\s*\n\s+repo:\s*(\S+)/);
  ok(!!publish && TELECHARGEMENTS.windows.startsWith(`https://github.com/${publish[2]}/${publish[3]}/`), 'même dépôt que la mise à jour (`publish`)');
}
