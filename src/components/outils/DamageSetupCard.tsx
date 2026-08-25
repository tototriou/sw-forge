import { Dispatch, SetStateAction } from 'react';
import { Check } from 'lucide-react';
import {
  ATK_BUFF_ICON,
  BRAND_ICON,
  BonusDegatsConditionnelProfile,
  BonusDegatsStackableProfile,
  CRIT_MODE_LABELS,
  CritMode,
  DamageSetup,
  DamageVariable,
  DEFAULT_DAMAGE_SETUP,
  DEBORAH_ICON,
  DEF_BREAK_ICON,
  DEF_BUFF_ICON,
  EULDONG_ICON,
  LEADER_SKILL_PRESETS,
  LeaderSkillStat,
  MIRIAM_ICON,
  MIRINAE_ICON,
  ModificateurVitAffichage,
  PassifOffensifProfile,
  SPD_BUFF_ICON,
  SUMMONER_SKILLS_LABELS,
  SkillDamageProfile,
  SkillDamageUnsupported,
  SummonerSkills,
  TRANSMISSION_ICON,
  VELASKA_ICON,
  bonusDegatsConditionnelActif,
  estPrisEnCharge,
  passifActif,
  resolvedHits,
  resolvedStackPct,
} from '../../lib/damage';
import { formuleLisible } from '../../lib/monsterSkills';
import { leadIconUrl, STAT_LABEL } from '../siege/LeadPill';
import Jeton from '../../ui/Jeton';
import NumberField from '../../ui/NumberField';
import Option from '../../ui/Option';
import Pastille from '../../ui/Pastille';
import Segmented from '../../ui/Segmented';
import Selecteur from '../../ui/Selecteur';
import Vignette from '../../ui/Vignette';
import HelpPopover from '../HelpPopover';

// Réglage de l'objectif « Dégâts réels » — voir spec/outils/degats-reels.md
// pour le modèle de calcul, spec/outils/optimizer.md pour sa place à l'écran.
//
// ⚠️ **Deux principes portent toute la mise en page de ce panneau :**
//
// 1. **Ce que les données savent n'est jamais redemandé** — il est AFFICHÉ.
//    Le résumé sous chaque sort (« 3 coups · Zone · Ignore la DEF · +30 % »)
//    n'est pas décoratif : c'est ce qui dit à l'utilisateur pourquoi on ne
//    lui pose pas la question.
// 2. **On n'affiche que les réglages que le sort CONSOMME.** Un sort qui
//    ignore la défense ne montre ni la DEF ennemie ni la réduction de
//    défense ; un sort qui ne dépend pas de la VIT ne montre pas le buff de
//    vitesse. Un champ visible mais sans effet est pire qu'un champ absent —
//    il fait croire à une action.
//
// ⚠️ Aucun contrôle dessiné ici : tout vient de `src/ui/` (« rien de
// custom », voir spec/shared/design.md). Les icônes (sort, effets) sont des
// DONNÉES affichées dedans, pas des contrôles maison — même rendu que la
// fiche de monstre (MonsterDetailDialog.tsx). Les effets se choisissent via
// `Vignette` (la case sélectionnable de la librairie, déjà utilisée pour la
// palette de couleurs de catégorie RTA) : l'icône EST le contrôle, avec le
// même liseré + fond teinté qu'une catégorie choisie — pas une case à cocher
// séparée à côté d'une icône décorative.

interface Props {
  skills: (SkillDamageProfile | SkillDamageUnsupported)[];
  // Le sort réellement retenu (`resolveDamageSkill`) — `null` si aucun n'est
  // calculable pour ce monstre.
  resolved: SkillDamageProfile | null;
  // Passifs offensifs de ce monstre reconnus (`monsterOffensivePassives`,
  // damage.ts) — indépendants du sort choisi, voir la section dédiée
  // plus bas. Vide = rien à afficher (la plupart des monstres).
  passifs: PassifOffensifProfile[];
  // Modificateurs monstre-wide liés à la VIT SANS formule propre
  // (`monsterModificateursVit`, damage.ts — Ciri Eau, Rigna, Sonia…),
  // affichés dans la MÊME liste que `passifs` — corrige un oubli signalé
  // par l'utilisateur (Sonia/Ciri absentes, contrairement à Feng Yan/Dominic).
  modificateursVit: ModificateurVitAffichage[];
  setup: DamageSetup;
  setSetup: Dispatch<SetStateAction<DamageSetup>>;
  // `true` tant que la fiche du monstre n'est pas arrivée.
  chargement: boolean;
  etroit: boolean;
  // Ce monstre force-t-il le critique quand il est plus rapide que
  // l'adversaire (`monsterCritSiPlusRapide`, damage.ts) ? Indépendant du
  // sort choisi — décide, avec `utilise('Relative SPD')`, si le champ
  // « VIT adversaire » doit apparaître (un sort qui ne lit pas cette
  // variable peut quand même avoir BESOIN de la VIT adverse si ce
  // modificateur existe).
  critSiPlusRapide: boolean;
  // Ce monstre majore-t-il TOUS ses dégâts selon l'écart de VIT (Sonia —
  // `monsterBonusDegatsSelonVit`, damage.ts) ? Même rôle que
  // `critSiPlusRapide` pour l'affichage des champs liés à la VIT — `null` =
  // aucun effet.
  bonusDegatsSelonVit: { ecartMax: number; pctMax: number } | null;
  // Ce monstre porte-t-il un bonus de dégâts ACCUMULABLE en combat (Momo —
  // `monsterBonusDegatsStackable`, damage.ts) ? Le POURCENTAGE actuel, lui,
  // est saisi ici même (`setup.stackPersonnalise`) — `null` = pas ce passif.
  bonusDegatsStack: BonusDegatsStackableProfile | null;
  // Ciri (Feu)/MOS (Feu)/Reyka — Taux Crit selon la VIT
  // (`monsterCritRateSelonVit`, damage.ts). S'affiche via `modificateursVit`
  // (étendu côté damage.ts) — présent ici pour la même raison que
  // `critSiPlusRapide`/`bonusDegatsSelonVit` : décider si le bouton
  // « Buff VIT » doit apparaître même quand le sort choisi ne lit ni {SPD}
  // ni {Relative SPD} (le Taux Crit, lui, en dépend quand même).
  critRateSelonVit: { ptsParVit: number } | null;
  // Bonus conditionnel à bouton (Jin Kazama, Cyborg, Brownie Magician,
  // Astar, Jean, Kyle, Satoru Gojo, Werner, Zenitsu, Qilin Slasher, Panda
  // Warrior, Mi Ying…) — `monsterBonusDegatsConditionnel`, damage.ts.
  // `null` = pas ce genre de passif sur ce monstre.
  bonusDegatsConditionnel: BonusDegatsConditionnelProfile | null;
  // Somme des lignes d'artéfact « Effet aug. VIT » ÉQUIPÉES
  // (`speedBuffAmpliPct`, damage.ts) — DÉDUIT, jamais saisi ici ; affiché en
  // clair pour que la VIT calculée ne semble pas sortie de nulle part.
  ampliVitPct: number;
}

