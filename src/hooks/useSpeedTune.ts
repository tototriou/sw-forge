import { useEffect, useMemo, useRef, useState } from 'react';
import { Monster, SiegeTeam } from '../types';
import { runeSpeedForTarget } from '../lib/speed';
import {
  ArtefactRequis,
  Camp,
  Fenetre,
  HORIZON_TICKS,
  ModParTick,
  RaisonOrdre,
  artefactsRequis,
  diagnostiquerChaine,
  diagnostiquerSequence,
  fenetresRequises,
  premiersTours,
  simuler,
  vitessesRequises,
} from '../lib/speedTune';
import { deckPourSpeedTune } from '../lib/speedTuneDeck';
import {
  Ligne,
  Leads,
  aLaMain,
  ampliDe as ampliDeLignes,
  combatDe as combatDeLigne,
  entreeDe as entreeDeLigne,
  estimerCumuls,
  gainPassifDe as gainPassifDeLigne,
  leadDe as leadDeCamp,
  ligneReference as ligneReferenceDe,
  ligneVierge,
  lignesDeDeck,
  majMod,
  oublierCamp,
  passifActifDe as passifActifDeLigne,
  passifDe as passifDeLigne,
  plusRapideAllie as plusRapideAllieDe,
  sortActif as sortActifDe,
  sortSecondDe,
  sortsDe as sortsDeLigne,
  tuneDe,
  uidDe,
  visibles,
} from '../lib/speedTuneLignes';
import { prendreDeck } from '../lib/speedTuneHandoff';
import { kitVitesse, sortsVitesse, KitVitesse, SortVitesse } from '../lib/speedTuneKit';
import { passifsVitesse, PassifVitesse } from '../lib/speedTunePassif';
import { analyseAutomatique, sortRetenu } from '../lib/speedTuneAuto';
import { chargerDetail } from '../lib/monsterSkills';
import { teamSummary } from '../lib/recoFromSiege';
import { formesJouables } from '../lib/monsterForms';
import { useAdversaireReference } from './useAdversaireReference';
import { useStickyState } from './useStickyState';

// Un deck proposé à l'import : une équipe de siège et le camp d'où elle vient.
export interface DeckDispo {
  cle: string;
  source: 'defense' | 'offense';
  team: SiegeTeam;
  libelle: string;
  monstres: Monster[];
}

export type ChampMod = 'atbMod' | 'speedMod';

