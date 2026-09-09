// L'INSTANT DE DÉCOUVERTE et la COURBE DE RENDEMENT — §5.6 des extensions.
//
// ⚠️ **Ce que ce test défend n'est pas une valeur, c'est une DISTINCTION.**
// L'instant de découverte (quand la cible est apparue dans le flux) et le
// rang (`sortCandidates`, un état FINAL) sont deux grandeurs indépendantes,
// et les confondre est l'erreur exacte que cette extension existe pour
// rendre impossible. Le profil `complet-sensible` en donne la démonstration
// permanente : sa cible est découverte à ~0,02 % de l'espace et sort au
// rang #1 424 — un build trouvé très tôt, classé très loin.
//
// ⚠️ Le second sujet est la HONNÊTETÉ de la courbe : un jalon jamais atteint
// doit se DIRE, jamais se remplir avec la dernière valeur connue. Sans ça,
// `quota-parallele` — tronqué à 0,006 % de son espace — afficherait une
// ligne plate qu'on lirait « la collecte a saturé » alors qu'elle n'a pas
// commencé. Même famille que `NON_COMPARABLE` au §5.2 ter.
//
// ⚠️ `algo-verify` ne s'y applique pas, même doctrine que
// `diagnostic-profils.test.ts` : c'est de l'OUTILLAGE, et ce qui est en jeu
// est la fidélité de ce que le harnais rapporte, pas la justesse d'un
// algorithme.

import { egal, ok, titre } from './outils';
import { executerHarnais } from '../scripts/lib/diagnosticHarness';
import { JALONS_RENDEMENT } from '../scripts/lib/diagnosticHarness';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';

export default async function testDiagnosticDecouverte() {
  titre('Harnais — instant de découverte et courbe de rendement (§5.6)');

  // ── Un profil COMPLET et SÉQUENTIEL : le seul régime où la grandeur est
  // reproductible, donc le seul sur lequel on a le droit de figer une valeur.
  const profil = trouverProfil('complet-sensible');
  const r = await executerHarnais(configDuProfil(profil));

  const d = r.decouverteBuildCible;
  ok(d != null, 'la découverte est rendue dès que `suivre` porte les SIX identifiants');
  if (!d) return;

  ok(d.exploredALaDecouverte != null, 'la cible a été vue pendant l’appariement');
  egal(d.regime, 'sequentiel', 'régime séquentiel — le seul reproductible sur cette grandeur');
  ok(d.reproductible, 'un run séquentiel se déclare REPRODUCTIBLE');
  ok(d.granularitePaires != null, 'la granularité est un nombre de PAIRES en séquentiel, jamais nulle');
  ok(d.absente == null, 'aucun motif d’absence quand la cible a été trouvée');

  // ⚠️ **LE cœur du test.** Découverte tôt, classée loin : si ces deux
  // nombres se mettaient un jour à coïncider, c'est que l'un des deux aurait
  // cessé de mesurer ce qu'il annonce.
  const rang = r.appariementBuildCible?.rang;
  ok(rang != null, 'le rang est rendu à côté, pour que la distinction soit lisible');
  if (rang && d.fractionExploree != null) {
    ok(
      d.fractionExploree < 0.01,
      `la cible est découverte TÔT — ${(d.fractionExploree * 100).toFixed(3)} % de l’espace`
    );
    ok(
      rang.rang > 1000,
      `…et pourtant classée LOIN — #${rang.rang}. Instant de découverte et rang sont INDÉPENDANTS`
    );
  }

  // ── La courbe : les sept jalons, toujours, dans l'ordre.
  egal(d.jalons.length, JALONS_RENDEMENT.length, 'les SEPT jalons sont rendus, jamais un de moins');
  for (let i = 0; i < JALONS_RENDEMENT.length; i++) {
    egal(d.jalons[i].jalonPct, JALONS_RENDEMENT[i], `jalon ${i} — dans l’ordre croissant`);
  }
  ok(
    d.jalons.every((j) => j.atteint),
    'sur un run COMPLET, les sept jalons sont réellement ATTEINTS'
  );
  // Une courbe de rendement est CUMULATIVE : elle ne peut pas décroître.
  for (let i = 1; i < d.jalons.length; i++) {
    ok(
      d.jalons[i].candidats >= d.jalons[i - 1].candidats,
      `la courbe est cumulative — ${d.jalons[i - 1].candidats} → ${d.jalons[i].candidats}`
    );
  }

  // ── Le run TRONQUÉ : ce qui n'a pas été observé se DIT.
  const tronque = trouverProfil('quota-parallele');
  const rt = await executerHarnais(configDuProfil(tronque));
  const dt = rt.decouverteBuildCible;
  ok(dt != null, 'la découverte est rendue aussi en régime parallèle');
  if (!dt) return;

  egal(dt.regime, 'parallele', 'régime parallèle');
  // ⚠️ Ce n'est PAS un défaut du harnais : `explored` y est la somme des
  // workers à l'instant d'un relevé TEMPOREL, et l'ordre d'arrivée des
  // candidats dépend de l'ordonnancement des fils. Le masquer serait le
  // mensonge que tout ce chantier combat.
  ok(!dt.reproductible, 'un run parallèle se déclare NON REPRODUCTIBLE sur cette grandeur');
  egal(dt.granularitePaires, null, 'en parallèle la granularité est TEMPORELLE, donc pas un nombre de paires');
  ok(
    dt.jalons.some((j) => !j.atteint),
    'un run tronqué très tôt laisse des jalons NON ATTEINTS'
  );
  ok(
    dt.jalons.filter((j) => !j.atteint).every((j) => j.candidats >= 0),
    'un jalon non atteint porte quand même son dernier état connu — c’est le drapeau qui le qualifie, pas une valeur absente'
  );

  // ⚠️ L'avertissement PART TOUJOURS avec la valeur — même doctrine que
  // `coutInstrumentation` (A₂) et `perimetrePreparation` : rangé dans une
  // spec, il serait lu une fois et perdu ; porté par la valeur, il voyage
  // avec chaque `--json` collé dans une conversation.
  for (const [nom, v] of [['complet-sensible', d], ['quota-parallele', dt]] as const) {
    ok(v.avertissement.length > 0, `${nom} — la valeur part avec son avertissement, jamais nue`);
    ok(
      v.avertissement.includes('jamais son rang'),
      `${nom} — l’avertissement dit explicitement que ce n’est PAS un rang`
    );
  }
}
