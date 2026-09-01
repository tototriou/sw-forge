import { DamageSetup, LEADER_SKILL_PRESETS, LeaderSkillStat, SUMMONER_SKILLS_LABELS, SummonerSkills } from '../../lib/damage';
import { leadIconUrl, STAT_LABEL } from '../siege/LeadPill';
import { Segmented, Selecteur, NumberField } from '../../ui';
import HelpPopover from '../HelpPopover';
import EffetVignette from './EffetVignette';
import { ATK_BUFF_ICON, DEF_BUFF_ICON, SPD_BUFF_ICON } from '../../lib/damage';

/**
 * « État de mon monstre » — ce qui rend le monstre plus fort, indépendamment
 * de qui il frappe.
 *
 * ⚠️ **Ces cinq réglages vivaient dans `DamageSetupCard`**, donc atteignables
 * seulement sous l'objectif « Dégâts réels » — alors qu'ils changent AUSSI les
 * dégâts supplémentaires bruts des artéfacts (codes 218-221), affichés quel
 * que soit l'objectif. Un joueur optimisant l'efficience subissait donc des
 * buffs qu'il ne pouvait ni voir ni régler. Aucun champ n'est créé ici : ce
 * sont les mêmes `DamageSetup.atkBuff`/`defBuff`/`spdBuff`/`leaderSkill`/
 * `summonerSkills`, montrés ailleurs.
 *
 * ⚠️ **Le critère de la coupe, et il se vérifie** : sortent de la description
 * du combat EXACTEMENT les réglages qui modifient les statistiques propres du
 * monstre. Les dégâts bruts valant `%PV×PV + %ATQ×ATQ + %DEF×DEF + %VIT×VIT`,
 * ce sont exactement ceux qui les font bouger. Ce qui reste dans la fenêtre
 * (défense/PV/élément de la cible, sort, critique, réduction de DEF, marque,
 * effets d'alliés) n'y touche pas — voir les correctifs 7798557 et e26118c,
 * « un bonus +X % par effet ne majore pas les dégâts bruts ». Test : changer
 * un réglage d'ici DOIT faire bouger le « +X / coup ».
 *
 * ⚠️ **Rendus INCONDITIONNELLEMENT**, contrairement à leur ancienne place. Les
 * vignettes n'apparaissaient que si la formule du sort choisi lisait la
 * statistique (`utilise('ATK')`…) — la bonne question tant qu'elles
 * décrivaient un coup. Elle ne l'est plus : un buff change les statistiques du
 * monstre, donc les dégâts bruts des artéfacts, quel que soit le sort et même
 * sans sort du tout.
 */
export default function EtatMonstre({
  setup,
  maj,
  etroit,
}: {
  setup: DamageSetup;
  maj: (patch: Partial<DamageSetup>) => void;
  etroit: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <p className="label">État de mon monstre</p>
        <HelpPopover title="État de mon monstre">
          Ce qui rend ton monstre plus fort, <b className="text-ink">quel que soit l&apos;adversaire</b> : buffs
          reçus, leader skill de l&apos;équipe, compétences d&apos;invocateur. Ces réglages changent ses
          statistiques, donc les <b className="text-ink">dégâts supplémentaires</b> que lui apportent des
          artéfacts proportionnels aux PV, à l&apos;ATQ, à la DEF ou à la VIT.
          <br />
          <br />
          Ce qui décrit <b className="text-ink">le combat</b> — le sort, la cible, le coup critique — vit dans
          la fenêtre « Dégâts réels », qui s&apos;ouvre depuis l&apos;objectif de recherche.
        </HelpPopover>
      </div>

      {/* Mêmes vignettes qu'avant, même composant : l'ICÔNE est le contrôle. */}
      <div className="flex flex-wrap gap-1.5">
        <EffetVignette
          icone={ATK_BUFF_ICON}
          libelle="Buff ATQ"
          onClick={() => maj({ atkBuff: !setup.atkBuff })}
          actif={setup.atkBuff}
          etroit={etroit}
        />
        <EffetVignette
          icone={DEF_BUFF_ICON}
          libelle="Buff DEF"
          onClick={() => maj({ defBuff: !setup.defBuff })}
          actif={setup.defBuff}
          etroit={etroit}
        />
        <EffetVignette
          icone={SPD_BUFF_ICON}
          libelle="Buff VIT"
          onClick={() => maj({ spdBuff: !setup.spdBuff })}
          actif={setup.spdBuff}
          etroit={etroit}
        />
      </div>

      <LeaderSkillPicker setup={setup} maj={maj} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-dim">Invocateur</span>
        <HelpPopover title="Compétences d'invocateur">
          Remplacent les anciens <b className="text-ink">totems</b> (onglet Combat) et{' '}
          <b className="text-ink">drapeaux</b> de Guerre de Guilde (onglet Guilde), toujours supposées{' '}
          <b className="text-ink">maxées</b>. <b className="text-ink">Combat</b> s&apos;applique partout ;{' '}
          <b className="text-ink">Combat + Guilde</b> n&apos;a de sens qu&apos;en contenu de guilde, où les
          compétences de Combat comptent aussi — d&apos;où un choix unique plutôt que deux cases. La
          compétence <b className="text-ink">« Puis. d&apos;att. de {'<'}élément{'>'} »</b> est appliquée selon
          l&apos;élément du monstre, sans rien demander.
        </HelpPopover>
        {/* `size="sm"` et non `lg` : sur trois crans dans une carte étroite,
            la taille d'origine (héritée d'une carte pleine largeur) débordait. */}
        <Segmented<SummonerSkills>
          options={SUMMONER_SKILLS_LABELS}
          value={setup.summonerSkills}
          onChange={(v) => maj({ summonerSkills: v })}
          size="sm"
        />
      </div>
    </div>
  );
}

const LEADER_SKILL_STATS: LeaderSkillStat[] = ['HP', 'Attack Power', 'Defense', 'Attack Speed', 'Critical Rate', 'Critical DMG'];

// Leader skill d'ÉQUIPE — demande explicite : « choisir un leader skill…
// PV, ATQ, DEF, VIT, Taux Crit, Dégâts Crit. Il choisira d'abord le TYPE
// (avec actualisation de l'icône), puis la VALEUR ». Un CHOIX de
// l'utilisateur, jamais déduit d'un monstre chargé ici (le lead vient d'un
// AUTRE monstre de l'équipe).
//
// ⚠️ Icône et libellés RÉUTILISÉS depuis `siege/LeadPill.tsx`
// (`leadIconUrl`/`STAT_LABEL`, déjà l'icône OFFICIELLE du jeu pour un lead de
// monstre) plutôt que dupliqués — « deux tables de libellés auraient
// divergé ». `leadIconUrl` attend un objet `LeaderSkill` complet
// (portée/élément) que ce choix utilisateur n'a pas : traité comme portée
// `'General'`, sans élément, pour obtenir l'icône DE BASE.
function LeaderSkillPicker({ setup, maj }: { setup: DamageSetup; maj: (patch: Partial<DamageSetup>) => void }) {
  const lead = setup.leaderSkill;
  const icone = lead ? leadIconUrl({ stat: lead.stat, amount: lead.pct, area: 'General', element: null }) : null;
  const presets = lead ? LEADER_SKILL_PRESETS[lead.stat] : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
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
