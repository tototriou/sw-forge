import { CONFIGURABLE_SLOTS } from '../constantes';
import { SLOT_MAIN_OPTIONS } from '../../../../lib/runeBuildOptim';
import { RUNE_EFFECT } from '../../../../lib/effects';
import { SelecteurMultiple } from '../../../../ui';
import { type StatPrincipaleImposeeProps } from '../StatPrincipaleImposee';

// La sous-colonne à droite des Conditions (principales, puis état du monstre),
// pour la vue des gabarits et les bancs : sa largeur dans les essentiels
// (522 de panneau, moins 328 de Conditions et 17 de trait).
export const LARGEUR_COLONNE_ETROITE = 177;

// « Statistique principale imposée (slots pairs) », au bureau : une rangée
// compacte par slot, « Slot n » puis sa liste à choix multiples (schéma de
// l'utilisateur, arrêt 4), « Libre » sans choix, en « forme 2 » (liste
// classique, chaque principale choisie en surbrillance, sans case) ; une ou
// plusieurs principales, comme les puces du téléphone (`StatPrincipaleImposee`,
// inchangé). Mêmes props : le geste reste `toggleMainStat`, une principale à la
// fois. Surface de 160 px : « Dmg Crit » y tient.
//
// ⚠️ **Le champ fermé montre toutes les valeurs choisies** (`resumeEntier`), à
// la ligne entre deux valeurs : une ligne pour « Libre » ou deux ou trois
// principales, deux pour les cinq d'un slot. Sans hauteur réservée : la
// surface ouverte garde sa place même si le champ s'allonge sous elle
// (`SelecteurMultiple`), seules les rangées suivantes descendent.
export default function PrincipalesImposeesBureau({ mainStatsBySlot, toggleMainStat }: StatPrincipaleImposeeProps) {
  return (
    <section aria-label="Statistique principale imposée (slots pairs)" className="flex flex-col">
      <p className="label mb-1.5">Statistique principale imposée (slots pairs)</p>
      <div className="flex flex-col gap-1.5">
        {CONFIGURABLE_SLOTS.map((slot) => {
          const avant = mainStatsBySlot[slot] ?? [];
          return (
            <div key={slot} className="flex items-center gap-1.5">
              <span className="w-9 flex-none text-micro text-ink-dim">Slot {slot}</span>
              <div className="min-w-0 flex-1">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
