// Contrats du banc sans navigateur : tailles réellement déclarées, sélection
// des écrans et fichiers chargés par les étapes d'import.
import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { agencementBureau } from '../../src/lib/optimizerColonnes';
import { egal, ok } from '../outils';
import { ECRANS, preparationPour, taillesPour } from './ecrans';
import { ecransPourFichiers } from './selection';

export function verifierContratsBanc() {
  const optimizer = ECRANS.find((e) => e.id === 'optimizer')!;
  const tailles = taillesPour(optimizer);
  egal(tailles.length, 13, 'Optimizer : téléphone et douze tailles de bureau');
  egal(new Set(tailles.map((t) => t.id)).size, tailles.length, 'tailles distinctes : captures sans collision');
  for (const ecran of ECRANS.filter((e) => e !== optimizer)) {
    egal(taillesPour(ecran).map((t) => t.id), ['telephone', 'ordinateur'], `${ecran.id} garde ses deux tailles`);
  }
  for (const volet of [false, true]) {
    const bureau = tailles.filter((t) => !!t.optimizer?.volet === volet && t.optimizer);
    for (const agencement of ['A1', 'A2', 'A3']) {
      ok(bureau.some((t) => t.optimizer?.agencement === agencement), `${volet ? 'volet' : 'pleine page'} : ${agencement} exercé`);
    }
    for (const colonnes of ['superposees', 'une-inseree', 'deux-inserees']) {
      ok(bureau.some((t) => t.optimizer?.colonnes === colonnes), `${volet ? 'volet' : 'pleine page'} : colonnes ${colonnes}`);
    }
    for (const fiche of ['repliee', 'depliee']) {
      ok(bureau.some((t) => t.optimizer?.agencement === 'A3' && t.optimizer.fiche === fiche), `A3 ${volet ? 'volet' : 'pleine page'} : fiche ${fiche}`);
    }
  }
  for (const taille of tailles) {
    if (!taille.optimizer) continue;
    const [min, max] = taille.optimizer.conteneur;
    egal(agencementBureau(min), taille.optimizer.agencement, `${taille.id} : borne inférieure cohérente`);
    egal(agencementBureau(max - 1), taille.optimizer.agencement, `${taille.id} : borne supérieure cohérente`);
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
