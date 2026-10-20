import EffetVignette from '../../EffetVignette';
import { LeaderSkillPicker, RappelsEtatMonstre, TitreEtatMonstre } from '../../EtatMonstre';
import { type ComponentProps } from 'react';
import { motifLeadAffiche } from '../../../../lib/equipesOptimizer';
import { ATK_BUFF_ICON, DEF_BUFF_ICON, SPD_BUFF_ICON, type ArtifactDamageProfile, type DamageSetup } from '../../../../lib/damage';

// Le type des rappels vient de la carte : seuls l'écran et la carte importent
// la table des buffs de passif (tests/buffs-de-passif.test.ts).
type RappelsBuffs = ComponentProps<typeof RappelsEtatMonstre>['rappelsBuffs'];

export interface EtatMonstreEssentielsProps {
  setup: DamageSetup;
  maj: (patch: Partial<DamageSetup>) => void;
  equipe?: boolean;
  motifLead?: string | null;
  etroit: boolean;
  artefacts: ArtifactDamageProfile;
  rappelsBuffs: RappelsBuffs;
}

// « État de mon monstre » réduit aux buffs et au lead, section des essentiels
// du bureau, sous les principales. Les sets d'aura des autres monstres vont en
// tête de la colonne « Aura, exclusion, avancés ». Les morceaux sont ceux
// d'`EtatMonstre` (partagé avec le téléphone, inchangé) : titre et aide,
// vignettes, choix du lead, rappels des passifs et amplifications.
//
// ⚠️ **Les trois buffs sur UNE rangée** (schéma de l'utilisateur, arrêt 4) :
// vignettes de 56 px, qui tiennent à trois dans la sous-colonne de ≈ 175 px.
// Le lead dessous, comme le schéma : « Lead », l'icône, la liste de la stat,
// et la liste du pourcentage sous elle (`LeaderSkillPicker`, grille du
// bureau) ; sans boîte autour, la liste de la stat a la largeur de son plus
// long libellé. L'aide du titre est celle du bureau : sans les sets d'aura ni
// le paragraphe sur le combat.
export default function EtatMonstreEssentiels({ setup, maj, equipe = false, motifLead, etroit, artefacts, rappelsBuffs }: EtatMonstreEssentielsProps) {
  return (
    <section aria-label="État de mon monstre" className="flex flex-col gap-1.5">
      <TitreEtatMonstre bureau />
      <div className="flex justify-between gap-1">
        <EffetVignette icone={ATK_BUFF_ICON} libelle="Buff ATQ" description="Augmente l’ATQ du monstre de 50 %."
          onClick={() => maj({ atkBuff: !setup.atkBuff })} actif={setup.atkBuff} etroit={etroit} largeur="w-14" />
        <EffetVignette icone={DEF_BUFF_ICON} libelle="Buff DEF" description="Augmente la DEF du monstre de 70 %."
          onClick={() => maj({ defBuff: !setup.defBuff })} actif={setup.defBuff} etroit={etroit} largeur="w-14" />
        <EffetVignette icone={SPD_BUFF_ICON} libelle="Buff VIT" description="Augmente la VIT du monstre de 30 %."
          onClick={() => maj({ spdBuff: !setup.spdBuff })} actif={setup.spdBuff} etroit={etroit} largeur="w-14" />
      </div>
      <LeaderSkillPicker setup={setup} maj={maj} />
      {equipe && (
        <p className="h-20 overflow-y-auto text-xs text-ink-dim">
          {motifLeadAffiche(motifLead) && <span className="block text-warn">{motifLeadAffiche(motifLead)}</span>}
        </p>
      )}
      <RappelsEtatMonstre setup={setup} artefacts={artefacts} rappelsBuffs={rappelsBuffs} />
    </section>
  );
}
