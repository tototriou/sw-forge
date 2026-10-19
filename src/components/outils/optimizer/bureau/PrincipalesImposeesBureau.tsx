import { CONFIGURABLE_SLOTS } from '../constantes';
import { SLOT_MAIN_OPTIONS } from '../../../../lib/runeBuildOptim';
import { RUNE_EFFECT } from '../../../../lib/effects';
import { SelecteurMultiple } from '../../../../ui';
import { type StatPrincipaleImposeeProps } from '../StatPrincipaleImposee';

export const LARGEUR_COLONNE_ETROITE = 170;

// « Statistique principale imposée (slots pairs) », au bureau : une liste à
// choix multiples par slot, « Libre » sans choix, en « forme 2 » (liste
// classique, chaque principale choisie en surbrillance, sans case) ; une ou
// plusieurs principales, comme les puces du téléphone (`StatPrincipaleImposee`,
// inchangé). Mêmes props : le geste reste `toggleMainStat`, une principale à la
// fois. Surface de 160 px, plus large que le champ : « Dmg Crit » y tient.
export default function PrincipalesImposeesBureau({ mainStatsBySlot, toggleMainStat }: StatPrincipaleImposeeProps) {
  return (
    <section
      aria-label="Statistique principale imposée (slots pairs)"
      style={{ width: LARGEUR_COLONNE_ETROITE }}
      className="rounded-xl border border-border bg-panel p-3"
    >
      <p className="label mb-2">Statistique principale imposée (slots pairs)</p>
      <div className="flex flex-col gap-1.5">
        {CONFIGURABLE_SLOTS.map((slot) => {
          const avant = mainStatsBySlot[slot] ?? [];
          return (
            <div key={slot} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
              <span className="text-micro text-ink-dim">Slot {slot}</span>
              <SelecteurMultiple
                libelle={`Slot ${slot}`}
                taille="sm"
                vide="Libre"
                forme="surbrillance"
                largeurSurface="w-40"
                options={SLOT_MAIN_OPTIONS[slot].map((code) => ({ valeur: code, libelle: RUNE_EFFECT[code]?.label ?? String(code) }))}
                valeurs={avant}
                onChange={(suivantes) => {
                  const change = [...suivantes.filter((c) => !avant.includes(c)), ...avant.filter((c) => !suivantes.includes(c))][0];
                  if (change !== undefined) toggleMainStat(slot, change);
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
