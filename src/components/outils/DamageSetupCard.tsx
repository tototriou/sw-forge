import { Dispatch, SetStateAction } from 'react';
import { Check } from 'lucide-react';
import {
  ATK_BUFF_ICON,
  BRAND_ICON,
  CRIT_MODE_LABELS,
  CritMode,
  DamageSetup,
  DamageVariable,
  DEF_BREAK_ICON,
  DEF_BUFF_ICON,
  SPD_BUFF_ICON,
  SUMMONER_SKILLS_LABELS,
  SkillDamageProfile,
  SkillDamageUnsupported,
  SummonerSkills,
  estPrisEnCharge,
} from '../../lib/damage';
import { formuleLisible } from '../../lib/monsterSkills';
import NumberField from '../../ui/NumberField';
import Option from '../../ui/Option';
import Segmented from '../../ui/Segmented';
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
  setup: DamageSetup;
  setSetup: Dispatch<SetStateAction<DamageSetup>>;
  // `true` tant que la fiche du monstre n'est pas arrivée.
  chargement: boolean;
  etroit: boolean;
}

// Ce que le sort nous apprend, en une ligne — l'inverse d'un formulaire.
//
// ⚠️ **Le RATIO DE DÉGÂTS en tête** (demande explicite) : c'est le
// coefficient qui décide de tout le reste du calcul, et le repère que le
// joueur retrouve sur les sites de référence. Rendu par `formuleLisible`
// (monsterSkills.ts, déjà utilisée par la fiche de monstre) — qui TRADUIT
// les noms de stats (`{ATK}` → ATQ) sans réécrire la formule, précisément
// pour garder cette correspondance.
function resumeSort(p: SkillDamageProfile): { ratio: string | null; reste: string } {
  const bouts: string[] = [`${p.hits} coup${p.hits > 1 ? 's' : ''}`];
  bouts.push(p.aoe ? 'Zone' : 'Cible unique');
  if (p.ignoreDef) bouts.push('Ignore la DEF');
  if (p.fixed) bouts.push('Dégâts fixes');
  if (p.skillupDamagePct > 0) bouts.push(`+${p.skillupDamagePct} % (compétence maxée)`);
  return { ratio: formuleLisible(p.formule), reste: bouts.join(' · ') };
}

export default function DamageSetupCard({ skills, resolved, setup, setSetup, chargement, etroit }: Props) {
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
                      const { ratio, reste } = resumeSort(s);
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
      </div>

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
          {/* Uniquement pour les sorts dont la formule lit les PV COURANTS de
              la cible (ex. « dégâts proportionnels aux PV perdus »). */}
          {utilise('Target Current HP %') && (
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
          {utilise('SPD') && (
            <EffetVignette icone={SPD_BUFF_ICON} libelle="Buff VIT" onClick={() => maj({ spdBuff: !setup.spdBuff })} actif={setup.spdBuff} etroit={etroit} />
          )}
          {montreDefEnnemie && (
            <EffetVignette
              icone={DEF_BREAK_ICON}
              libelle="Def break"
              onClick={() => maj({ defBreak: !setup.defBreak })}
              actif={setup.defBreak}
              etroit={etroit}
            />
          )}
          <EffetVignette icone={BRAND_ICON} libelle="Marque" onClick={() => maj({ brand: !setup.brand })} actif={setup.brand} etroit={etroit} />
        </div>
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
