import { useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import SetDeRunesCompact from '../../src/components/outils/optimizer/bureau/SetDeRunesCompact';
import PrincipalesImposeesBureau from '../../src/components/outils/optimizer/bureau/PrincipalesImposeesBureau';

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

let root: Root | null = null;
export async function monter(nom: 'set' | 'principales') {
  if (root) { const r = root; flushSync(() => r.unmount()); }
  root = createRoot(document.getElementById('racine')!);
  const r = root;
  flushSync(() => r.render(<div style={{ padding: 24 }}>{nom === 'set' ? <SetBanc /> : <PrincipalesBanc />}</div>));
  await new Promise((fin) => setTimeout(fin, 50));
}
