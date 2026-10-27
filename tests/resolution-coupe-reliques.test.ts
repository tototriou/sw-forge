// Coupe des reliques de la résolution rapide (src/lib/resolutionRapide.ts,
// en-tête) : en régime Dégâts réels, relique `recherche`, une relique dont la
// borne (note avec le profil idéal de la file) est sous la meilleure note
// déjà trouvée n'a aucune paire notée.
//
// ⚠️ **Repose sur la règle de jeu R**, confirmée par l'utilisateur le
// 2026-10-27 et non relevée en jeu : les dégâts ne baissent jamais quand ATQ,
// PV, DEF ou une ligne d'artéfact augmente. Le test ne la prouve pas ; il
// vérifie que le CODE la suit sur ses fixtures (aucune paire ne note au-dessus
// de la borne de sa relique) et que la coupe ne change rien au choix.
//
// Référence de contrôle (`algo-verify`) : la résolution rapide SANS la coupe
// (`sansCoupe`), elle-même comparée au calcul exhaustif par
// `tests/resolution-rapide.test.ts`. Pools générés à graine fixe, mêmes
// générateurs que ce test-là ; reliques nombreuses (principales et effets
// uniques variés, doublons de principale) pour que des bornes coupent ;
// artéfacts libres, principale imposée, lignes verrouillées avec et sans coût
// des verrous ; avec et sans maximums ; deux ordres de traitement (caches de
// la file partagés).

