// Confrontation d'une recommandation au compte — et surtout : **pourquoi** un
// monstre est rejeté. Tant que « ko » se lisait « stats insuffisantes », un
// monstre au bon runage mais trop lent, un monstre mal runé et un monstre au
// mauvais artéfact portaient le même message, alors que le geste à faire n'est
// pas le même dans les trois cas.

import { MatchContext, SlotMatch, deckFaults, matchDeck, slotFaults } from '../src/lib/recoMatch';
import { OwnedBuild } from '../src/lib/ownedBuilds';
import { artifactSubKinds, artifactSubLabel, artifactSubsFor, isArtifactSub } from '../src/lib/effects';
import { cleanArtifacts } from '../src/lib/recoShare';
import { MAX_ARTIFACT_SUBS, RecoDeck, emptyRecoSlot } from '../src/types';
import { egal, ok, titre } from './outils';

// Slot minimal : seuls `status`, `checks`, `artifactChecks` et `missingSets`
// entrent dans le diagnostic, le reste n'est là que pour satisfaire le type.
function slot(p: {
  statsOk?: boolean;
  artefactsOk?: boolean;
  sets?: string[];
  status?: SlotMatch['status'];
}): SlotMatch {
  return {
    status: p.status ?? 'ko',
    owned: null,
    copies: 1,
    checks: [
      {
        key: 'spd' as any,
        label: 'VIT',
        suffix: '',
        required: 212,
        actual: p.statsOk === false ? 117 : 220,
        ok: p.statsOk !== false,
        diff: 0,
      },
    ],
    artifactChecks:
      p.artefactsOk === undefined
        ? []
        : [{ kind: 'element', code: 300, label: 'Dégâts sur le Feu', ok: p.artefactsOk }],
    ownedSets: [],
    missingSets: p.sets ?? [],
  };
}

