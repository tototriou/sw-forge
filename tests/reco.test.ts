// Confrontation d'une recommandation au compte — et surtout : **pourquoi** un
// monstre est rejeté. Tant que « ko » se lisait « stats insuffisantes », un
// monstre au bon runage mais trop lent, un monstre mal runé et un monstre au
// mauvais artéfact portaient le même message, alors que le geste à faire n'est
// pas le même dans les trois cas.

import { MatchContext, SlotMatch, deckFaults, matchDeck, slotFaults } from '../src/lib/recoMatch';
import { OwnedBuild } from '../src/lib/ownedBuilds';
import { artifactSubKinds, artifactSubLabel, artifactSubsFor, isArtifactSub } from '../src/lib/effects';
import { cleanArtifacts, decodeRecosJson, encodeRecosJson } from '../src/lib/recoShare';
import { chercheMonstre } from '../src/lib/recoSearch';
import {
  MAX_ARTIFACT_SUBS,
  Monster,
  RecoDeck,
  emptyRecoCounter,
  emptyRecoDeck,
  emptyRecoSlot,
} from '../src/types';
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

// Défenses adverses visées par un deck (« fort contre »).
//
// ⚠️ Ce qui se joue ici est l'ALLER-RETOUR : ce que l'auteur pose doit arriver
// intact chez celui qui importe, et un fichier antérieur à la fonctionnalité
// doit continuer de se lire.
export function testDefensesVisees() {
  titre('Défenses adverses visées par un deck');

  const deck: RecoDeck = {
    ...emptyRecoDeck(),
    name: 'Def 1',
    counters: [
      {
        monsters: [
          { com2usId: 15214, name: 'Trevor' },
          { com2usId: 12312, name: 'Bella' },
          { com2usId: 19315, name: 'Chloe' },
        ],
        note: 'si le Chloe est en lead',
      },
    ],
  };
  const reco = { id: 'x', origin: 'mine' as const, name: 'R', author: '', note: '', decks: [deck] };
  // Un deck sans monstre n'est pas exporté : on en pose un pour que la reco le soit.
  reco.decks[0].slots[0] = { ...emptyRecoSlot(), com2usId: 999, name: 'Moi' };

  const relu = decodeRecosJson(encodeRecosJson([reco]));
  const c = relu?.[0]?.decks[0]?.counters ?? [];
  egal(c.length, 1, 'la défense visée survit à l’aller-retour');
  egal(
    c[0]?.monsters.map((m) => m.com2usId),
    [15214, 12312, 19315],
    'les 3 monstres sont transportés par leur com2usId'
  );
  egal(c[0]?.note, 'si le Chloe est en lead', 'la précision est transportée');

  // Une défense sans aucun monstre ne dit rien : elle ne part pas.
  const vide = { ...reco, decks: [{ ...deck, counters: [emptyRecoCounter()] }] };
  vide.decks[0].slots = deck.slots;
  egal(
    decodeRecosJson(encodeRecosJson([vide]))?.[0]?.decks[0]?.counters.length,
    0,
    'une défense sans monstre n’est ni écrite ni relue'
  );

  // Rétrocompatibilité : un fichier ≤ v4 n'a pas la clé.
  const v4 = JSON.stringify({
    format: 'sw-forge/recommandations',
    version: 4,
    recommandations: [
      { nom: 'R', decks: [{ nom: 'D', monstres: [{ com2usId: 999, nom: 'Moi' }, null, null] }] },
    ],
  });
  egal(
    decodeRecosJson(v4)?.[0]?.decks[0]?.counters,
    [],
    'fichier antérieur → aucune défense visée, rien ne casse'
  );
}

