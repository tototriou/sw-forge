// Contrats du banc sans navigateur : tailles réellement déclarées, sélection
// des écrans et fichiers chargés par les étapes d'import.
import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { configurationBureau } from '../../src/lib/optimizerColonnes';
import { egal, ok } from '../outils';
import { ECRANS, preparationPour, taillesPour } from './ecrans';
import { ecransPourFichiers } from './selection';

export function verifierContratsBanc() {
  const optimizer = ECRANS.find((e) => e.id === 'optimizer')!;
  const tailles = taillesPour(optimizer);
  egal(tailles.length, 18, 'Optimizer : téléphone, six repères de bureau et onze frontières');
  egal(new Set(tailles.map(t => t.id)).size, tailles.length, 'captures sans collision');
  for (const ecran of ECRANS.filter(e => e !== optimizer)) {
    egal(taillesPour(ecran).map(t => t.id), ['telephone', 'ordinateur'], `${ecran.id} garde ses deux tailles`);
  }
  for (const configuration of ['colonnes', 'criteres-et-groupe', 'groupe', 'deux-piles']) {
    ok(tailles.some(t => t.optimizer?.configuration === configuration), `${configuration} exercée`);
  }
  for (const largeur of [752, 753, 1095, 1096, 1097, 1431, 1432, 1433, 1767, 1768, 1769]) {
    ok(tailles.some(t => t.preparation?.some(e => 'largeurOptimizer' in e && e.largeurOptimizer === largeur)), `conteneur ${largeur} visé par mesure`);
  }
  for (const taille of tailles) {
    if (!taille.optimizer) continue;
    const [min, max] = taille.optimizer.conteneur;
    egal(configurationBureau(min).configuration, taille.optimizer.configuration, `${taille.id} : borne inférieure cohérente`);
    egal(configurationBureau(max - 1).configuration, taille.optimizer.configuration, `${taille.id} : borne supérieure cohérente`);
    egal([configurationBureau(min, true).configuration, configurationBureau(max - 1, true).configuration],
      [taille.optimizer.enTableau?.configuration, taille.optimizer.enTableau?.configuration], `${taille.id} : configuration en tableau cohérente`);
    ok(!taille.tactile && taille.format === 'ordinateur', `${taille.id} : pointeur de bureau`);
  }
  for (const st of optimizer.etats) {
    ok((st.tailles ?? []).every((id) => tailles.some((t) => t.id === id)), `${st.id} : restriction à des tailles connues`);
    for (const format of ['telephone', 'ordinateur'] as const) {
      const prep = preparationPour(st, format);
      if (!Array.isArray(prep)) continue;
      for (const etape of prep) {
        if ('cliquer' in etape && etape.cliquer.role === 'option' && etape.cliquer.nom === 'Arène') {
          egal(etape.cliquer.dans, '[role="listbox"][aria-label="Contenu de la liste"]', `${st.id} (${format}) : Arène dans la liste ouverte, sans option native`);
        }
      }
      for (const etape of prep) {
        if (!('importer' in etape)) continue;
        const fichier = `tests/fixtures/${etape.fichier}`;
        const recette = parseOptimizerRecipe(readFileSync(fichier, 'utf8'));
        ok(!!recette.recipe, `${st.id} : recette valide (${recette.error ?? 'acceptée'})`);
        egal(ecransPourFichiers([fichier]).ecrans.map((e) => e.id), ['optimizer'], 'la recette sélectionne l’Optimizer');
        ok(!!etape.confirme, 'import de recette : confirmation explicite exigée');
      }
    }
  }
}
