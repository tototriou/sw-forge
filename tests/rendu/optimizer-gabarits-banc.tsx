import { useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import SetDeRunesCompact from '../../src/components/outils/optimizer/bureau/SetDeRunesCompact';
import PrincipalesImposeesBureau, { LARGEUR_COLONNE_ETROITE } from '../../src/components/outils/optimizer/bureau/PrincipalesImposeesBureau';
import EtatMonstreEssentiels from '../../src/components/outils/optimizer/bureau/EtatMonstreEssentiels';
import ExemplaireBureau from '../../src/components/outils/optimizer/bureau/ExemplaireBureau';
import ObjectifEtRechercherBureau from '../../src/components/outils/optimizer/bureau/ObjectifEtRechercherBureau';
import PageBureau from '../../src/components/outils/optimizer/bureau/PageBureau';
import type { ColonneReglage } from '../../src/lib/optimizerColonnes';
import { SOURCE_OPTIONS } from '../../src/lib/optimizerExclusion';
import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../../src/lib/damage';

// Banc de navigateur des boîtes de bureau dont le sens tient à un geste (liste
// ouverte, choix en surbrillance) ou à la place reçue (fiche dépliée ou
// repliée, rangée de « Rechercher ») : les composants réels, avec un état
// local, pilotés par de vrais clics ou posés à une largeur donnée depuis
// optimizer-gabarits-navigateur.test.ts.

function SetBanc() {
  const [sets, setSets] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  return <SetDeRunesCompact setPickerSectionRef={ref} setPickerInvalid={false} comboSets={sets} onChangeSets={setSets} />;
}

function PrincipalesBanc() {
  const [choix, setChoix] = useState<Partial<Record<2 | 4 | 6, number[]>>>({});
  return <PrincipalesImposeesBureau mainStatsBySlot={choix} toggleMainStat={(slot, code) => setChoix((c) => {
    const avant = c[slot] ?? [];
    return { ...c, [slot]: avant.includes(code) ? avant.filter((x) => x !== code) : [...avant, code] };
  })} />;
}

function EtatBanc() {
  const [setup, setSetup] = useState<DamageSetup>(DEFAULT_DAMAGE_SETUP);
  return <EtatMonstreEssentiels setup={setup} maj={(p) => setSetup((s) => ({ ...s, ...p }))} etroit={false} rappelsBuffs={[]} />;
}

const rien = () => {};

// « Exemplaire » sans monstre (la fiche vide, sans relique) et un « Valider ce
// build » pleine largeur, comme celui de l'écran.
function ExemplaireBanc() {
  const ref = useRef<HTMLDivElement>(null);
  return <ExemplaireBureau zoneDRef={ref} sourceOptions={SOURCE_OPTIONS.map((o) => ({ ...o, disabled: false }))} vuesExemplaire={null}
    gearSource="box" pickSource={rien} allSourcesEmpty={false} zoneDOpen={false} zoneDList={null} validatedBadge={null}
    selected={null} selectionFiche={null} setSelectionFiche={rien} relicUsageById={{}}
    validateBuildButton={<button type="button" data-valider style={{ display: 'block', width: '100%', height: 32 }}>Valider ce build</button>} />;
}

function ObjectifBanc() {
  const ref = useRef<HTMLInputElement>(null);
  return <ObjectifEtRechercherBureau cadre={false} estimation={null} messageImport={null}
    progression={{ progress: null, refusal: null, compteAffiche: { compte: 0 } }} objective="efficience" setObjective={rien} setSetupOuvert={rien}
    resumeCombat="" handleSearch={rien} selected={null} status="idle" comboSets={['violent']} exportRecipe={rien} importFileRef={ref}
    importRecipe={rien} setStoppedManually={rien} stop={rien} />;
}

function PageBanc() {
  const [onglet, setOnglet] = useState<ColonneReglage | null>(null);
  const contenu = (nom: string) => <div style={{ height: 1200 }}>{nom}</div>;
  return <PageBureau liste={contenu('Liste')} exemplaire={<p>Exemplaire</p>}
    set={contenu('Sets')} conditions={null} principales={null} etat={null}
    artefacts={contenu('Artéfacts')} meilleurs={null} auras={contenu('Auras')} exclusion={null} avances={null}
    objectif={({ partie }) => partie === 'barre' ? <button type="button">Rechercher</button> : <p>Objectif {partie}</p>}
    resultats={contenu('Résultats')} onglet={onglet} onOnglet={setOnglet} rappelAuras={false} />;
}

let root: Root | null = null;
// Les principales et l'état du monstre sont des sections sans largeur propre :
// montées à la largeur de leur sous-colonne dans les essentiels, le set à
// celle du panneau ; « Exemplaire » et le bloc large à la largeur demandée
// (la place que la colonne de droite leur donne).
export async function monter(nom: 'set' | 'principales' | 'etat' | 'exemplaire' | 'objectif' | 'page', largeur?: number) {
  if (root) { const r = root; flushSync(() => r.unmount()); }
  root = createRoot(document.getElementById('racine')!);
  const r = root;
  const contenu = nom === 'set' ? <div style={{ width: LARGEUR_COLONNE_ETROITE }}><SetBanc /></div>
    : nom === 'exemplaire' ? <div style={{ width: largeur }}><ExemplaireBanc /></div>
      : nom === 'objectif' ? <div style={{ width: largeur }}><ObjectifBanc /></div>
        : nom === 'page' ? <div style={{ width: largeur }}><PageBanc /></div>
        : <div style={{ width: LARGEUR_COLONNE_ETROITE }}>{nom === 'etat' ? <EtatBanc /> : <PrincipalesBanc />}</div>;
  flushSync(() => r.render(<div style={{ padding: 24 }}>{contenu}</div>));
  await new Promise((fin) => setTimeout(fin, 50));
}