// Ce que le sort — ou le PASSIF (voir plus bas) — nous apprend, en une
// ligne, plutôt qu'un formulaire.
//
// ⚠️ **Le RATIO DE DÉGÂTS en tête** (demande explicite) : c'est le
// coefficient qui décide de tout le reste du calcul, et le repère que le
// joueur retrouve sur les sites de référence. Rendu par `formuleLisible`
// (monsterSkills.ts, déjà utilisée par la fiche de monstre) — qui TRADUIT
// les noms de stats (`{ATK}` → ATQ) sans réécrire la formule, précisément
// pour garder cette correspondance. Réutilisée pour CHAQUE passif offensif
// affiché (demande explicite de l'utilisateur : « affiche bien les ratios
// de dégâts des passifs quand tu as l'information via Swarfarm ») — un
// passif de `PASSIFS_OFFENSIFS_CONNUS` a TOUJOURS une formule analysable
// (`monsterOffensivePassives` l'exige, voir damage.ts), rien à deviner.
//
// ⚠️ `hitsOverride` : un passif `coupsDuSortActif` (Feng Yan, Roid…) suit le
// nombre de coups RÉELLEMENT retenu pour le SORT ACTIF, pas le nombre écrit
// sur sa propre fiche (souvent 0/1, non fiable pour un passif — voir
// `monsterOffensivePassives`) — l'appelant passe alors `resolvedHits(sort
// actif, setup)` plutôt que de laisser cette fonction relire les coups du
// passif lui-même, qui donnerait un chiffre trompeur.
function resumeSort(p: SkillDamageProfile, setup: DamageSetup, hitsOverride?: number): { ratio: string | null; reste: string } {
  const hits = hitsOverride ?? resolvedHits(p, setup);
  const bouts: string[] = [`${hits} coup${hits > 1 ? 's' : ''}${p.hitsRange && hitsOverride == null ? ' (variable)' : ''}`];
  bouts.push(p.aoe ? 'Zone' : 'Cible unique');
  if (p.ignoreDef) bouts.push('Ignore la DEF');
  if (p.ignoreDefSelonVit) bouts.push(`Ignore la DEF selon l'écart de VIT (100 % à ${p.ignoreDefSelonVit.ecartMax}+ pts)`);
  if (p.fixed) bouts.push('Dégâts fixes');
  if (p.skillupDamagePct > 0) bouts.push(`+${p.skillupDamagePct} % (compétence maxée)`);
  if (p.bonusParEffetCible) {
    bouts.push(`+${p.bonusParEffetCible.pct} % par effet ${p.bonusParEffetCible.inclutDebuffs ? 'sur la cible' : 'bénéfique sur la cible'}`);
  }
  return { ratio: formuleLisible(p.formule), reste: bouts.join(' · ') };
}

// Champ « nombre de coups » d'un sort/passif à coups VARIABLES en jeu (Sia,
// Okeanos S3…) — absent si `profile.hitsRange` ne l'autorise pas. Partagé
// entre le sort actif et un passif : même mécanisme, même champ.
function champCoupsVariables(profile: SkillDamageProfile, setup: DamageSetup, maj: (patch: Partial<DamageSetup>) => void) {
  if (!profile.hitsRange) return null;
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-xs text-ink-dim">
        Coups réellement infligés (variable en jeu, {profile.hitsRange.min} à {profile.hitsRange.max}) :
      </span>
      <NumberField
        value={resolvedHits(profile, setup)}
        onChange={(v) =>
          v != null &&
          maj({ coupsPersonnalises: { ...(setup.coupsPersonnalises ?? {}), [profile.skillCom2usId]: v } })
        }
        min={profile.hitsRange.min}
        max={profile.hitsRange.max}
      />
    </div>
  );
}