// Recherche d'un monstre sur la page des recommandations.
//
// ⚠️ Le point qui compte : le mode ORDONNE, il ne restreint pas. Une reco où le
// monstre n'apparaît que dans l'autre rôle doit rester visible — sinon on
// cherche « Chloe », on ne la voit pas, et rien ne dit qu'elle est là.
export function testRechercheMonstre() {
  titre('Recherche d’un monstre dans les recommandations');

  const mons = new Map<number, Monster>();
  const reco = (id: string, deck: RecoDeck) => ({
    id,
    origin: 'mine' as const,
    name: id,
    author: '',
    note: '',
    decks: [deck],
  });

  // A joue Chloé ; B la subit (elle est dans une défense visée).
  const joue = reco('A', {
    ...emptyRecoDeck(),
    slots: [
      { ...emptyRecoSlot(), com2usId: 1, name: 'Chloé' },
      emptyRecoSlot(),
      emptyRecoSlot(),
    ],
  });
  const bat = reco('B', {
    ...emptyRecoDeck(),
    slots: [{ ...emptyRecoSlot(), com2usId: 2, name: 'Trevor' }, emptyRecoSlot(), emptyRecoSlot()],
    counters: [
      {
        monsters: [
          { com2usId: 1, name: 'Chloé' },
          { com2usId: null, name: '' },
          { com2usId: null, name: '' },
        ],
        note: '',
      },
    ],
  });
  const liste = [joue, bat];

  egal(chercheMonstre(liste, '', 'all', mons), null, 'requête vide → aucun filtrage');
  egal(chercheMonstre(liste, 'chloe', 'all', mons)?.length, 2, 'sans accent, on trouve « Chloé »');
  egal(
    chercheMonstre(liste, 'CHLOÉ', 'all', mons)?.length,
    2,
    'la casse et les accents sont ignorés'
  );
  egal(chercheMonstre(liste, 'zzz', 'all', mons)?.length, 0, 'monstre absent → aucun résultat');

  // Le tri remonte le bon rôle SANS retirer l'autre.
  const enDef = chercheMonstre(liste, 'chloe', 'defense', mons) ?? [];
  egal(enDef.length, 2, 'mode « défense » : les deux recos restent visibles');
  egal(enDef[0]?.reco.id, 'B', 'mode « défense » : celle qui la BAT passe devant');

  const enOff = chercheMonstre(liste, 'chloe', 'offense', mons) ?? [];
  egal(enOff.length, 2, 'mode « offense » : les deux recos restent visibles');
  egal(enOff[0]?.reco.id, 'A', 'mode « offense » : celle qui la JOUE passe devant');

  // Les positions servent au surlignage.
  const h = chercheMonstre([bat], 'chloe', 'all', mons)?.[0];
  egal(h?.decks[0]?.counters, [0], 'la défense visée qui la contient est repérée');
  egal(h?.decks[0]?.slots, [], 'et elle n’est pas dans les slots du deck');
  egal(h?.enDefense, true, 'le rôle est bien « défense »');
}

// Recherche à PLUSIEURS monstres : le ET, et ce qu'il implique.
export function testRechercheMultiple() {
  titre('Recherche à plusieurs monstres (ET, même composition)');

  const mons = new Map<number, Monster>();
  const trio = (noms: string[]) =>
    noms.map((n, i) => ({ ...emptyRecoSlot(), com2usId: i + 1, name: n }));

  const abc = {
    id: 'ABC',
    origin: 'mine' as const,
    name: 'ABC',
    author: '',
    note: '',
    decks: [{ ...emptyRecoDeck(), slots: trio(['Chloé', 'Trevor', 'Bella']) }],
  };
  // Même monstre de tête, mais pas la même composition.
  const axy = {
    id: 'AXY',
    origin: 'mine' as const,
    name: 'AXY',
    author: '',
    note: '',
    decks: [{ ...emptyRecoDeck(), slots: trio(['Chloé', 'Xiao', 'Yen']) }],
  };
  const liste = [abc, axy];

  egal(chercheMonstre(liste, ['chloe'], 'all', mons)?.length, 2, 'un seul terme → les deux decks');
  egal(
    chercheMonstre(liste, ['chloe', 'trevor'], 'all', mons)?.map((h) => h.reco.id),
    ['ABC'],
    'deux termes → seul le deck qui réunit LES DEUX (ET, pas OU)'
  );
  egal(
    chercheMonstre(liste, ['chloe', 'trevor', 'bella'], 'all', mons)?.map((h) => h.reco.id),
    ['ABC'],
    'trois termes → la composition exacte'
  );
  egal(
    chercheMonstre(liste, ['chloe', 'zzz'], 'all', mons)?.length,
    0,
    'un terme introuvable suffit à écarter le deck'
  );

  // Les champs vides n'exigent rien — sinon ouvrir un champ viderait la page.
  egal(
    chercheMonstre(liste, ['chloe', '', ''], 'all', mons)?.length,
    2,
    'les champs vides sont ignorés'
  );
  egal(chercheMonstre(liste, ['', '', ''], 'all', mons), null, 'tout vide → aucune recherche');

  // ⚠️ Deux fois le même nom exige DEUX monstres : une position déjà retenue ne
  // compte pas une seconde fois.
  egal(
    chercheMonstre(liste, ['chloe', 'chloe'], 'all', mons)?.length,
    0,
    'le même nom deux fois exige deux monstres distincts'
  );

  // Le ET vaut par COMPOSITION : réparti entre un deck et sa défense, il ne
  // compte pas.
  const mixte = {
    id: 'MIX',
    origin: 'mine' as const,
    name: 'MIX',
    author: '',
    note: '',
    decks: [
      {
        ...emptyRecoDeck(),
        slots: trio(['Chloé', 'Woosa', 'Zaiross']),
        counters: [
          {
            monsters: [
              { com2usId: 9, name: 'Trevor' },
              { com2usId: null, name: '' },
              { com2usId: null, name: '' },
            ],
            note: '',
          },
        ],
      },
    ],
  };
  egal(
    chercheMonstre([mixte], ['chloe', 'trevor'], 'all', mons)?.length,
    0,
    'un monstre joué + un monstre battu ≠ une composition qui les réunit'
  );
}
