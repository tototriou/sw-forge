// Tests de rendu — Siège · Recommandations, le choix posé à l'import quand le
// fichier complète une recommandation existante (`ChoixFusionRecos`), et la
// `source` relue du stockage par `useSiegeRecos`.
//
// ⚠️ La `Modale` se monte dans `<body>` et ne rend rien côté serveur : le
// sous-titre et les options se rendent par leurs composants exportés.

import { OptionsFusion, SousTitreFusion, titreChoixFusion } from '../../src/components/siege/ChoixFusionRecos';
import { useSiegeRecos } from '../../src/hooks/useSiegeRecos';
import type { Reco, RecoPayload } from '../../src/types';
import { egal, faussLocalStorage, ok, titre } from '../outils';
import { boutons, rendre, texteVisible } from './outils-rendu';

const existante: Reco = { id: 'r1', origin: 'imported', name: 'Mes offs', author: 'A', note: '', decks: [] };
const entrante: RecoPayload = { name: 'Offs — 06/11/2026', author: 'A', note: '', decks: [] };

export function testRenduRecoFusionChoix() {
  titre('rendu · Siège · Recommandations — choix « fusionner » ou « ajouter à part » à l\'import');
  const paires = [{ entrante, existante }];
  egal(titreChoixFusion(paires), 'Ce fichier complète une de tes recommandations', 'titre, une recommandation');
  egal(titreChoixFusion([...paires, ...paires]), 'Ce fichier complète tes recommandations', 'titre, plusieurs');

  const sous = texteVisible(rendre(<SousTitreFusion paires={paires} />));
  // `texteVisible` met une espace à chaque balise (le nom est en gras).
  ok(sous.includes('« Offs — 06/11/2026 » prolonge ta recommandation « Mes offs » .'), 'le sous-titre nomme le fichier et la recommandation complétée');
  ok(sous.includes("rien de ce que tu as n'est retiré ni réécrit"), 'le sous-titre dit ce qui n\'est pas touché');

  const html = rendre(
    <OptionsFusion une apercu={{ decksAjoutes: 3, decksEnrichis: 2, defensesAjoutees: 5, decksInchanges: 1 }} onChoisir={() => {}} />,
  );
  const options = boutons(html);
  egal(options.length, 2, 'deux choix, sans « Annuler » (la croix de la coquille ferme sans importer)');
  ok(options[0].texte.startsWith('Fusionner dans la recommandation existante'), '« Fusionner » en premier');
  ok(options[0].texte.includes('3 decks nouveaux, à la fin ; 2 decks que tu as déjà gagnent 5 défenses visées.'), '« Fusionner » dit d\'avance ce qui arrive');
  ok(options[0].texte.includes('Tes builds, tes consignes et tes retouches restent tels quels.'), '« Fusionner » dit ce qui est gardé');
  ok(options[1].texte.startsWith('Ajouter à part') && options[1].texte.includes('à côté de la tienne'), '« Ajouter à part », et ce qu\'il fait');

  const plusieurs = boutons(rendre(<OptionsFusion une={false} apercu={{ decksAjoutes: 0, decksEnrichis: 0, defensesAjoutees: 0, decksInchanges: 2 }} onChoisir={() => {}} />));
  ok(plusieurs[0].texte.startsWith('Fusionner dans les recommandations existantes'), 'pluriel quand le fichier en complète plusieurs');
  ok(plusieurs[0].texte.includes('Rien de nouveau'), 'rien de nouveau : dit tel quel');
}

function Sources() {
  const recos = useSiegeRecos();
  return <p>{recos.state.recos.map((r) => r.source ?? '—').join(',')}</p>;
}

export function testRenduRecoFusionStockage() {
  titre('Siège · Recommandations — la `source` survit au rechargement');
  faussLocalStorage({
    'swblacksmith-siege-recos-v1': JSON.stringify({
      recos: [
        { id: 'a', origin: 'imported', name: 'A', author: '', note: '', decks: [], source: 'outil:abc' },
        { id: 'b', origin: 'mine', name: 'B', author: '', note: '', decks: [] },
      ],
    }),
  });
  egal(texteVisible(rendre(<Sources />)), 'outil:abc,—', 'relue du stockage quand elle existe, absente sinon');
}
