import { Dispatch, SetStateAction } from 'react';
import {
  CRIT_MODE_LABELS,
  CritMode,
  DamageSetup,
  DamageVariable,
  SkillDamageProfile,
  SkillDamageUnsupported,
  estPrisEnCharge,
} from '../../lib/damage';
import Interrupteur from '../../ui/Interrupteur';
import NumberField from '../../ui/NumberField';
import Option from '../../ui/Option';
import Segmented from '../../ui/Segmented';
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
// custom », voir spec/shared/design.md). Le seul élément propre est
// l'icône de sort, une image des données SWARFARM — même rendu que la fiche
// de monstre (MonsterDetailDialog.tsx).

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
function resumeSort(p: SkillDamageProfile): string {
  const bouts: string[] = [`${p.hits} coup${p.hits > 1 ? 's' : ''}`];
  bouts.push(p.aoe ? 'Zone' : 'Cible unique');
  if (p.ignoreDef) bouts.push('Ignore la DEF');
  if (p.fixed) bouts.push('Dégâts fixes');
  if (p.skillupDamagePct > 0) bouts.push(`+${p.skillupDamagePct} % (compétence maxée)`);
  return bouts.join(' · ');
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
                description={pris ? resumeSort(s) : s.raison}
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
        <div className="flex flex-col gap-1.5">
          {utilise('ATK') && (
            <BasculeEffet libelle="Buff d'attaque (+50 %)" actif={setup.atkBuff} onChange={(v) => maj({ atkBuff: v })} />
          )}
          {utilise('DEF') && (
            <BasculeEffet libelle="Buff de défense (+70 %)" actif={setup.defBuff} onChange={(v) => maj({ defBuff: v })} />
          )}
          {utilise('SPD') && (
            <BasculeEffet libelle="Buff de vitesse (+30 %)" actif={setup.spdBuff} onChange={(v) => maj({ spdBuff: v })} />
          )}
          {montreDefEnnemie && (
            <BasculeEffet
              libelle="Réduction de défense sur la cible"
              actif={setup.defBreak}
              onChange={(v) => maj({ defBreak: v })}
            />
          )}
          <BasculeEffet libelle="Marque sur la cible (+25 %)" actif={setup.brand} onChange={(v) => maj({ brand: v })} />
        </div>
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
            dense={etroit}
          />
        </div>
      )}
    </div>
  );
}

// Une ligne « intitulé à gauche, interrupteur à droite » — même grammaire que
// les réglages du menu ⚙ (voir spec/README.md, « Réglages globaux »).
function BasculeEffet({
  libelle,
  actif,
  onChange,
}: {
  libelle: string;
  actif: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-dim">{libelle}</span>
      <Interrupteur actif={actif} onChange={onChange} aria-label={libelle} />
    </label>
  );
}
