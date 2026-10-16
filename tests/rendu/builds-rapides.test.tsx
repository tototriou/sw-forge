// Le bloc « Builds les plus rapides » du Résumé des runes, rendu : ce qu'il
// dit, pas sa forme. Le calcul lui-même est vérifié par builds-rapides.test.ts.

import { RuneDetail } from '../../src/types';
import BuildsRapides from '../../src/components/account/BuildsRapides';
import { REGLAGE_BUILDS_RAPIDES_DEFAUT, setReglageBuildsRapides } from '../../src/hooks/useBuildsRapides';
import { BROKEN } from '../../src/lib/buildsRapides';
import { egal, ok, titre } from '../outils';
import { rendre, texteVisible } from './outils-rendu';

function rune(id: number, slot: number, set: string, vit: number): RuneDetail {
  return {
    id, slot, set, rank: 6, rarity: 5, level: 15,
    main: { code: slot === 2 ? 8 : 1, value: slot === 2 ? 42 : 10 },
    subs: [{ code: 8, value: vit }],
  };
}

export function testRenduBuildsRapides() {
  titre('Rendu — builds les plus rapides');
  // 4 Swift (slots 1-4) et 2 Will (slots 5-6) : un seul Swift + Will possible.
  const runes = [1, 2, 3, 4].map((s) => rune(s, s, 'swift', 20)).concat([rune(5, 5, 'will', 10), rune(6, 6, 'will', 10)]);

  setReglageBuildsRapides({ combos: [{ quatre: 'swift', deux: 'will' }, { quatre: 'violent', deux: BROKEN }], nombre: 5 });
  const html = rendre(<BuildsRapides runes={runes} />);
  const t = texteVisible(html);
  ok(t.startsWith('Builds les plus rapides Choisir les combinaisons'), 'le titre et le bouton de choix');
  // 100 + (4×20 + 42 + 2×10) + 25 = 267.
  ok(t.includes('Swift + Will 267 Violent + Broken — Swift + Will #1 Eff.'), 'les onglets, avec la VIT de leur #1, puis chaque combinaison sous son titre');
  ok(t.includes('267 VIT Base 100 Runes +142'), 'la VIT totale (bonus Swift compris) et son détail');
  ok(!t.includes('Bonus'), 'pas de case Bonus');
  egal((t.match(/#\d/g) ?? []).length, 1, 'un seul build : les runes sont prises par le #1');
  ok(t.endsWith('Violent + Broken Aucun build possible avec tes runes.'), 'une combinaison impossible le dit');
  // Les deux régimes sont du CSS : les onglets disparaissent à partir de `xl`,
  // et sous `xl` seule la combinaison choisie reste — ici la première.
  ok(html.includes('xl:hidden" role="group"'), 'la rangée d’onglets s’efface à partir de xl');
  egal((html.match(/<section class="hidden xl:block"/g) ?? []).length, 1, 'sous xl, la seconde combinaison est masquée, pas la première');

  setReglageBuildsRapides({ combos: [], nombre: 5 });
  ok(
    texteVisible(rendre(<BuildsRapides runes={runes} />)).endsWith('Aucune combinaison choisie : ajoute-en avec « Choisir les combinaisons ».'),
    'aucune combinaison : où en ajouter'
  );
  // Le store est global au processus de test : on rend le défaut aux suivants.
  setReglageBuildsRapides(REGLAGE_BUILDS_RAPIDES_DEFAUT);
}
