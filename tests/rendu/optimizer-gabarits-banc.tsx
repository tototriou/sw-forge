import { useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import SetDeRunesCompact from '../../src/components/outils/optimizer/bureau/SetDeRunesCompact';
import PrincipalesImposeesBureau, { LARGEUR_COLONNE_ETROITE } from '../../src/components/outils/optimizer/bureau/PrincipalesImposeesBureau';
import EtatMonstreEssentiels from '../../src/components/outils/optimizer/bureau/EtatMonstreEssentiels';
import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../../src/lib/damage';

// Banc de navigateur des boîtes de bureau dont le sens tient à un geste (liste
// ouverte, choix en surbrillance) : les composants réels, avec un état local,
// pilotés par de vrais clics depuis optimizer-gabarits-navigateur.test.ts.

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

let root: Root | null = null;
// Les principales et l'état du monstre sont des sections sans largeur propre :
// montées à la largeur de leur sous-colonne dans les essentiels, le set à
// celle du panneau.
export async function monter(nom: 'set' | 'principales' | 'etat') {
  if (root) { const r = root; flushSync(() => r.unmount()); }
  root = createRoot(document.getElementById('racine')!);
  const r = root;
  const contenu = nom === 'set' ? <div style={{ width: 522 }}><SetBanc /></div>
    : <div style={{ width: LARGEUR_COLONNE_ETROITE }}>{nom === 'etat' ? <EtatBanc /> : <PrincipalesBanc />}</div>;
  flushSync(() => r.render(<div style={{ padding: 24 }}>{contenu}</div>));
  await new Promise((fin) => setTimeout(fin, 50));
}
