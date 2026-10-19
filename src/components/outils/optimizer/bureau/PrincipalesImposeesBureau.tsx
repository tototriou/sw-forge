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
// fois. Surface de 160 px : « Dmg Crit » y tient.
//
// ⚠️ **Le champ fermé montre toutes les valeurs choisies** (`resumeEntier`), à
// la ligne entre deux valeurs, sa hauteur réservée pour le slot entier : rien
// n'est tronqué, rien ne bouge au choix. Le nom du slot passe AU-DESSUS du
// champ, qui prend toute la largeur de la carte : à côté, le texte n'aurait
// que 76 px, et les cinq principales du slot 4 y prendraient quatre lignes au
// lieu de deux.
// ⚠️ **Les trois listes s'espacent dans la hauteur de la carte** (`flex-1`,
// `justify-between`) quand la mise en page lui en donne plus que son contenu ;
// sinon, 12 px entre deux listes.
export default function PrincipalesImposeesBureau({ mainStatsBySlot, toggleMainStat }: StatPrincipaleImposeeProps) {
  return (
    <section
      aria-label="Statistique principale imposée (slots pairs)"
      style={{ width: LARGEUR_COLONNE_ETROITE }}
      className="flex flex-col rounded-xl border border-border bg-panel p-3"
    >
      <p className="label mb-2">Statistique principale imposée (slots pairs)</p>
      <div className="flex flex-1 flex-col justify-between gap-3">
        {CONFIGURABLE_SLOTS.map((slot) => {
          const avant = mainStatsBySlot[slot] ?? [];
          return (
            <div key={slot} className="flex flex-col gap-1">
              <span className="text-micro text-ink-dim">Slot {slot}</span>
              <SelecteurMultiple
                libelle={`Slot ${slot}`}
                taille="sm"
                vide="Libre"
                forme="surbrillance"
                resumeEntier
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