export default function testReco() {
  titre('Analyse des recommandations · cause du rejet');

  egal(slotFaults(slot({ statsOk: false })), ['stats'], 'bon set, stats trop basses → « stats »');
  egal(slotFaults(slot({ sets: ['Violent'] })), ['sets'], 'stats atteintes, set absent → « sets »');
  egal(
    slotFaults(slot({ artefactsOk: false })),
    ['artifacts'],
    "propriété d'artéfact absente → « artifacts », et surtout pas « stats »"
  );
  egal(
    slotFaults(slot({ statsOk: false, artefactsOk: false, sets: ['Violent'] })),
    ['sets', 'artifacts', 'stats'],
    'les trois à la fois → les trois causes, dans l’ordre du geste à faire'
  );

  // ⚠️ Un slot qui n'est pas `ko` n'a pas de cause : ni « absent » ni « ok » ne
  // doivent produire un libellé de rejet.
  egal(slotFaults(slot({ status: 'ok' })), [], 'slot au niveau → aucune cause');
  egal(
    slotFaults(slot({ status: 'absent', statsOk: false })),
    [],
    'monstre indisponible → aucune cause de rejet'
  );

  // Deck : l'agrégat doit rester fidèle même quand les slots divergent.
  egal(
    deckFaults([slot({ statsOk: false }), slot({ artefactsOk: false })]),
    ['artifacts', 'stats'],
    'un slot stats + un slot artéfacts → les deux causes, jamais une seule'
  );
  egal(
    deckFaults([slot({ sets: ['Fight'] }), slot({ status: 'ok' })]),
    ['sets'],
    'seul défaut du deck : le runage'
  );
  egal(deckFaults([slot({ status: 'ok' }), slot({ status: 'ok' })]), [], 'deck au niveau → aucune cause');

  titre("Confrontation d'un deck aux artéfacts du compte");

  // Un build fictif : aucune stat exigée, seuls les artéfacts comptent, pour
  // isoler ce que ce test vérifie.
  const build = (subs: { kind: 'element' | 'archetype'; codes: number[] }[]): OwnedBuild => ({
    monster: { id: 'm1', name: 'Tesarion', com2usId: 111 } as any,
    source: 'box',
    label: 'Box',
    gear: {
      base: { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 },
      runes: [],
      artifacts: subs.map((s) => ({
        kind: s.kind,
        level: 15,
        rarity: 5,
        main: { code: 100, value: 0 },
        subs: s.codes.map((code) => ({ code, value: 10 })),
      })),
    },
  });

  const deckAvec = (artifacts: Record<'element' | 'archetype', number[]>): RecoDeck => ({
    name: '',
    note: '',
    slots: [
      { ...emptyRecoSlot(), com2usId: 111, name: 'Tesarion', artifacts },
      emptyRecoSlot(),
      emptyRecoSlot(),
    ],
  });

  const ctxAvec = (b: OwnedBuild): MatchContext => ({
    builds: new Map([[111, [b]]]),
    teams: [{ label: 'Offense 1', builds: new Map([[111, b]]) } as any],
  });

  const porteFeu = build([{ kind: 'element', codes: [300, 215] }]);

  egal(
    matchDeck(deckAvec({ element: [300], archetype: [] }), ctxAvec(porteFeu)).status,
    'ok',
    "propriété exigée bien portée → deck jouable"
  );
  egal(
    matchDeck(deckAvec({ element: [301], archetype: [] }), ctxAvec(porteFeu)).status,
    'ko',
    'propriété exigée absente → deck rejeté, alors qu’aucune stat ne manque'
  );
  // ⚠️ Artéfact carrément pas équipé : la propriété manque tout autant. Sans ce
  // cas, un monstre sans artéfact de type passerait pour conforme.
  egal(
    matchDeck(deckAvec({ element: [], archetype: [400] }), ctxAvec(porteFeu)).status,
    'ko',
    'artéfact de la sorte demandée absent du build → rejeté'
  );
  egal(
    slotFaults(matchDeck(deckAvec({ element: [301], archetype: [] }), ctxAvec(porteFeu)).slots[0]),
    ['artifacts'],
    'et la cause annoncée est bien l’artéfact'
  );

  titre("Propriétés secondaires d'artéfacts");

  // ⚠️ Les plages de codes décident de la sorte d'artéfact. Se tromper ici
  // proposerait des propriétés impossibles à satisfaire.
  egal(artifactSubKinds(300), ['element'], 'dégâts élémentaires → artéfact d’attribut seul');
  egal(artifactSubKinds(402), ['archetype'], 'dmg crit par compétence → artéfact de type seul');
  egal(artifactSubKinds(215), ['element', 'archetype'], 'vol de vie → les deux sortes');

  const attribut = artifactSubsFor('element').map((o) => o.code);
  const type = artifactSubsFor('archetype').map((o) => o.code);
  ok(attribut.includes(300) && !attribut.includes(400), "l'attribut propose 300 et jamais 400");
  ok(type.includes(400) && !type.includes(300), 'le type propose 400 et jamais 300');
  ok(attribut.length > 20 && type.length > 20, 'les deux listes sont fournies, pas des restes');

  // Le libellé sert de repère dans une liste de 45 : il doit nommer la
  // propriété, pas retomber sur « #300 ».
  //
  // ⚠️ C'est le libellé **du jeu**, relevé sur sa recherche détaillée de
  // sous-propriétés — pas une reformulation « plus claire ». Un joueur qui lit
  // autre chose ici que dans son inventaire ne fait pas le rapprochement.
  egal(artifactSubLabel(300), 'Aug. des dgts infl. au Feu +X%', 'libellé lisible, valeur en joker');
  ok(!isArtifactSub(999), 'code inexistant refusé');

  // ⚠️ L'ORDRE est celui du jeu, pas celui des codes : les dégâts élémentaires
  // d'abord (300-304), puis les dégâts reçus (305-309), puis les compétences.
  // Cette liste servira à l'optimisation d'artéfacts — voir SUB_ORDER.
  egal(attribut.slice(0, 5), [300, 301, 302, 303, 304], 'les dégâts élémentaires ouvrent la liste');
  egal(type.slice(0, 4), [400, 401, 410, 411], 'le type commence par les dmg crit de compétence');

  titre("Artéfacts d'une recommandation partagée");

  const bruit = { errors: [] as string[], warnings: [] as string[] };
  egal(
    cleanArtifacts({ attribut: [300, 301], type: [400] }, bruit, 'x'),
    { element: [300, 301], archetype: [400] },
    'clés françaises du fichier → sortes internes'
  );
  egal(
    cleanArtifacts({ attribut: [{ code: 300, propriete: 'peu importe' }] }, bruit, 'x'),
    { element: [300], archetype: [] },
    'forme écrite par l’export (code + libellé) relue par son CODE'
  );
  // ⚠️ Le libellé du fichier ne fait pas foi : modifié à la main, il est ignoré.
  egal(
    cleanArtifacts({ attribut: [{ code: 300, propriete: 'Dégâts sur les Ténèbres' }] }, bruit, 'x'),
    { element: [300], archetype: [] },
    'libellé mensonger dans le fichier → seul le code compte'
  );
  egal(
    cleanArtifacts({ type: [300] }, bruit, 'x'),
    { element: [], archetype: [] },
    'propriété impossible sur cette sorte → écartée plutôt qu’ineffaçablement fausse'
  );
  egal(
    cleanArtifacts({ attribut: [300, 300, 301] }, bruit, 'x'),
    { element: [300, 301], archetype: [] },
    'doublon écarté : deux fois la même ligne n’est pas plus exigeant'
  );
  egal(
    cleanArtifacts({ attribut: [300, 301, 302, 303, 304] }, bruit, 'x').element.length,
    MAX_ARTIFACT_SUBS,
    'au-delà de 4 propriétés → tronqué, un artéfact n’a que 4 emplacements'
  );
  egal(
    cleanArtifacts(undefined, bruit, 'x'),
    { element: [], archetype: [] },
    'reco enregistrée avant les artéfacts → rien d’exigé, rien qui casse'
  );
  egal(
    cleanArtifacts({ attribut: [999] }, bruit, 'x'),
    { element: [], archetype: [] },
    'code inconnu ignoré'
  );
  ok(bruit.warnings.length > 0, 'les corrections sont REMONTÉES, pas tues');
}