export default function DamageSetupCard({
  skills,
  resolved,
  passifs,
  modificateursVit,
  setup,
  setSetup,
  chargement,
  etroit,
  critSiPlusRapide,
  bonusDegatsSelonVit,
  bonusDegatsStack,
  critRateSelonVit,
  bonusDegatsConditionnel,
  ampliVitPct,
}: Props) {
  const maj = (patch: Partial<DamageSetup>) => setSetup((prev) => ({ ...prev, ...patch }));

  if (chargement) {
    return <p className="text-xs text-ink-dim">Chargement des compétences…</p>;
  }

  // Aucun sort calculable : on le DIT, avec ce qui se passe à la place —
  // plutôt qu'un panneau vide qui laisserait croire à un bug.
  if (!resolved) {
    return (
      <div className="rounded-lg border border-warn/60 bg-warn/10 px-3 py-2.5">
        <p className="text-xs leading-relaxed text-ink-dim">
          <b className="text-ink">Aucun sort calculable pour ce monstre.</b> Sa fiche est absente (monstre
          perso) ou ses formules sortent du modèle. La recherche reste possible : elle se rabat sur le
          biais de l&apos;objectif <b className="text-ink">Dégâts</b> (ATQ + Dgts Crit).
        </p>
      </div>
    );
  }

  // Ce que le sort choisi consomme réellement — pilote l'affichage.
  const utilise = (v: DamageVariable) => resolved.variables.includes(v);
  const montreDefEnnemie = !resolved.ignoreDef && !resolved.fixed;
  const montreCrit = !resolved.fixed;
  // Le réglage « ce sort pose le def break » ne change QUE ce qui frappe
  // après le sort — inutile d'encombrer l'écran si le monstre n'a aucun
  // passif, ou si le sort ne pose pas de réduction de défense.
  const montreDefBreakParLeSort = resolved.appliqueDefBreak && passifs.length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-panel2 p-3">
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="label">Compétence utilisée</p>
          <HelpPopover title="Compétence utilisée">
            Le coefficient, le nombre de coups, la portée, l&apos;ignore défense et le bonus des
            améliorations sont <b className="text-ink">lus dans les données du sort</b> — jamais à saisir.
            Une compétence est toujours supposée <b className="text-ink">maxée</b>, comme partout ailleurs
            dans l&apos;app.
          </HelpPopover>
        </div>
        <div className="flex flex-col gap-1.5">
          {skills.map((s) => {
            const pris = estPrisEnCharge(s);
            return (
              <Option
                key={s.skillCom2usId}
                actif={pris && s.skillCom2usId === resolved.skillCom2usId}
                disabled={!pris}
                onClick={() => pris && maj({ skillCom2usId: s.skillCom2usId })}
                icone={
                  pris && s.icone ? (
                    <img src={s.icone} alt="" className="h-7 w-7 rounded" loading="lazy" />
                  ) : undefined
                }
                titre={
                  <>
                    <span className="font-mono text-micro text-ink-dim">S{s.slot}</span>
                    {s.nom}
                  </>
                }
                // Un sort refusé affiche POURQUOI plutôt que de disparaître :
                // sans ça, l'absence du sort n°2 passerait pour un oubli.
                description={
                  pris ? (
                    (() => {
                      const { ratio, reste } = resumeSort(s, setup);
                      return (
                        <>
                          {ratio && <span className="font-mono text-ink">{ratio}</span>}
                          {ratio && ' · '}
                          {reste}
                        </>
                      );
                    })()
                  ) : (
                    s.raison
                  )
                }
              />
            );
          })}
        </div>
        {champCoupsVariables(resolved, setup, maj)}
        {/* Crawler/Frankenstein (« Rage Charge ») : le compteur d'attaques
            reçues n'est pas un état que l'app simule — saisi ici, à côté
            du sort dont il modifie directement la formule. */}
        {resolved.bonusCoefficientParCompteur && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-ink-dim">{resolved.bonusCoefficientParCompteur.label}</span>
            <NumberField
              value={setup.compteurPersonnalise?.[resolved.skillCom2usId] ?? 0}
              onChange={(v) =>
                maj({
                  compteurPersonnalise: { ...(setup.compteurPersonnalise ?? {}), [resolved.skillCom2usId]: v ?? 0 },
                })
              }
              min={0}
              max={9999}
              boxWidth="w-24"
              title="Ce que l'app ne peut pas savoir (l'état de combat réel) — à toi de le renseigner, 0 par défaut"
              ariaLabel={resolved.bonusCoefficientParCompteur.label}
            />
          </div>
        )}
      </div>

      {/* ⚠️ **Indépendant du sort choisi ci-dessus** — un passif s'applique
          quel que soit S1/S2/S3 en cours d'optimisation, voir
          spec/outils/degats-reels.md. Absent (la grande majorité des
          monstres) : rien ne s'affiche, pas même un « aucun passif connu »
          — un panneau qui parle d'une absence à chaque monstre serait plus
          bruyant qu'utile. */}
      {(passifs.length > 0 || modificateursVit.length > 0 || bonusDegatsStack || bonusDegatsConditionnel) && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="label">Passifs offensifs</p>
            <HelpPopover title="Passifs offensifs">
              Certains monstres infligent des dégâts supplémentaires par un passif (Feng Yan, Sia, Roid…),
              en plus du sort choisi ci-dessus. <b className="text-ink">Toujours actif</b> : le texte du jeu ne
              pose aucune condition de combat, compté d&apos;office.{' '}
              <b className="text-ink">Selon le def break</b> : la condition porte sur la réduction de défense —
              entièrement déduite des deux réglages d&apos;effets, rien à cocher ici.{' '}
              <b className="text-ink">Bouton</b> : une condition à juger toi-même (attribut de la cible, tes
              PV…) — désactivé par défaut, jamais deviné. Un bouton de <b className="text-ink">bonus</b> ne
              conditionne que le SURPLUS : l&apos;attaque de base du passif, elle, est comptée dans tous les cas.
            </HelpPopover>
          </div>
          <div className="space-y-2">
            {/* Ciri (Eau)/Rigna/Magic Order Swordsinger (crit garanti si plus
                rapide) et Sonia/Battle Angel (bonus continu selon l'écart de
                VIT) : des MODIFICATEURS, pas des passifs à formule — sans
                bouton (entièrement automatiques dès que la VIT le permet),
                mais affichés ici comme n'importe quel passif « toujours
                actif » (Feng Yan, Dominic…), ce qu'ils n'étaient PAS avant —
                signalé par l'utilisateur. */}
            {modificateursVit.map((m) => (
              <div key={`vit-${m.skillCom2usId}`}>
                <Jeton
                  icone={m.icone ? <img src={m.icone} alt="" className="h-4 w-4 rounded" loading="lazy" /> : undefined}
                  libelle={m.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail="toujours actif"
                />
                <p className="mt-1 text-xs leading-snug text-ink-dim">{m.detail}</p>
                {m.description && <p className="mt-1 text-xs leading-snug text-ink-dim">{m.description}</p>}
              </div>
            ))}
            {/* Momo/Mage (« Secret Book ») : un bonus qui S'ACCUMULE en
                combat (nombre d'attaques alliées déjà portées) — rien que
                l'app ne simule, donc un champ pour que le joueur indique
                lui-même où en est le stack, plutôt qu'un bouton ou une
                valeur devinée. */}
            {bonusDegatsStack && (
              <div key={`stack-${bonusDegatsStack.skillCom2usId}`}>
                <Jeton
                  icone={
                    bonusDegatsStack.icone ? (
                      <img src={bonusDegatsStack.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
                    ) : undefined
                  }
                  libelle={bonusDegatsStack.nom.replace(/\s*\(Passive\)\s*$/i, '')}
                  detail="toujours actif"
                />
                {bonusDegatsStack.description && (
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{bonusDegatsStack.description}</p>
                )}
                <label className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-ink-dim">Stack actuel</span>
                  <NumberField
                    value={resolvedStackPct(bonusDegatsStack, setup)}
                    onChange={(v) =>
                      maj({
                        stackPersonnalise: {
                          ...(setup.stackPersonnalise ?? {}),
                          [bonusDegatsStack.skillCom2usId]: v ?? 0,
                        },
                      })
                    }
                    step={bonusDegatsStack.pctParStack}
                    min={0}
                    max={bonusDegatsStack.pctMax}
                    suffix="%"
                    boxWidth="w-28"
                    title="Ce que l'app ne peut pas savoir (le nombre d'attaques alliées déjà portées ce combat) — à toi de le renseigner, désactivé (0 %) par défaut"
                    ariaLabel="Pourcentage de stack actuel du bonus de dégâts"
                  />
                </label>
              </div>
            )}
            {/* Bonus conditionnel à bouton (Jin Kazama, Cyborg, Brownie
                Magician, Astar, Jean, Kyle, Satoru Gojo, Werner, Zenitsu,
                Qilin Slasher, Panda Warrior, Mi Ying…) — même rendu (Pastille,
                désactivé par défaut) que les passifs `bonus`/`conditionnel`
                ci-dessous, mais SANS formule propre : le bouton majore le
                TOTAL du monstre, pas la contribution d'un passif précis. Même
                stockage que `passifsOffensifs` (clé = `skillCom2usId` de CE
                modificateur) — voir `bonusDegatsConditionnelActif`. */}
            {bonusDegatsConditionnel && (
              <div key={`conditionnel-${bonusDegatsConditionnel.skillCom2usId}`}>
                <Pastille
                  actif={bonusDegatsConditionnelActif(bonusDegatsConditionnel, setup)}
                  onClick={() =>
                    maj({
                      passifsOffensifs: {
                        ...(setup.passifsOffensifs ?? {}),
                        [bonusDegatsConditionnel.skillCom2usId]: !bonusDegatsConditionnelActif(bonusDegatsConditionnel, setup),
                      },
                    })
                  }
                  icone={
                    bonusDegatsConditionnel.icone ? (
                      <img src={bonusDegatsConditionnel.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
                    ) : undefined
                  }
                  libelle={`${bonusDegatsConditionnel.nom.replace(/\s*\(Passive\)\s*$/i, '')} (+${bonusDegatsConditionnel.pct} %)`}
                  title={`${bonusDegatsConditionnel.condition}${
                    bonusDegatsConditionnelActif(bonusDegatsConditionnel, setup) ? ' (activé)' : ' — désactivé par défaut'
                  }`}
                />
                <p className="mt-1 text-xs leading-snug text-ink-dim">
                  Se déclenche si {bonusDegatsConditionnel.condition}.
                </p>
                {bonusDegatsConditionnel.description && (
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{bonusDegatsConditionnel.description}</p>
                )}
              </div>
            )}
            {passifs.map((p) => {
              const nom = p.nom.replace(/\s*\(Passive\)\s*$/i, '');
              const icone = p.profile.icone ? (
                <img src={p.profile.icone} alt="" className="h-4 w-4 rounded" loading="lazy" />
              ) : undefined;
              const texteJeu = p.description ? (
                <p className="mt-1 text-xs leading-snug text-ink-dim">{p.description}</p>
              ) : null;
              // Voir `resumeSort` : un passif `coupsDuSortActif` suit les coups
              // du SORT ACTIF, jamais les siens propres.
              const { ratio, reste } = resumeSort(
                p.profile,
                setup,
                p.coupsDuSortActif && resolved ? resolvedHits(resolved, setup) : undefined
              );
              const resume = (
                <p className="mt-1 text-xs leading-snug text-ink-dim">
                  {ratio && <span className="font-mono text-ink">{ratio}</span>}
                  {ratio && ' · '}
                  {reste}
                </p>
              );

              // Déclenchement ENTIÈREMENT déduit (`defBreak`) ou inconditionnel
              // (`toujours`) : pas de bouton, on montre juste l'état courant et
              // POURQUOI, pour que le joueur puisse le contredire s'il le faut.
              if (p.categorie.type === 'toujours' || p.categorie.type === 'defBreak') {
                const declenche = passifActif(p, setup);
                return (
                  <div key={p.skillCom2usId} className={declenche ? '' : 'opacity-50'}>
                    <Jeton
                      icone={icone}
                      libelle={nom}
                      detail={p.categorie.type === 'toujours' ? 'toujours actif' : declenche ? 'déclenché' : 'non déclenché'}
                    />
                    {resume}
                    {p.categorie.type === 'defBreak' && (
                      <p className="mt-1 text-xs leading-snug text-ink-dim">
                        Se déclenche si {p.categorie.condition}.
                      </p>
                    )}
                    {p.bonusPvCible && (
                      <p className="mt-1 text-xs leading-snug text-ink-dim">
                        +{p.bonusPvCible.pct} % si les PV de la cible sont tombés à {p.bonusPvCible.seuilPct} % ou
                        moins au moment où ce passif frappe — déduit des coups du sort ci-dessus, rien à cocher.
                      </p>
                    )}
                    {texteJeu}
                    {declenche && champCoupsVariables(p.profile, setup, maj)}
                  </div>
                );
              }

              // `bonus` : le bouton ne porte QUE le surplus. `conditionnel` :
              // il porte le passif entier.
              const actif = setup.passifsOffensifs?.[p.skillCom2usId] ?? false;
              const cat = p.categorie;
              const libelle = cat.type === 'bonus' ? `${nom} (+${cat.pct} %)` : nom;
              const condition = `${cat.condition[0].toUpperCase()}${cat.condition.slice(1)}`;
              // ⚠️ `dejaInclus` (Dominic) : le ratio affiché ci-dessus EST déjà
              // le cas majoré — décocher ne l'ajoute pas, il le RETIRE (voir
              // computeTotalDamage, damage.ts). Texte distinct, sinon « Dégâts
              // de base toujours comptés ; +100 % si… » laisserait croire que
              // le ratio, lui, est encore le cas de base.
              const texteCondition =
                cat.type === 'bonus' && cat.dejaInclus
                  ? `Le ratio ci-dessus suppose déjà que ${cat.condition} — décoché par défaut, la contribution retombe au cas de base (÷ ${(
                      (100 + cat.pct) /
                      100
                    )
                      .toFixed(2)
                      .replace(/\.?0+$/, '')}).`
                  : `${cat.type === 'bonus' ? 'Dégâts de base toujours comptés ; +' + cat.pct + ' % si ' : 'Se déclenche si '}${cat.condition}.`;
              return (
                <div key={p.skillCom2usId}>
                  <Pastille
                    actif={actif}
                    onClick={() =>
                      maj({ passifsOffensifs: { ...(setup.passifsOffensifs ?? {}), [p.skillCom2usId]: !actif } })
                    }
                    icone={icone}
                    libelle={libelle}
                    title={`${condition}${actif ? ' (activé)' : ' — désactivé par défaut'}`}
                  />
                  {resume}
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{texteCondition}</p>
                  {texteJeu}
                  {champCoupsVariables(p.profile, setup, maj)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="label">Adversaire</p>
          <HelpPopover title="Adversaire">
            Les <b className="text-ink">PV</b> servent à lire le résultat (part des PV de la cible
            emportée), jamais à classer les builds. La <b className="text-ink">DEF</b>, elle, change
            réellement les dégâts — sauf pour un sort qui l&apos;ignore, auquel cas le champ
            n&apos;apparaît pas.
          </HelpPopover>
        </div>
        {/* `flex-wrap` : les deux champs passent l'un sous l'autre au doigt
            plutôt que de comprimer les boutons − / + sous la taille de cible. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="text-xs text-ink-dim">PV</span>
            <NumberField
              value={setup.enemyHp}
              onChange={(v) => maj({ enemyHp: v ?? 0 })}
              step={1000}
              min={1}
              boxWidth="w-32"
              ariaLabel="Points de vie de l'adversaire"
            />
          </label>
          {montreDefEnnemie && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-ink-dim">DEF</span>
              <NumberField
                value={setup.enemyDef}
                onChange={(v) => maj({ enemyDef: v ?? 0 })}
                step={50}
                min={0}
                boxWidth="w-32"
                ariaLabel="Défense de l'adversaire"
              />
            </label>
          )}
          {/* Pour les sorts dont la formule lit les PV COURANTS de la cible
              (« dégâts proportionnels aux PV perdus ») — mais AUSSI quand un
              passif porte un seuil de PV (Final Strike : +20 % sous 30 %),
              puisque les coups du sort creusent la cible avant qu'il frappe. */}
          {(utilise('Target Current HP %') || passifs.some((p) => p.bonusPvCible)) && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-ink-dim">PV restants</span>
              <NumberField
                value={setup.enemyHpPct}
                onChange={(v) => maj({ enemyHpPct: v ?? 0 })}
                step={5}
                min={0}
                max={100}
                suffix="%"
                boxWidth="w-32"
                ariaLabel="Pourcentage de PV restants de l'adversaire"
              />
            </label>
          )}
          {/* Julie (« Thousand Shots »)/Melissa (« Massacre Dance ») :
              +pct % par effet PRÉSENT sur la cible — l'app ne simule aucun
              effet réel de l'adversaire, saisi par l'utilisateur, 0 par
              défaut. Propre à CE sort (`resolved.bonusParEffetCible`), pas
              à tout le monstre. */}
          {resolved.bonusParEffetCible && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-ink-dim">
                Effets {resolved.bonusParEffetCible.inclutDebuffs ? '' : 'bénéfiques '}sur la cible
              </span>
              <NumberField
                value={setup.effetsCibleCount?.[resolved.skillCom2usId] ?? 0}
                onChange={(v) =>
                  maj({
                    effetsCibleCount: { ...(setup.effetsCibleCount ?? {}), [resolved.skillCom2usId]: v ?? 0 },
                  })
                }
                min={0}
                boxWidth="w-24"
                title={`Ce que l'app ne peut pas savoir (les effets ${
                  resolved.bonusParEffetCible.inclutDebuffs ? 'bénéfiques ET néfastes' : 'bénéfiques'
                } réellement présents sur la cible) — à toi de le renseigner, 0 par défaut`}
                ariaLabel={`Nombre d'effets ${resolved.bonusParEffetCible.inclutDebuffs ? 'bénéfiques et néfastes' : 'bénéfiques'} sur la cible`}
              />
            </label>
          )}
          {/* Pour un sort dont la formule lit `{Relative SPD}` (« Ta VIT −
              VIT cible / VIT cible ») — OU quand ce monstre force le
              critique s'il est plus rapide (`critSiPlusRapide`) OU majore
              tous ses dégâts selon l'écart de VIT (`bonusDegatsSelonVit`,
              Sonia), même si le sort CHOISI ne lit pas cette variable
              (ex. Rigna S1, ou n'importe quel sort de Sonia). */}
          {(utilise('Relative SPD') || critSiPlusRapide || bonusDegatsSelonVit) && (
            <>
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">VIT adversaire</span>
                <NumberField
                  value={setup.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd!}
                  onChange={(v) => maj({ enemySpd: v ?? 0 })}
                  step={10}
                  min={1}
                  boxWidth="w-32"
                  ariaLabel="Vitesse totale de l'adversaire"
                />
              </label>
              {/* ⚠️ Pas de champ « Leader skill VIT » ici : généralisé au
                  contrôle unique de « Effets actifs » (`LeaderSkillPicker`,
                  demande explicite de l'utilisateur), qui couvre les 6
                  stats — PV/ATQ/DEF/VIT/Taux Crit/Dégâts Crit — plutôt qu'un
                  champ dédié à la seule VIT ici.
                  Pas de rappel de `critSiPlusRapide`/`bonusDegatsSelonVit`
                  non plus : ces deux modificateurs apparaissent maintenant
                  dans « Passifs offensifs » ci-dessus (icône + description),
                  plus complet qu'une ligne de texte — les dupliquer ferait
                  redite. */}
              {ampliVitPct > 0 && (
                <span className="text-xs text-ink-dim">
                  + artéfact « Effet aug. VIT » : le buff de VIT est amplifié de {ampliVitPct} %
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="label">Effets actifs</p>
          <HelpPopover title="Effets actifs">
            Buffs sur le monstre (<b className="text-ink">ATQ +50 %</b>, <b className="text-ink">DEF +70 %</b>,{' '}
            <b className="text-ink">VIT +30 %</b>) et effets subis par la cible (
            <b className="text-ink">réduction de défense ×0,3</b>, <b className="text-ink">marque +25 %</b>).
            Seuls ceux qui changent quelque chose pour ce sort sont proposés.
          </HelpPopover>
        </div>
        {/* ⚠️ L'ICÔNE est le contrôle — pas une icône décorative à côté
            d'une case à cocher. `choisi` porte le liseré + fond teinté de
            `Vignette`, complété d'une COCHE en médaillon (comme la palette
            de couleurs RTA) : sur des icônes déjà très colorées, le
            liseré/fond seuls se voient mal — la coche est le signal qui
            reste net quelle que soit la couleur dessous. */}
        <div className="flex flex-wrap gap-1.5">
          {utilise('ATK') && (
            <EffetVignette icone={ATK_BUFF_ICON} libelle="Buff ATQ" onClick={() => maj({ atkBuff: !setup.atkBuff })} actif={setup.atkBuff} etroit={etroit} />
          )}
          {utilise('DEF') && (
            <EffetVignette icone={DEF_BUFF_ICON} libelle="Buff DEF" onClick={() => maj({ defBuff: !setup.defBuff })} actif={setup.defBuff} etroit={etroit} />
          )}
          {/* ⚠️ PAS seulement `utilise('SPD')` : `{Relative SPD}` (Beast
              Rider, Concentrated Stab…) et le modificateur monstre-wide
              `critSiPlusRapide` (Ciri Eau, Rigna, Magic Order Swordsinger)
              dépendent EUX AUSSI de `maVitCombat`, qui inclut ce buff — même
              quand la formule du sort choisi ne lit ni {SPD} ni
              {Relative SPD} directement (Rigna S1 « Double Gash » en lit
              une, mais un monstre à `critSiPlusRapide` pourrait très bien
              n'avoir AUCUN sort qui en dépend). */}
          {(utilise('SPD') || utilise('Relative SPD') || critSiPlusRapide || bonusDegatsSelonVit || critRateSelonVit) && (
            <EffetVignette icone={SPD_BUFF_ICON} libelle="Buff VIT" onClick={() => maj({ spdBuff: !setup.spdBuff })} actif={setup.spdBuff} etroit={etroit} />
          )}
          {montreDefEnnemie && (
            <EffetVignette
              icone={DEF_BREAK_ICON}
              libelle={montreDefBreakParLeSort ? 'Def break avant' : 'Def break'}
              onClick={() => maj({ defBreak: !setup.defBreak })}
              actif={setup.defBreak}
              etroit={etroit}
            />
          )}
          {/* ⚠️ N'apparaît QUE si le sort choisi pose lui-même une réduction
              de défense (effet `Decrease DEF`, lu dans les données) ET que ce
              monstre a un passif — sinon ce réglage ne changerait rien : la
              réduction atterrit APRÈS le coup du sort lui-même, elle ne peut
              profiter qu'à ce qui frappe ensuite. C'est ce qui distingue
              « Roid attaque une cible déjà réduite » de « Roid réduit puis son
              passif frappe » — deux passifs différents, deux mitigations
              différentes. */}
          {montreDefBreakParLeSort && (
            <EffetVignette
              icone={DEF_BREAK_ICON}
              libelle="Ce sort pose le def break"
              onClick={() => maj({ defBreakParLeSort: !(setup.defBreakParLeSort ?? false) })}
              actif={setup.defBreakParLeSort ?? false}
              etroit={etroit}
            />
          )}
          <EffetVignette icone={BRAND_ICON} libelle="Marque" onClick={() => maj({ brand: !setup.brand })} actif={setup.brand} etroit={etroit} />
          {/* Quatre effets portés par un AUTRE monstre que celui optimisé
              (demande explicite de l'utilisateur) — portrait du monstre en
              icône plutôt qu'une icône de buff générique, mais le même
              contrôle « Vignette » que les effets ci-dessus : un monstre
              dans l'équipe reste un choix de l'utilisateur, pas une donnée
              déduite du monstre optimisé lui-même. Voir les constantes
              `EULDONG_CD_POINTS`/`MIRINAE_BONUS_PCT`/`DEBORAH_AMPLIFY`/
              `MIRIAM_AMPLIFY_PCT` (damage.ts) pour le détail des mécaniques. */}
          {montreCrit && (
            <EffetVignette
              icone={EULDONG_ICON}
              libelle="Euldong"
              onClick={() => maj({ euldongActif: !setup.euldongActif })}
              actif={setup.euldongActif ?? false}
              etroit={etroit}
            />
          )}
          <EffetVignette
            icone={MIRINAE_ICON}
            libelle="Mirinae"
            onClick={() => maj({ mirinaeActif: !setup.mirinaeActif })}
            actif={setup.mirinaeActif ?? false}
            etroit={etroit}
          />
          {montreDefEnnemie && (
            <EffetVignette
              icone={DEBORAH_ICON}
              libelle="Deborah"
              onClick={() => maj({ deborahActif: !setup.deborahActif })}
              actif={setup.deborahActif ?? false}
              etroit={etroit}
            />
          )}
          {(utilise('ATK') ||
            utilise('DEF') ||
            utilise('SPD') ||
            utilise('Relative SPD') ||
            critSiPlusRapide ||
            bonusDegatsSelonVit) && (
            <EffetVignette
              icone={MIRIAM_ICON}
              libelle="Miriam"
              onClick={() => maj({ miriamActif: !setup.miriamActif })}
              actif={setup.miriamActif ?? false}
              etroit={etroit}
            />
          )}
          <EffetVignette
            icone={TRANSMISSION_ICON}
            libelle="Dr. Matteo"
            onClick={() => maj({ transmissionActif: !setup.transmissionActif })}
            actif={setup.transmissionActif ?? false}
            etroit={etroit}
          />
          <EffetVignette
            icone={VELASKA_ICON}
            libelle="Velaska"
            onClick={() => maj({ velaskaActif: !setup.velaskaActif })}
            actif={setup.velaskaActif ?? false}
            etroit={etroit}
          />
        </div>
        {/* Velaska (« Price of Pain ») a besoin d'une VALEUR en plus du
            toggle — l'app ne simule pas les PV réellement perdus par le
            monstre optimisé, contrairement aux quatre autres effets
            d'équipe (un simple oui/non suffit). Même discipline que le
            stack de Momo : un champ à part, 0 % par défaut. */}
        {setup.velaskaActif && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-ink-dim">Velaska — % de PV perdus</span>
            <NumberField
              value={setup.velaskaPvPerduPct ?? 0}
              onChange={(v) => maj({ velaskaPvPerduPct: v ?? 0 })}
              min={0}
              max={100}
              suffix="%"
              boxWidth="w-24"
              title="Ce que l'app ne peut pas savoir (les PV réellement perdus par le monstre optimisé) — à toi de le renseigner, 0 % par défaut"
              ariaLabel="Pourcentage de PV perdus pour l'effet de Velaska"
            />
          </div>
        )}
        <LeaderSkillPicker setup={setup} maj={maj} />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="label">Compétences d&apos;invocateur</p>
          <HelpPopover title="Compétences d'invocateur">
            Remplacent les anciens <b className="text-ink">totems</b> (onglet Combat) et{' '}
            <b className="text-ink">drapeaux</b> de Guerre de Guilde (onglet Guilde), toujours supposées{' '}
            <b className="text-ink">maxées</b>. <b className="text-ink">Combat</b> s&apos;applique partout ;{' '}
            <b className="text-ink">Combat + Guilde</b> n&apos;a de sens qu&apos;en contenu de guilde, où les
            compétences de Combat comptent aussi — d&apos;où un choix unique plutôt que deux cases. La
            compétence <b className="text-ink">« Puis. d&apos;att. de {'<'}élément{'>'} »</b> est appliquée
            selon l&apos;élément du monstre, sans rien demander.
          </HelpPopover>
        </div>
        <Segmented<SummonerSkills>
          options={SUMMONER_SKILLS_LABELS}
          value={setup.summonerSkills}
          onChange={(v) => maj({ summonerSkills: v })}
          size="lg"
        />
      </div>

      {montreCrit && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="label">Coup critique</p>
            <HelpPopover title="Coup critique">
              <b className="text-ink">Moyenne</b> pondère par le Taux Crit réellement atteint — c&apos;est ce
              qu&apos;on observe sur beaucoup de coups, et le seul mode où le Taux Crit pèse sur le
              classement. <b className="text-ink">Critique</b> et <b className="text-ink">Non critique</b>{' '}
              donnent le plafond et le plancher d&apos;un coup isolé.
            </HelpPopover>
          </div>
          <Segmented<CritMode>
            options={CRIT_MODE_LABELS}
            value={setup.critMode}
            onChange={(v) => maj({ critMode: v })}
            size="lg"
          />
          {/* « Moyenne » est une ESPÉRANCE (pondérée par le Taux Crit) —
              jamais ce qu'un combat réel, tour par tour, produit coup après
              coup. Demande explicite de l'utilisateur : le dire, UNIQUEMENT
              sous ce mode (Critique/Non critique sont déjà des bornes
              littérales, pas une moyenne, rien à nuancer). */}
          {setup.critMode === 'moyenne' && (
            <p className="mt-1.5 text-xs text-warn">
              Attention, la valeur affichée est purement théorique et ne correspond pas à la réalité d&apos;un jeu au
              tour par tour.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Un effet de combat = une icône de jeu cliquable, choisie/non choisie.
//
// ⚠️ **La seule PRÉSENCE d'une icône ne dit rien de son état** — signalé par
// l'utilisateur sur capture d'écran : avant tout clic, rien ne distingue
// « ce buff est actif » de « voici les buffs qu'on peut activer ». Le liseré
// + fond teinté de `Vignette` ne suffit pas non plus sur une icône déjà très
// colorée (le PNG du jeu, pas un aplat neutre comme un portrait). Deux
// signaux cumulés, tous deux DÉJÀ établis ailleurs dans l'app plutôt
// qu'inventés ici :
//  - **L'icône elle-même change d'apparence** — grisée (`grayscale`) au
//    repos, en couleurs pleines une fois activée. Même patron qu'un
//    emplacement d'artéfact vide (`ArtifactSlots.tsx`, icône grisée +
//    pictogramme « interdit ») : l'état se lit sur l'icône, pas seulement
//    sur un cadre autour.
//  - **Coche en médaillon** une fois activée, même patron que la palette de
//    couleurs de catégorie RTA (`CategoryBar.tsx`) : un signal net,
//    indépendant de la couleur de l'icône en dessous. Sans `teinte` propre à
//    l'effet (contrairement à une catégorie) : le médaillon reprend
//    directement l'accent de l'app (`bg-accent`).
// Résultat : à l'ouverture du panneau, TOUT est grisé — on voit d'un coup
// d'œil qu'aucun effet n'est encore choisi, sans avoir à cliquer pour
// comprendre la légende.
function EffetVignette({
  icone,
  libelle,
  actif,
  onClick,
  etroit,
}: {
  icone: string;
  libelle: string;
  actif: boolean;
  onClick: () => void;
  etroit: boolean;
}) {
  return (
    <Vignette
      choisi={actif}
      onClick={onClick}
      largeur="w-16"
      aria-label={`${libelle} — ${actif ? 'actif' : 'inactif'}`}
      // ⚠️ `libelle` est tronqué (`truncate`, `Vignette.tsx`) à cette largeur
      // fixe — « Ce sort pose le def break » devient « Ce sort... », illisible
      // sans un moyen de retrouver le texte complet. `title` affiche le
      // libellé ENTIER au survol, natif, sans changer la mise en page.
      title={libelle}
      contenu={<img src={icone} alt="" className={`h-7 w-7 transition ${actif ? '' : 'grayscale'}`} loading="lazy" />}
      libelle={libelle}
      // ⚠️ Coche masquée au DOIGT (même raison que CategoryBar) : à cette
      // taille de vignette, un médaillon de plus dans le coin serait une
      // cible de trop à côté de la cible déjà fine du bouton lui-même — le
      // fond renforcé (`fondAppuye`) y porte seul l'état.
      fondAppuye={etroit}
      coin={
        actif && !etroit ? (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent">
            <Check size={9} className="text-bg" />
          </span>
        ) : undefined
      }
    />
  );
}

const LEADER_SKILL_STATS: LeaderSkillStat[] = ['HP', 'Attack Power', 'Defense', 'Attack Speed', 'Critical Rate', 'Critical DMG'];

// Leader skill d'ÉQUIPE — demande explicite : « choisir un leader skill…
// PV, ATQ, DEF, VIT, Taux Crit, Dégâts Crit. Il choisira d'abord le TYPE
// (avec actualisation de l'icône), puis la VALEUR ». Un CHOIX de
// l'utilisateur, comme les quatre effets d'équipe ci-dessus — jamais déduit
// d'un monstre chargé ici (le lead vient d'un AUTRE monstre de l'équipe).
//
// ⚠️ Icône et libellés RÉUTILISÉS depuis `siege/LeadPill.tsx`
// (`leadIconUrl`/`STAT_LABEL`, déjà l'icône OFFICIELLE du jeu pour un lead
// de monstre) plutôt que dupliqués — la mise en garde de ce fichier
// (« deux tables de libellés auraient divergé ») s'applique aussi ici.
// `leadIconUrl` attend un objet `LeaderSkill` complet (portée/élément) que
// ce choix utilisateur n'a pas : traité comme portée `'General'`, sans
// élément, pour obtenir l'icône DE BASE (non déclinée par portée).
function LeaderSkillPicker({ setup, maj }: { setup: DamageSetup; maj: (patch: Partial<DamageSetup>) => void }) {
  const lead = setup.leaderSkill;
  const icone = lead ? leadIconUrl({ stat: lead.stat, amount: lead.pct, area: 'General', element: null }) : null;
  const presets = lead ? LEADER_SKILL_PRESETS[lead.stat] : [];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-dim">Leader skill</span>
      {icone && <img src={icone} alt="" className="h-6 w-6" loading="lazy" />}
      <Selecteur
        value={lead?.stat ?? ''}
        onChange={(e) => {
          const stat = e.target.value as LeaderSkillStat | '';
          // Type changé : repart sur le premier palier connu de CE type —
          // jamais garder l'ancien pourcentage, qui n'a de sens que pour
          // l'ancien type (44 % ATQ n'est pas un palier de Taux Crit).
          maj({ leaderSkill: stat ? { stat, pct: LEADER_SKILL_PRESETS[stat][0] } : undefined });
        }}
        taille="sm"
        pleineLargeur={false}
        aria-label="Type de leader skill"
      >
        <option value="">Aucun</option>
        {LEADER_SKILL_STATS.map((stat) => (
          <option key={stat} value={stat}>
            {STAT_LABEL[stat] ?? stat}
          </option>
        ))}
      </Selecteur>
      {lead && (
        <>
          <Selecteur
            value={presets.includes(lead.pct) ? String(lead.pct) : 'autre'}
            onChange={(e) => {
              if (e.target.value === 'autre') return; // le champ numérique prend le relais
              maj({ leaderSkill: { stat: lead.stat, pct: Number(e.target.value) } });
            }}
            taille="sm"
            pleineLargeur={false}
            aria-label="Palier de leader skill"
          >
            {presets.map((v) => (
              <option key={v} value={v}>
                {v} %
              </option>
            ))}
            {!presets.includes(lead.pct) && <option value="autre">{lead.pct} % (personnalisé)</option>}
          </Selecteur>
          {/* Saisie libre TOUJOURS disponible, pas seulement derrière
              « personnalisé » — demande explicite : « l'utilisateur doit
              pouvoir rentrer manuellement une autre valeur ». */}
          <NumberField
            value={lead.pct}
            onChange={(v) => maj({ leaderSkill: { stat: lead.stat, pct: v ?? 0 } })}
            min={0}
            max={100}
            suffix="%"
            boxWidth="w-20"
            ariaLabel="Pourcentage du leader skill"
          />
        </>
      )}
    </div>
  );
}
