// Tests de rendu — deux conventions d'icônes (spec/shared/design.md,
// « Exporter ↑, importer ↓ » ; spec/compte/runes.md, « Filtrer par set »).
//
// ⚠️ L'inversion importer / exporter est revenue plusieurs fois : chaque
// endroit de l'accueil et de la palette qui l'a portée est gardé ici.

import HomePage from '../../src/pages/HomePage';
import SetFilter from '../../src/components/account/SetFilter';
import { runeSetIconFilter } from '../../src/lib/effects';
import { ok, titre } from '../outils';
import { RUNES } from './runes.test';
import { auTelephone, rendre } from './outils-rendu';

// L'icône lucide la plus proche AVANT `texte` dans le HTML (`lucide-upload`…).
function iconeAvant(html: string, texte: string): string | null {
  const fin = html.indexOf(texte);
  if (fin < 0) return null;
  const noms = [...html.slice(0, fin).matchAll(/class="lucide lucide-([a-z0-9-]+)/g)];
  return noms.length ? noms[noms.length - 1][1] : null;
}

export function testRenduIcones() {
  titre('rendu · icônes — exporter ↑, importer ↓ (accueil)');
  const accueil = rendre(<HomePage stats={{ rta: 0, defense: 0, offense: 0, recos: 0 }} onImport={() => {}} />);
  ok(iconeAvant(accueil, 'Importer mon compte') === 'download', '« Importer mon compte » : flèche vers le bas');
  ok(iconeAvant(accueil, 'Dépose ton fichier .json ici') === 'download', 'zone de dépôt : flèche vers le bas');
  ok(iconeAvant(accueil, 'Exporte ton compte') === 'upload', 'étape 01 « Exporte ton compte » : flèche vers le haut');
  ok(iconeAvant(accueil, 'Dépose le fichier') === 'download', 'étape 02 « Dépose le fichier » : flèche vers le bas');

  titre('rendu · icônes — symbole d’un set actif dans le filtre');
  const sets = [...new Set(RUNES.map((r) => r.set))];
  ok(sets.length >= 2, 'au moins deux sets dans les runes de test');
  const filtre = () => rendre(<SetFilter runes={RUNES} value={new Set([sets[0]])} onChange={() => {}} />);
  const filtres = (html: string) => [...html.matchAll(/filter:([^;"]+)/g)].map((m) => m[1].trim());
  const repos = runeSetIconFilter(false);
  const eclairci = runeSetIconFilter(true);
  const souris = filtres(filtre());
  ok(souris.length === sets.length && souris.every((f) => f === repos), 'à la souris : l’actif, sur l’aplat, garde le doré du repos, comme les autres');
  const doigt = filtres(auTelephone(filtre));
  ok(doigt.filter((f) => f === eclairci).length === 1, 'au doigt : l’actif, sur fond doux, garde le doré éclairci');
}