// TOUT l'état et toutes les actions de l'écran de speed tuning.
//
// ⚠️ **La page ne fait que rendre.** Ce qui décide vit ici et dans les libs que
// ce hook appelle (`speedTuneLignes`, `speedTuneAuto`, `speedTune`) : la logique
// est MÉTIER, elle n'a rien à faire dans un composant — invérifiable, et c'est
// exactement là que se sont logés les écarts entre le siège et l'outil.
//
// ⚠️ Le hook n'expose AUCUN JSX : ce qui se dessine (pastilles, tableaux) reste
// dans le composant, ce qui se calcule reste ici.
export function useSpeedTune({
  allMonsters,
  siegeDefenseTeams,
  siegeOffenseTeams,
}: {
  allMonsters: Monster[];
  siegeDefenseTeams: SiegeTeam[];
  siegeOffenseTeams: SiegeTeam[];
}) {
  const [lignes, setLignes] = useStickyState<Ligne[]>('speedTune.lignes', []);
  const [leadAllie, setLeadAllie] = useStickyState<number>('speedTune.leadAllie', 0);
  const [leadEnnemi, setLeadEnnemi] = useStickyState<number>('speedTune.leadEnnemi', 0);

  const jouables = useMemo(() => formesJouables(allMonsters), [allMonsters]);
  // Réglage d'application : poser l'adversaire de référence à CHAQUE analyse,
  // même face à une composition importée (voir useAdversaireReference).
  const toujoursReference = useAdversaireReference();

  // Ce que le KIT de chaque monstre pose sur son camp (barre d'attaque de zone,
  // buff de vitesse de zone), lu dans les compétences pré-générées. Sert à
  // pré-remplir les deux champs de la card — l'utilisateur n'a pas à aller
  // chercher lui-même ce que fait le monstre — et à dire d'où vient la valeur.
  const [kits, setKits] = useState<Map<number, KitVitesse>>(new Map());
  // Les sorts de zone de chaque monstre (analyse poussée) : même lecture, même
  // chargement — on ne repasse pas deux fois sur les mêmes fichiers.
  const [sorts, setSorts] = useState<Map<number, SortVitesse[]>>(new Map());
  const [passifs, setPassifs] = useState<Map<number, PassifVitesse[]>>(new Map());

  // Analyse poussée : l'ordre des tours VOULU (uids, du premier au dernier) et,
  // par monstre, le sort qu'il lance à son tour ('' = aucun ; absent = celui que
  // la lecture du kit a retenu).
  // ⚠️ L'analyse AUTOMATIQUE, c'est TOUT ce que l'outil fait de lui-même, et la
  // couper coupe tout : l'adversaire de référence posé en face, les compétences
  // lues dans les kits qui remplissent les deux grilles, et **l'analyse poussée**
  // (ordre imposé + sort désigné), qui en est un raffinement et non un mode à
  // part. Coupée, la simulation n'obéit plus qu'à ce qu'on a saisi — c'est le
  // but : « je regarde ce que ça donne, puis je fais ce que je veux ».
  //
  // ⚠️ **L'analyse ÉCRIT, elle ne recouvre pas.** Elle lit les kits une fois, pose
  // ce qu'ils donnent DANS les grilles — exactement comme si on les avait
  // remplies à la main — et s'arrête là. Ensuite tout est modifiable sans que
  // rien ne repasse dessus. C'est ce qui remplace l'ancien « mode » vivant, où
  // les valeurs affichées n'existaient nulle part et se recalculaient sans
  // arrêt : impossible d'y toucher, et impossible de savoir ce qui venait de
  // l'outil ou de soi.
  //
  // Ce drapeau ne dit qu'une chose : une analyse a déjà été appliquée. Il sert à
  // la REJOUER quand on change un sort — le seul changement qui la rend fausse.
  const [auto, setAuto] = useStickyState<boolean>('speedTune.auto', false);
  // Affichage de la card « Ordre des sorts ». ⚠️ Ce n'est QUE de l'affichage :
  // les sorts déjà choisis continuent de compter, refermer la card ne défait
  // rien. Sinon ce serait un piège — on masque pour gagner de la place, pas pour
  // annuler un réglage.
  const [poussee, setPoussee] = useStickyState<boolean>('speedTune.poussee', true);
  // Affichage de la card d'analyse — même mécanique que celle de l'ordre des
  // sorts : ⚠️ replier n'annule rien, c'est de la place qu'on gagne, pas un
  // réglage qu'on défait.
  const [montrerAnalyse, setMontrerAnalyse] = useStickyState<boolean>('speedTune.montrer', true);
  const [ordreVoulu, setOrdreVoulu] = useStickyState<string[]>('speedTune.ordre', []);
  // ⚠️ Tant qu'on n'a rien rangé à la main, l'ordre voulu SUIT les vitesses :
  // c'est le point de départ évident (« voilà l'ordre que tu as aujourd'hui »),
  // et il se recale quand une vitesse change. Le premier ▲▼ le fige — à partir
  // de là c'est un choix, et le réécrire serait une perte.
  const [ordreRange, setOrdreRange] = useStickyState<boolean>('speedTune.ordreRange', false);
  const [sortChoisi, setSortChoisi] = useStickyState<Record<string, string>>('speedTune.sorts', {});
  // Le sort du SECOND tour, pour ceux dont la compétence leur rend leur tour
  // (Kroa) : on ne devine pas ce qu'ils lancent ensuite, c'est à désigner.
  const [sortChoisi2, setSortChoisi2] = useStickyState<Record<string, string>>('speedTune.sorts2', {});
  // L'allié VISÉ par un sort qui n'en touche qu'un (S3 de Sapsaree). Vide = la
  // barre la plus basse, le défaut du moteur.
  const [cibleSort, setCibleSort] = useStickyState<Record<string, string>>('speedTune.cibles', {});

  // Les données de kit sous la forme que la lib partagée attend.
  const donneesKit = useMemo(() => ({ kits, sorts, passifs }), [kits, sorts, passifs]);

  const leads: Leads = { allie: leadAllie, ennemi: leadEnnemi };
  const entreeDe = (l: Ligne) => entreeDeLigne(l);

  // ⚠️ Le compte de buffs se pose tout seul (voir `estimerCumuls`) : l'écran ne
  // fait que déclencher la mise à jour.
  useEffect(() => {
    setLignes((prev) => estimerCumuls(prev, donneesKit));
  }, [lignes, donneesKit, setLignes]);

  // ⚠️ **Arrivée depuis le siège** (« voir le speed tune » sur une équipe) : le
  // message est consommé UNE fois, à l'ouverture, et l'équipe est importée dans
  // « Ton équipe ». On ne relance pas l'analyse tout seul — c'est un geste, et
  // l'utilisateur vient peut-être régler autre chose d'abord.
  const arrivee = useRef(false);
  useEffect(() => {
    if (arrivee.current) return;
    const passe = prendreDeck();
    if (!passe) return;
    arrivee.current = true;
    const teams = passe.source === 'defense' ? siegeDefenseTeams : siegeOffenseTeams;
    const team = teams[Number(passe.teamId)] ?? teams.find((t) => t.id === passe.teamId);
    if (team) importerDeck('allie', team);
  }, [siegeDefenseTeams, siegeOffenseTeams]);

  // ⚠️ Rien n'est écrit dans les lignes : ce qu'un monstre fait se DÉDUIT de son
  // kit à l'affichage. Une valeur recopiée dans l'état aurait vieilli au premier
  // changement de sort, et il aurait fallu la protéger de l'écrasement.
  useEffect(() => {
    const ids = [
      ...new Set(
        lignes.map((l) => l.monster.com2usId).filter((id): id is number => id != null && !kits.has(id))
      ),
    ];
    if (ids.length === 0) return;
    let annule = false;
    Promise.all(
      ids.map(
        (id) => chargerDetail(id).then((d) => [id, kitVitesse(d), sortsVitesse(d), passifsVitesse(d)] as const)
      )
    ).then((paires) => {
      if (annule) return;
      setKits((prev) => new Map([...prev, ...paires.map(([id, kit]) => [id, kit] as const)]));
      setSorts((prev) => new Map([...prev, ...paires.map(([id, , liste]) => [id, liste] as const)]));
      setPassifs((prev) => new Map([...prev, ...paires.map(([id, , , ps]) => [id, ps] as const)]));
    });
    return () => {
      annule = true;
    };
  }, [lignes, kits]);
  const monsterById = useMemo(
    () => new Map(allMonsters.map((m) => [String(m.id), m])),
    [allMonsters]
  );

  // Decks importables : les équipes de siège du compte qui portent au moins un
  // monstre connu. `cle` porte la source, jamais `team.id` seul — deux équipes
  // de listes différentes peuvent partager un id (voir OptimizerSection.tsx).
  const decks = useMemo<DeckDispo[]>(() => {
    const out: DeckDispo[] = [];
    const ajouter = (source: 'defense' | 'offense', teams: SiegeTeam[]) => {
      teams.forEach((team, i) => {
        const monstres = team.slots
          .map((sl) => (sl.monsterId ? monsterById.get(sl.monsterId) : null))
          .filter((m): m is Monster => !!m);
        if (monstres.length === 0) return;
        out.push({ cle: `${source}:${i}`, source, team, libelle: teamSummary(team, monsterById), monstres });
      });
    };
    ajouter('defense', siegeDefenseTeams);
    ajouter('offense', siegeOffenseTeams);
    return out;
  }, [siegeDefenseTeams, siegeOffenseTeams, monsterById]);

  function ajouter(camp: Camp, id: string) {
    const uid = uidDe(camp, id);
    if (lignes.some((l) => l.uid === uid)) return;
    const monster = allMonsters.find((m) => String(m.id) === id);
    if (!monster) return;
    setLignes((prev) => [...prev, ligneVierge(monster, camp)]);
  }

  // Import d'un deck de siège dans un camp : le deck REMPLACE la composition de
  // ce camp — un deck est une équipe, pas une liste de monstres à empiler. Sans
  // ça, importer une deuxième défense entassait six monstres du même côté.
  //
  // ⚠️ **Ce qui était dans ce camp est perdu** (vitesses corrigées à la main,
  // modificateurs, compétences retouchées). C'est le prix du geste demandé, et
  // il ne touche QUE le camp visé : l'autre garde tout. Le deck reste dans
  // Siège, réimportable à volonté.
  //
  // Les deux camps y ont droit : une défense de siège se joue aussi bien depuis
  // l'autre bord, et c'est même là qu'on la connaît le mieux (on l'a affrontée).
  function importerDeck(camp: Camp, team: SiegeTeam) {
    const { monstres, lead } = deckPourSpeedTune(team, monsterById);
    if (monstres.length === 0) return;
    // ⚠️ Changer de deck OUBLIE l'analyse précédente : elle portait sur une autre
    // composition, et la relancer toute seule écrirait par-dessus un réglage
    // qu'on vient d'importer. On reclique quand on veut.
    setAuto(false);
    // ⚠️ **Les sorts choisis du camp s'en vont avec la composition.** Ils sont
    // rangés par monstre (`camp:id`) et survivaient donc à un import : on
    // rejouait le choix fait pour l'équipe PRÉCÉDENTE — y compris un sort qu'une
    // version antérieure avait posé d'office. L'outil comptait alors un effet
    // que le siège, lui, écarte : deux verdicts sur la même équipe.
    setSortChoisi((m) => oublierCamp(m, camp));
    setSortChoisi2((m) => oublierCamp(m, camp));
    setCibleSort((m) => oublierCamp(m, camp));
    setLignes((prev) => [
      // ⚠️ La référence saute AUSSI quand on importe dans l'autre camp : elle
      // copiait une équipe qui vient de changer.
      ...prev.filter((l) => l.camp !== camp && !l.reference),
      ...lignesDeDeck({ monstres, lead }, camp),
    ]);
    // Le lead du leader du deck, s'il vaut pour tout le camp (voir
    // speedTuneDeck.ts).
    //
    // ⚠️ **Toujours écrit, « Sans » compris.** Un deck sans lead de vitesse
    // laissait en place celui du deck précédent : on calculait la nouvelle
    // équipe avec un +28 % qui n'existait plus, et le siège — qui lit `lead ?? 0`
    // — répondait autre chose que l'outil sur la même compo. Importer un deck,
    // c'est importer TOUT ce qui fait ses vitesses.
    (camp === 'allie' ? setLeadAllie : setLeadEnnemi)(lead ?? 0);
  }

  // Analyse automatique : quand « En face » est VIDE, on n'a rien à devancer —
  // l'outil se donne alors un adversaire de référence, la copie du monstre le
  // plus rapide de l'équipe (même lead, même vitesse de runes). Autrement dit :
  // « est-ce que toute mon équipe joue avant un monstre aussi rapide que mon
  // plus rapide ? » — le point de départ d'un speed tune quand on ne sait pas
  // encore qui on affronte. Le monstre est AJOUTÉ en face, donc réglable et
  // retirable comme n'importe quel autre.
  // Le monstre le plus rapide de l'équipe (visible, vitesse connue) : le modèle
  // de l'adversaire de référence.
  const plusRapideAllie = () => plusRapideAllieDe(lignes, leads, donneesKit);
  const ligneReference = (modele: Ligne) => ligneReferenceDe(modele, lignes, donneesKit);

  // `mods` : ce que l'analyse a écrit POUR la référence. Elle le porte dès sa
  // création — une ligne posée sans ses modificateurs afficherait une grille qui
  // ment sur ce qui est calculé.
  function analyseAuto(mods?: { atbMod: ModParTick; speedMod: ModParTick }) {
    const modele = plusRapideAllie();
    if (!modele) return;
    setLeadEnnemi(leadAllie); // même lead : on compare des vitesses comparables
    const ref = { ...ligneReference(modele), ...(mods ?? {}) };
    setLignes((prev) => [...prev.filter((l) => !l.reference && l.uid !== ref.uid), ref]);
  }

  function retirer(uid: string) {
    setLignes((prev) => prev.filter((l) => l.uid !== uid));
  }
  function basculerMasque(uid: string) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...l, masque: !l.masque } : l)));
  }
  // ⚠️ Toute saisie sur une ligne lui retire le drapeau « référence » : à partir
  // du moment où on la règle, elle n'est plus une copie qui suit l'équipe mais un
  // adversaire à part entière — et l'écraser au prochain changement serait une
  // perte de travail silencieuse.
  function setRuneSpeed(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), runeSpeed: v } : l)));
  }
  function basculerPassif(uid: string) {
    setLignes((prev) =>
      prev.map((l) => (l.uid === uid ? { ...aLaMain(l), passifActif: l.passifActif === false } : l))
    );
  }
  function setCumuls(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), cumulsPassif: v } : l)));
  }
  function basculerSwift(uid: string) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), swift: !l.swift } : l)));
  }
  function setArtefact(uid: string, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.uid === uid ? { ...aLaMain(l), artefactBuff: v } : l)));
  }

  // Écrit une valeur dans la grille `champ`, pour un tick donné.
  //
  // ⚠️ **0 est une VALEUR, pas un effacement.** Une case à 0 annule ce que la
  // compétence pose à ce tick — c'est tout l'intérêt : écarter un effet
  // aléatoire (réduction d'ATB à 70 % de chances) dont un tune ne doit pas
  // dépendre. Seule une case VIDE (`null`) rend la main à la compétence.
  function setMod(champ: ChampMod, uid: string, tick: number, v: number | null) {
    setLignes((prev) =>
      prev.map((l) => (l.uid === uid ? { ...aLaMain(l), [champ]: majMod(l[champ], tick, v) } : l))
    );
  }
  function setModEquipe(champ: ChampMod, camp: Camp, tick: number, v: number | null) {
    setLignes((prev) => prev.map((l) => (l.camp === camp ? { ...l, [champ]: majMod(l[champ], tick, v) } : l)));
  }

  const leadDe = (camp: Camp) => leadDeCamp(leads, camp);

  // Des raccourcis sur la LIB, pour que le rendu se lise sans paramètres : tout
  // ce qui suit est calculé dans lib/speedTuneLignes.ts.
  const passifDe = (l: Ligne) => passifDeLigne(l, donneesKit);
  const passifActifDe = (l: Ligne) => passifActifDeLigne(l);
  const gainPassifDe = (l: Ligne) => gainPassifDeLigne(l, donneesKit);
  const ampliDe = (camp: Camp) => ampliDeLignes(lignes, camp, donneesKit);
  const combatDe = (l: Ligne) => combatDeLigne(l, leadDeCamp(leads, l.camp), donneesKit);

  const lignesVisibles = useMemo(() => visibles(lignes), [lignes]);

  // Le sort qu'un monstre lance à son tour. Hors analyse poussée (ou sans choix
  // explicite), c'est celui que la lecture du kit a retenu ; en analyse poussée,
  // celui qu'on lui a désigné — '' voulant dire « il ne lance rien de tout ça ».
  const choixSorts = useMemo(
    () => ({ sort: sortChoisi, sort2: sortChoisi2, cible: cibleSort }),
    [sortChoisi, sortChoisi2, cibleSort]
  );
  const sortsDe = (l: Ligne) => sortsDeLigne(l, donneesKit);
  const sortActif = (l: Ligne, choix: Record<string, string> = sortChoisi) =>
    sortActifDe(l, donneesKit, { ...choixSorts, sort: choix });
  const sortAuto = (l: Ligne) => sortRetenu(entreeDe(l), donneesKit);
  const sortSecond = (l: Ligne) => sortSecondDe(l, donneesKit, choixSorts);

  // ⚠️ L'entrée du moteur vient de la LIB (`tuneDe`) : elle a été écrite deux
  // fois dans ce fichier, et les deux versions ont divergé.
  const tune = useMemo(
    () => tuneDe(lignes, leads, donneesKit, choixSorts),
    [lignes, leadAllie, leadEnnemi, donneesKit, choixSorts]
  );

  // Simulation multi-tours (40 ticks) avec les modificateurs.
  const sim = useMemo(() => simuler(tune, HORIZON_TICKS), [tune]);

  // L'ANALYSE : elle lit les kits, puis POSE le résultat dans les grilles, comme
  // si on les avait remplies à la main. Après quoi elle ne repasse plus.
  //
  // ⚠️ **Tout le calcul vient de `analyseAutomatique`** (lib/speedTuneAuto.ts),
  // celui-là même qu'utilise la card de siège. L'écran avait sa propre pipeline :
  // deux chemins pour une même question, et ils ont fini par se contredire — une
  // équipe déclarée « pas speed tune » au siège et « speed tune » dans l'outil.
  // Un seul calcul, une seule réponse.
  function analyser() {
    // ⚠️ **L'analyse remplit AUSSI l'ordre des sorts** : elle y pose l'ordre que
    // les vitesses produisent et, pour chacun, le sort que son kit a retenu.
    // Un sort déjà CHOISI n'est jamais réécrit (sinon le choix se
    // réinitialiserait sous les doigts, la relance étant déclenchée par le
    // changement lui-même) ; une chaîne vide est un choix, pas une absence.
    //
    // ⚠️ **L'adversaire de RÉFÉRENCE est écarté** : dans la lib il ne lance
    // rien — c'est un repère de vitesse, pas un monstre qui joue son kit. Lui
    // donner un sort ici aurait suffi à faire diverger les deux écrans.
    const choix: Record<string, string> = { ...sortChoisi };
    for (const l of lignesVisibles) {
      if (l.reference || choix[l.uid] !== undefined) continue;
      const detecte = sortAuto(l);
      if (detecte) choix[l.uid] = detecte.nom;
    }
    setSortChoisi(choix);

    const allies = lignesVisibles.filter((l) => l.camp === 'allie');
    // ⚠️ **Les sorts DÉSIGNÉS passent à l'analyse**, et l'adversaire de référence
    // porte l'identifiant de SA ligne : sans ça, ce que l'analyse lui écrivait
    // n'atterrissait nulle part, et la grille montrait autre chose que ce qui
    // était calculé. Un modificateur invisible mais appliqué est la pire erreur
    // possible ici — on ne peut plus vérifier un seul chiffre de l'écran.
    const modele = plusRapideAllie();
    const uidRef = modele ? uidDe('ennemi', String(modele.monster.id)) : undefined;
    const resultat = analyseAutomatique(allies.map(entreeDe), leadAllie, donneesKit, {
      choix: { sort: choix, sort2: sortChoisi2, cible: cibleSort },
      idReference: uidRef,
    });

    if (!ordreRange) {
      const parVitesse = resultat.ordre.map((a) => a.id);
      const ids = allies.map((l) => l.uid);
      setOrdreVoulu([
        ...parVitesse.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !parVitesse.includes(id)),
      ]);
    }
    // Ce qu'on vient d'écrire ne doit pas déclencher une relance en boucle.
    premiereSignature.current = JSON.stringify([choix, sortChoisi2]);

    setAuto(true);
    setLignes((prev) =>
      prev.map((l) => {
        const mods = resultat.mods.get(l.uid);
        return mods ? { ...l, atbMod: mods.atbMod, speedMod: mods.speedMod } : l;
      })
    );

    // ⚠️ **L'adversaire de référence est REPOSÉ à chaque analyse**, sur le plus
    // rapide du MOMENT : un passif appliqué (Chilling, +20 par buff) change qui
    // l'est, et une référence figée comparait l'équipe à un monstre qui ne
    // l'était plus. Un VRAI adversaire, lui, n'est jamais remplacé — c'est une
    // composition qu'on affronte, pas un repère.
    const vraiEnnemi = lignesVisibles.some((l) => l.camp === 'ennemi' && !l.reference);
    if (!vraiEnnemi || toujoursReference) analyseAuto(resultat.mods.get(uidRef ?? ''));
  }

  // ⚠️ Le SEUL changement qui rende une analyse fausse : le sort lancé. Tout le
  // reste (vitesses, artéfacts, cases des grilles) est un réglage de
  // l'utilisateur, et l'automatisation n'y revient jamais.
  const sortsSignature = JSON.stringify([sortChoisi, sortChoisi2]);
  const premiereSignature = useRef(sortsSignature);
  useEffect(() => {
    if (!auto || premiereSignature.current === sortsSignature) {
      premiereSignature.current = sortsSignature;
      return;
    }
    premiereSignature.current = sortsSignature;
    analyser();
  }, [sortsSignature, auto]);

  // Chaîne d'ouverture : toute l'équipe joue-t-elle avant le premier adverse ?
  // Et sinon, quelle vitesse de combat faut-il à ceux qui sont coupés.
  const chaine = useMemo(() => diagnostiquerChaine(tune, HORIZON_TICKS), [tune]);
  const requis = useMemo(
    () => (chaine.ok ? [] : vitessesRequises(tune, HORIZON_TICKS)),
    [tune, chaine]
  );
  // L'AUTRE levier quand un buff de vitesse est en jeu : monter l'artéfact
  // « Effet aug. VIT », qui l'amplifie. Vide s'il n'y a rien à en attendre.
  const arteRequis = useMemo(
    () => (chaine.ok ? [] : artefactsRequis(tune, HORIZON_TICKS)),
    [tune, chaine]
  );

  // Premiers tours (ordre de tour) et numéro d'action par (monstre, tick).
  const premiers = useMemo(() => premiersTours(sim), [sim]);
  const numAction = useMemo(() => {
    const m = new Map<string, number>();
    // ⚠️ Un tour RENDU tombe au même tick que celui qui l'a déclenché : on garde
    // le premier, c'est lui que la case du tableau annonce.
    for (const a of sim.actions) {
      const cle = `${a.id}@${a.tick}`;
      if (!m.has(cle)) m.set(cle, a.ordre);
    }
    return m;
  }, [sim]);

  // Lignes du tableau des barres, triées par ordre de PREMIER tour (celles qui
  // n'agissent jamais en fin de liste), pour lire l'enchaînement de haut en bas.
  const lignesTableau = useMemo(() => {
    const rang = new Map(premiers.map((a, i) => [a.id, i]));
    return [...sim.lignes].sort(
      (a, b) => (rang.get(a.id) ?? Infinity) - (rang.get(b.id) ?? Infinity)
    );
  }, [sim, premiers]);

  const ligneParUid = useMemo(() => new Map(lignes.map((l) => [l.uid, l])), [lignes]);

  // L'ordre voulu suit la composition : un allié ajouté entre à la fin, un allié
  // retiré en sort. ⚠️ Il n'est PAS réordonné tout seul ensuite — c'est le choix
  // de l'utilisateur, pas un reflet de la simulation.
  const alliesVisibles = useMemo(
    () => lignesVisibles.filter((l) => l.camp === 'allie').map((l) => l.uid),
    [lignesVisibles]
  );
  useEffect(() => {
    if (!ordreRange) {
      // Ordre des vitesses : celui que la simulation produit aujourd'hui, les
      // alliés qui n'agissent pas (vitesse inconnue) à la fin.
      const parVitesse = premiers.filter((a) => a.camp === 'allie').map((a) => a.id);
      const attendu = [
        ...parVitesse.filter((id) => alliesVisibles.includes(id)),
        ...alliesVisibles.filter((id) => !parVitesse.includes(id)),
      ];
      if (attendu.join('|') !== ordreVoulu.join('|')) setOrdreVoulu(attendu);
      return;
    }
    const garde = ordreVoulu.filter((id) => alliesVisibles.includes(id));
    const manquants = alliesVisibles.filter((id) => !garde.includes(id));
    if (manquants.length === 0 && garde.length === ordreVoulu.length) return;
    setOrdreVoulu([...garde, ...manquants]);
  }, [alliesVisibles, ordreVoulu, setOrdreVoulu, ordreRange, premiers]);

  // Verdict de l'analyse poussée : l'ordre est-il tenu, et quelle FENÊTRE de
  // vitesse laisse chaque rang (un rang se rate aussi en étant trop rapide).
  const sequence = useMemo(
    () => diagnostiquerSequence(tune, ordreVoulu, HORIZON_TICKS),
    [tune, ordreVoulu]
  );
  const fenetres = useMemo(
    () => fenetresRequises(tune, ordreVoulu, HORIZON_TICKS),
    [tune, ordreVoulu]
  );
  // Le même calcul sur l'autre levier : l'artéfact qui amplifie le buff reçu.
  const fenetresArte = useMemo(
    () => fenetresRequises(tune, ordreVoulu, HORIZON_TICKS, 'artefactBuff'),
    [tune, ordreVoulu]
  );
  const fenetreParUid = useMemo(() => new Map(fenetres.map((f) => [f.id, f])), [fenetres]);
  const fenetreArteParUid = useMemo(() => new Map(fenetresArte.map((f) => [f.id, f])), [fenetresArte]);
  const problemeParUid = useMemo(
    () => new Map(sequence.problemes.map((p) => [p.id, p])),
    [sequence]
  );

  // Ce qu'il manque à un monstre, en une pastille : les points de vitesse de
  // runes, ou — si un buff de vitesse court sur son camp — les points d'artéfact
  // « Effet aug. VIT » qui feraient la même chose. Rien d'autre.
  function cibleFenetre(f: Fenetre | undefined): number | null | undefined {
    if (!f) return undefined;
    if (f.min == null || f.max == null || f.min > f.max) return undefined;
    if (f.combatActuel < f.min) return f.min;
    if (f.combatActuel > f.max) return f.max;
    return null;
  }

  function choisirSort(uid: string, valeur: string) {
    setSortChoisi((prev) => {
      const next = { ...prev };
      if (valeur === '__auto') delete next[uid];
      else next[uid] = valeur;
      return next;
    });
  }

  // L'allié visé par un sort mono-cible. '' = le défaut (barre la plus basse).
  function choisirCible(uid: string, valeur: string) {
    setCibleSort((prev) => ({ ...prev, [uid]: valeur }));
  }

  function choisirSecond(uid: string, valeur: string) {
    setSortChoisi2((prev) => {
      const next = { ...prev };
      if (valeur === '') delete next[uid];
      else next[uid] = valeur;
      return next;
    });
  }

  function deplacer(uid: string, sens: -1 | 1) {
    setOrdreRange(true); // à partir d'ici, l'ordre est un CHOIX : il ne suit plus les vitesses
    setOrdreVoulu((prev) => {
      const i = prev.indexOf(uid);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const requisParUid = useMemo(() => new Map(requis.map((r) => [r.id, r])), [requis]);
  const arteParUid = useMemo(() => new Map(arteRequis.map((r) => [r.id, r])), [arteRequis]);

  // Regroupement par tick NATUREL (vitesse seule, sans modificateur) pour poser
  // le portrait dans la case du repère qui correspond à la vitesse du monstre.
  const parTick = useMemo(() => {
    const map = new Map<number, Ligne[]>();
    for (const l of lignesVisibles) {
      const c = combatDe(l);
      if (c == null || c <= 0) continue;
      const n = Math.ceil(10000 / (7 * c));
      (map.get(n) ?? map.set(n, []).get(n)!).push(l);
    }
    return map;
  }, [lignes, leadAllie, leadEnnemi]);

  const rien = lignes.length === 0;
  const rienVisible = lignesVisibles.length === 0;
  // Grilles et repère ne comptent que les visibles.
  const aAllie = lignesVisibles.some((l) => l.camp === 'allie');
  const aEnnemi = lignesVisibles.some((l) => l.camp === 'ennemi');

  const nomDe = (uid: string) => ligneParUid.get(uid)?.monster.name ?? '?';
  // Vitesse de runes qu'il MANQUE pour atteindre une vitesse de combat cible.
  const runesPour = (l: Ligne, combatCible: number): number | null => {
    const besoin = runeSpeedForTarget(l.monster.stats.speed, leadDe(l.camp), combatCible, false);
    return besoin == null ? null : besoin - (l.runeSpeed ?? 0);
  };


  return {
    aAllie,
    aEnnemi,
    nomDe,
    parTick,
    rien,
    rienVisible,
    runesPour,
    ajouter,
    alliesVisibles,
    ampliDe,
    analyseAuto,
    analyser,
    arrivee,
    arteParUid,
    arteRequis,
    auto,
    basculerMasque,
    basculerPassif,
    basculerSwift,
    chaine,
    choisirCible,
    choisirSecond,
    choisirSort,
    choixSorts,
    cibleFenetre,
    cibleSort,
    combatDe,
    decks,
    deplacer,
    donneesKit,
    entreeDe,
    fenetreArteParUid,
    fenetreParUid,
    fenetres,
    fenetresArte,
    gainPassifDe,
    importerDeck,
    jouables,
    kits,
    leadAllie,
    leadDe,
    leadEnnemi,
    leads,
    ligneParUid,
    ligneReference,
    lignes,
    lignesTableau,
    lignesVisibles,
    monsterById,
    montrerAnalyse,
    numAction,
    ordreRange,
    ordreVoulu,
    passifActifDe,
    passifDe,
    passifs,
    plusRapideAllie,
    poussee,
    premiereSignature,
    premiers,
    problemeParUid,
    requis,
    requisParUid,
    retirer,
    sequence,
    setArtefact,
    setAuto,
    setCibleSort,
    setCumuls,
    setKits,
    setLeadAllie,
    setLeadEnnemi,
    setLignes,
    setMod,
    setModEquipe,
    setMontrerAnalyse,
    setOrdreRange,
    setOrdreVoulu,
    setPassifs,
    setPoussee,
    setRuneSpeed,
    setSortChoisi,
    setSortChoisi2,
    setSorts,
    sim,
    sortActif,
    sortAuto,
    sortChoisi,
    sortChoisi2,
    sortSecond,
    sorts,
    sortsDe,
    sortsSignature,
    toujoursReference,
    tune,
  };
}