import { isDeepStrictEqual } from 'node:util';
import { ArtifactDetail, RuneDetail } from '../src/types';
import { BuildRequirement } from '../src/lib/runeBuildOptim';
import { RelicContext, resoudreContexteRelique } from '../src/lib/relicOptim';
import { ArtifactSearchParams, LigneVerrouillee, candidatsParSorte } from '../src/lib/artifactOptim';
import { artifactPairAllowed } from '../src/lib/artifacts';
import { CachesResolution, EntreeResolution, entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { compteursVides, resoudreEquipementDuBuildRapide } from '../src/lib/resolutionRapide';
import { mulberry32 } from '../scripts/lib/randomPool';
import { BASE, DEGATS, EXCLUSIVE, PORTEUR, build, inventaire, reliques, resoudre, total } from './resolution-rapide.test';
import { egal, ok, titre } from './outils';

const ARTEFACTS = ['libre', 'principale', 'verrous', 'cout-verrous'] as const;

export default function testResolutionCoupeReliques() {
  titre('Résolution rapide — coupe des reliques par leur borne (règle de jeu R, confirmée par l’utilisateur) : même choix que sans coupe');
  const avec = compteursVides();
  const sans = compteursVides();
  const ecarts: string[] = [];
  let compares = 0;
  let conformes = 0;
  let rejetes = 0;
  // La règle R vue par le code : paires notées au-dessus de la borne de leur relique.
  let pairesJugees = 0;
  const violations: string[] = [];

  ARTEFACTS.forEach((artefacts, iA) => {
    for (const maximums of [false, true]) {
      const rng = mulberry32(3900 + 10 * iA + (maximums ? 1 : 0));
      const inv = inventaire(rng, 7);
      // Des reliques proches des autres, pour que la coupe se joue à peu : la
      // même à principale −1 (note juste en dessous), et pour chacune un ex
      // æquo exact d'`id` plus PETITE, placé APRÈS elle — notée en second à
      // borne égale, c'est elle que le départage retient : la couper à tort
      // changerait le choix. Quelques ex æquo d'`id` plus grande aussi.
      const base = reliques(rng, 7);
      const reliquesInv = [
        ...base,
        ...base.map((r, k) => ({ ...r, id: 20_000 + k, main: { ...r.main, value: r.main.value - 1 } })),
        ...base.map((r, k) => ({ ...r, id: 1 + k })),
        ...base.slice(0, 3).map((r, k) => ({ ...r, id: 30_000 + k })),
      ];
      const portee = reliquesInv[Math.floor(rng() * reliquesInv.length)]!;
      const builds = Array.from({ length: 16 }, (_, i) => build(rng, 100 * i));
      const mediane = (k: string) => builds.map((b) => total(b, k)).sort((a, b) => a - b)[Math.floor(builds.length / 2)]!;
      const requirement: BuildRequirement = {
        sets: [],
        minStats: { hp: Math.round(mediane('hp') * (1 + 0.05 * rng())), atk: Math.round(mediane('atk') * (0.95 + 0.1 * rng())) },
        maxStats: maximums ? { atk: Math.round(mediane('atk') * 1.3), hp: Math.round(mediane('hp') * 1.45) } : {},
        auraResPre: { res: 0, acc: 0, compter: true },
      };
      const lignes: LigneVerrouillee[] = artefacts === 'verrous' || artefacts === 'cout-verrous'
        ? [{ code: inv.find((a) => a.kind === 'archetype')!.subs[0]!.code, min: 1 }]
        : [];
      const artifactParams: Omit<ArtifactSearchParams, 'evaluer'> = {
        porteur: PORTEUR, inventaire: inv, equipes: [], principaleParSorte: artefacts === 'principale' ? { archetype: 101 } : {},
        lignesVerrouillees: lignes, maxStatsActifs: maximums ? ['atk', 'hp'] : [],
        ...(artefacts === 'cout-verrous' ? { avecCoutDesVerrous: true } : {}),
      };
      const ctx: RelicContext = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, portee, reliquesInv);
      const entree = (runes: RuneDetail[], caches: CachesResolution | null): EntreeResolution => entreeResolutionDuBuild({
        fiche: { base: BASE, runes: [], artifacts: [], relic: portee }, runes, artifactParams, regime: 'degats_reels', degats: DEGATS,
        exclusive: EXCLUSIVE, requirement, relicContext: ctx, caches,
      });
      const nom = `${artefacts}${maximums ? ' · maximums' : ''}`;

      // R vue par le code : chaque paire autorisée de chaque relique éligible
      // note au plus la borne de cette relique (profil idéal de la file).
      for (const runes of builds.slice(0, 6)) {
        const e = entree(runes, null);
        const ideal = nouveauxCachesResolution().rapide.profilIdeal(e.faireParams(ctx.eligibles[0]));
        for (const relique of ctx.eligibles) {
          const params = e.faireParams(relique);
          const borne = params.evaluer(ideal);
          for (const el of candidatsParSorte(params, 'element')) {
            for (const ar of candidatsParSorte(params, 'archetype')) {
              if (!artifactPairAllowed(el, ar)) continue;
              const note = params.evaluer([el, ar].filter((a): a is ArtifactDetail => a != null));
              pairesJugees++;
              if (!(note <= borne)) violations.push(`${nom} · relique ${relique.id} · paire ${el?.id ?? '-'}/${ar?.id ?? '-'} : ${note} > borne ${borne}`);
            }
          }
        }
      }

      // Le choix, avec et sans la coupe, caches de la file partagés, deux ordres.
      for (const ordre of [builds.map((_, i) => i), builds.map((_, i) => builds.length - 1 - i)]) {
        const cachesAvec = nouveauxCachesResolution();
        const cachesSans = nouveauxCachesResolution();
        for (const i of ordre) {
          for (const diagnostic of [false, true]) {
            const reference = resoudre(() => resoudreEquipementDuBuildRapide(entree(builds[i]!, cachesSans), sans, { diagnostic, sansCoupe: true }));
            const coupe = resoudre(() => resoudreEquipementDuBuildRapide(entree(builds[i]!, cachesAvec), avec, { diagnostic }));
            compares++;
            if ('r' in reference) {
              if (reference.r.conforme) conformes++;
              else rejetes++;
            }
            if (!isDeepStrictEqual(coupe, reference)) ecarts.push(`${nom} · build ${i}${diagnostic ? ' (diagnostic)' : ''} : ${JSON.stringify(coupe).slice(0, 160)} ≠ ${JSON.stringify(reference).slice(0, 160)}`);
          }
          // Le point d'entrée de l'app coupe aussi.
          const app = resoudre(() => resoudreEquipementDuBuild(entree(builds[i]!, cachesAvec)));
          const reference = resoudre(() => resoudreEquipementDuBuildRapide(entree(builds[i]!, cachesSans), undefined, { sansCoupe: true }));
          compares++;
          if (!isDeepStrictEqual(app, reference)) ecarts.push(`${nom} · build ${i} (point d’entrée) : ${JSON.stringify(app).slice(0, 160)}`);
        }
      }
    }
  });

  // ── Borne ATTEINTE : une pièce par sorte, la paire idéale existe. Chaque
  // relique a un ex æquo exact d'`id` plus petite placé après elle : à borne
  // égale à la meilleure note, il se note (inégalité stricte) et le
  // départage le retient. ──
  let bornesAtteintes = 0;
  let exAequoRetenus = 0;
  {
    const rng = mulberry32(3999);
    const inv = inventaire(rng, 7).filter((a) => !a.intangible);
    const paire = [inv.find((a) => a.kind === 'element')!, inv.find((a) => a.kind === 'archetype')!];
    const base = reliques(rng, 6);
    const clones = base.map((r, k) => ({ ...r, id: 1 + k }));
    const ctx = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, base[0], [...base, ...clones]);
    const artifactParams: Omit<ArtifactSearchParams, 'evaluer'> = {
      porteur: PORTEUR, inventaire: paire, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: [],
    };
    const requirement: BuildRequirement = { sets: [], minStats: {}, maxStats: {}, auraResPre: { res: 0, acc: 0, compter: true } };
    for (let i = 0; i < 12; i++) {
      const runes = build(rng, 100 * i);
      const entree = (caches: CachesResolution | null) => entreeResolutionDuBuild({
        fiche: { base: BASE, runes: [], artifacts: [], relic: base[0] }, runes, artifactParams, regime: 'degats_reels', degats: DEGATS,
        exclusive: EXCLUSIVE, requirement, relicContext: ctx, caches,
      });
      const reference = resoudre(() => resoudreEquipementDuBuildRapide(entree(null), sans, { sansCoupe: true }));
      const coupe = resoudre(() => resoudreEquipementDuBuildRapide(entree(nouveauxCachesResolution()), avec));
      compares++;
      if (!isDeepStrictEqual(coupe, reference)) ecarts.push(`borne atteinte · build ${i} : ${JSON.stringify(coupe).slice(0, 160)}`);
      if ('r' in reference && reference.r.relique && reference.r.paire) {
        const e = entree(null);
        const borne = e.faireParams(reference.r.relique).evaluer(nouveauxCachesResolution().rapide.profilIdeal(e.faireParams(base[0])));
        if (borne === reference.r.paire.score) bornesAtteintes++;
        if (reference.r.relique.id <= clones.length) exAequoRetenus++;
      }
    }
  }

  egal(violations.slice(0, 5), [], `règle R suivie par le code sur les fixtures : ${pairesJugees} paires, aucune note au-dessus de la borne de sa relique`);
  ok(bornesAtteintes > 0 && exAequoRetenus > 0, `borne atteinte (une pièce par sorte) : la note retenue égale sa borne sur ${bornesAtteintes} builds, l'ex æquo d'id plus petite noté en second retenu sur ${exAequoRetenus}`);
  egal(ecarts.slice(0, 5), [], `${compares} résolutions (sans et avec diagnostic, point d’entrée de l’app, deux ordres) : avec la coupe = sans la coupe, champ pour champ`);
  ok(conformes > 30 && rejetes > 10, `des builds conformes (${conformes}) et rejetés (${rejetes})`);
  ok(avec.reliquesCoupees > 0, `des reliques coupées sans aucune paire notée : ${avec.reliquesCoupees} sur ${avec.reliques} jugées (${avec.bornes} bornes)`);
  egal(sans.reliquesCoupees + sans.bornes, 0, 'sans la coupe : aucune borne, aucune relique coupée');
  ok(avec.notesFaisables < sans.notesFaisables, `moins de paires notées : ${avec.notesFaisables} contre ${sans.notesFaisables}`);
  ok(avec.noteesEntieres > 0, `coût des verrous exercé avec la coupe : ${avec.noteesEntieres} reliques notées entières`);
}
