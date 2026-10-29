import type { BancEcran } from './optimizer-ecran-preuves';
import type { BoxItem } from '../../src/lib/applyAccount';
import type { ArtifactDetail, GearSet, RelicDetail, RuneDetail } from '../../src/types';
import type { ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import type { DemandeDeRecherche } from '../../src/workers/runeBuildOptim.worker';
import { attendreDemandeTest, observerRechercheTest } from './optimizer-classement-banc';
import { photoCriteres } from '../../src/lib/criteresOptimizer';
import { computeStats } from '../../src/lib/stats';

type Banc = BancEcran & {
  data: () => ExclusionSourceData;
  changerBox: (box: BoxItem[]) => void;
  changerRunes: (runes: RuneDetail[]) => void;
  changerArtefacts: (arts: ArtifactDetail[]) => void;
  changerReliques: (reliques: RelicDetail[]) => void;
};
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (nom: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e) && e.textContent?.trim() === nom)!;
const json = (v: unknown) => JSON.stringify(v);

export async function preuvesExemplaireLecture(b: Banc, nom: string): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (v: boolean, t: string) => preuves.push([v, t]);
  const origine = b.data().box.find(i => i.key === '11')!;
  const runes = (debut: number, valeur: number): RuneDetail[] => Array.from({ length: 6 }, (_, i) => ({
    id: debut + i, slot: i + 1, set: 'energy', rank: 6, rarity: 5, level: 15, main: { code: 3, value: valeur }, subs: [],
  }));
  const paire = (id: number, valeur: number): ArtifactDetail[] => [
    { id, kind: 'element', element: 'fire', rarity: 5, level: 15, main: { code: 101, value: valeur }, subs: [] },
    { id: id + 1, kind: 'archetype', archetype: 'attack', rarity: 5, level: 15, main: { code: 101, value: valeur }, subs: [] },
  ];
  const fiche = (id: number, valeur: number): GearSet => ({ base: origine.gear!.base, runes: runes(id, valeur),
    artifacts: paire(id + 10, valeur), relic: { id: id + 20, upgrade: 15, main: { code: 101, value: valeur / 10 } } });
  const actuelle = fiche(100, 10), validee = fiche(200, 20), apercu = fiche(300, 30);
  await b.geste(() => {
    b.changerRunes([...actuelle.runes, ...validee.runes, ...apercu.runes]);
    b.changerArtefacts([...actuelle.artifacts, ...validee.artifacts, ...apercu.artifacts]);
    b.changerReliques([actuelle.relic!, validee.relic!, apercu.relic!]);
    b.changerBox(b.data().box.map(i => i.key === '11' ? { ...i, gear: actuelle } : i.key === '33' ? { ...i, gear: apercu } : i));
  });
  await b.geste(() => b.listes().validateBuild('a', b.premier, validee.runes.map(r => r.id), validee.artifacts.map(a => a.id), validee.relic!.id, 10101));
  await b.geste(() => b.etat().choisirMembre('a', b.premier));
  await b.geste(() => {
    b.etat().setMinStats({}); b.etat().setMaxStats({}); b.etat().setComboSets(['energy']);
    b.etat().setLockedRunes({}); b.etat().setOptimiserArtefacts(nom === 'equipement'); b.etat().setRelicMainChoice('equipped');
    b.etat().setArtifactMainByKind({ element: 'equipped', archetype: 'equipped' });
    b.etat().setObjective('efficience'); b.etat().setSortBy('efficience');
  });
  const criteres = () => json(photoCriteres(b.etat(), { type: 'personnel' }));
  const avant = criteres(), listesAvant = json({ membres: b.listes().members, memoires: [...b.listes().memories], builds: b.listes().validated });
  verifier(bouton('Build validé').getAttribute('aria-pressed') === 'true', 'vue de départ : Build validé');
  if (nom === 'equipement') {
    const envois: DemandeDeRecherche[] = [], restaurer = observerRechercheTest(envois);
    try {
      for (const [index, choix] of ['Build validé', 'Build actuel', 'Box · 2'].entries()) {
        await b.geste(() => bouton(choix).click());
        await b.geste(() => bouton('Rechercher').click());
        await attendreDemandeTest(envois, index + 1);
        const p = envois[index]?.params;
        verifier(p?.relic?.id === validee.relic!.id && json(p?.artifacts.map(a => a.id)) === json(validee.artifacts.map(a => a.id)),
          `${choix} : relique et artéfacts envoyés à la recherche restent ceux du membre validé`);
        verifier(criteres() === avant && json({ membres: b.listes().members, memoires: [...b.listes().memories], builds: b.listes().validated }) === listesAvant,
          `${choix} : critères, membres, mémoires et builds inchangés`);
        await b.geste(() => b.etat().search.reset());
      }
      await b.geste(() => bouton('Revenir').click());
      verifier(bouton('Build actuel').getAttribute('aria-pressed') === 'true', 'Revenir retrouve la vue Build actuel précédant l’aperçu');
      await b.geste(() => bouton('Box · 2').click());
      await b.geste(() => b.etat().choisirMembre('a', b.second));
      verifier(!bouton('Revenir') && bouton('Build actuel').getAttribute('aria-pressed') === 'true', 'changement de membre : aperçu vidé, vue de départ du membre sans validation');
    } finally { restaurer(); }
  } else {
    // Le résultat conserve les artéfacts et la relique fixes du lancement.
    const ficheResultat = { ...apercu, artifacts: actuelle.artifacts, relic: actuelle.relic };
    const resultat = { status: 'done', progress: null, result: { candidates: [{ runeIds: apercu.runes.map(r => r.id),
      stats: computeStats(ficheResultat), effTotal: 0 }], explored: 1, truncated: false, nearMissByCondition: [], globalNearMiss: null } };
    await b.geste(() => b.forcerRecherche(resultat));
    const cartes = () => [...document.querySelectorAll<HTMLElement>('[data-carte-resultat]')].filter(visible);
    verifier(cartes().length === 1, 'résultat présent avant aperçu');
    await b.geste(() => bouton('Box · 2').click());
    verifier(cartes().length === 1 && criteres() === avant, 'aperçu : résultats et critères conservés');
    if (nom === 'comparaison') {
      await b.geste(() => bouton('Comparer').click());
      const deltas = [...cartes()[0].lastElementChild!.querySelectorAll('span.font-mono')].map(e => e.textContent?.trim());
      const reference = computeStats(apercu);
      const attendus = computeStats(ficheResultat).map((s, i) => {
        const delta = Math.round(s.total - reference[i].total);
        return `${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-FR')}${s.suffix}`;
      });
      verifier(deltas.length === 8 && deltas.every((t, i) => t?.replace(/\s/g, '') === attendus[i].replace(/\s/g, '')),
        'Comparer contre la fiche en aperçu : huit écarts exacts, artéfacts et relique de la référence compris');
      await b.geste(() => bouton('Build actuel').click());
      const autres = [...cartes()[0].lastElementChild!.querySelectorAll('span.font-mono')].map(e => e.textContent?.trim());
      verifier(autres.some(t => t?.startsWith('+')), 'Comparer contre Build actuel : la référence change avec la fiche');
    } else {
      await b.geste(() => bouton('Valider ce build').click());
      const build = b.listes().validated.find(v => v.listId === 'a' && json(v.selector) === json(b.premier));
      verifier(json(build?.runeIds) === json(apercu.runes.map(r => r.id)) && json(build?.artifactIds) === json(apercu.artifacts.map(a => a.id)) && build?.reliqueId === apercu.relic!.id,
        'validation depuis aperçu : runes, artéfacts et relique affichés enregistrés pour le membre');
      verifier(!bouton('Revenir') && bouton('Build validé').getAttribute('aria-pressed') === 'true', 'validation : aperçu quitté, vue Build validé');
      verifier(json(b.listes().members) === json(JSON.parse(listesAvant).membres), 'validation depuis aperçu : aucun membre ajouté ni retiré');
    }
  }
  return preuves;
}
