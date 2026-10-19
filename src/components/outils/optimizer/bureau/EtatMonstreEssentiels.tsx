import EffetVignette from '../../EffetVignette';
import { LeaderSkillPicker, RappelsEtatMonstre, TitreEtatMonstre } from '../../EtatMonstre';
import { LARGEUR_COLONNE_ETROITE } from './PrincipalesImposeesBureau';
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

// « État de mon monstre » réduit aux buffs et au lead, dans les essentiels du
// bureau. Les sets d'aura des autres monstres vont en tête de la colonne
// « Aura, exclusion, avancés ». Les morceaux sont ceux d'`EtatMonstre`
// (partagé avec le téléphone, inchangé) : titre et aide, vignettes, choix du
// lead, rappels des passifs et amplifications.
//
// ⚠️ **Les vignettes en colonne**, sans bascule selon la fenêtre : trois
// vignettes de 64 px ne tiennent pas en rangée dans 170 px.
export default function EtatMonstreEssentiels({ setup, maj, equipe = false, motifLead, etroit, artefacts, rappelsBuffs }: EtatMonstreEssentielsProps) {
  return (
    <section
      aria-label="État de mon monstre"
      style={{ width: LARGEUR_COLONNE_ETROITE }}
      className="flex flex-col gap-2 rounded-xl border border-border bg-panel p-3"
    >
      <TitreEtatMonstre />
      <div className="flex w-20 flex-col items-center gap-1.5 rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
        <EffetVignette icone={ATK_BUFF_ICON} libelle="Buff ATQ" description="Augmente l’ATQ du monstre de 50 %."
          onClick={() => maj({ atkBuff: !setup.atkBuff })} actif={setup.atkBuff} etroit={etroit} />
        <EffetVignette icone={DEF_BUFF_ICON} libelle="Buff DEF" description="Augmente la DEF du monstre de 70 %."
          onClick={() => maj({ defBuff: !setup.defBuff })} actif={setup.defBuff} etroit={etroit} />
        <EffetVignette icone={SPD_BUFF_ICON} libelle="Buff VIT" description="Augmente la VIT du monstre de 30 %."
          onClick={() => maj({ spdBuff: !setup.spdBuff })} actif={setup.spdBuff} etroit={etroit} />
      </div>
      <div className="flex items-center rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
        <LeaderSkillPicker setup={setup} maj={maj} />
      </div>
      {equipe && (
        <p className="h-20 overflow-y-auto text-xs text-ink-dim">
          {motifLeadAffiche(motifLead) && <span className="block text-warn">{motifLeadAffiche(motifLead)}</span>}
        </p>
      )}
      <RappelsEtatMonstre setup={setup} artefacts={artefacts} rappelsBuffs={rappelsBuffs} />
    </section>
  );
}
