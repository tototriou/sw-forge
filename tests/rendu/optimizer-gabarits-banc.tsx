import { useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import SetDeRunesCompact from '../../src/components/outils/optimizer/bureau/SetDeRunesCompact';
import PrincipalesImposeesBureau from '../../src/components/outils/optimizer/bureau/PrincipalesImposeesBureau';
import EtatMonstreEssentiels from '../../src/components/outils/optimizer/bureau/EtatMonstreEssentiels';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile, type DamageSetup } from '../../src/lib/damage';

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
  return <EtatMonstreEssentiels setup={setup} maj={(p) => setSetup((s) => ({ ...s, ...p }))} etroit={false}
    artefacts={artifactDamageProfile([])} rappelsBuffs={[]} />;
}

let root: Root | null = null;
// `principales-haute` : la carte dans une rangée de 420 px (étirée, comme à côté
// d'une carte plus haute), pour voir les listes s'espacer dans sa hauteur.
export async function monter(nom: 'set' | 'principales' | 'principales-haute' | 'etat') {
  if (root) { const r = root; flushSync(() => r.unmount()); }
  root = createRoot(document.getElementById('racine')!);
  const r = root;
  const contenu = nom === 'set' ? <SetBanc /> : nom === 'etat' ? <EtatBanc />
    : nom === 'principales-haute' ? <div style={{ display: 'flex', height: 420 }}><PrincipalesBanc /></div> : <PrincipalesBanc />;
  flushSync(() => r.render(<div style={{ padding: 24 }}>{contenu}</div>));
  await new Promise((fin) => setTimeout(fin, 50));
}
