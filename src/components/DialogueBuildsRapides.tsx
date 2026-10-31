import { ReactNode, useState } from 'react';
import { RUNE_SETS } from '../types';
import { runeSetIconFilter } from '../lib/effects';
import {
  BROKEN,
  BUILDS_PAR_COMBO_MAX,
  BUILDS_PAR_COMBO_MIN,
  ComboVitesse,
  SETS_DEUX,
  SETS_QUATRE,
  cleCombo,
} from '../lib/buildsRapides';
import {
  REGLAGE_BUILDS_RAPIDES_DEFAUT,
  ReglageBuildsRapides,
  setReglageBuildsRapides,
  useBuildsRapides,
} from '../hooks/useBuildsRapides';
import { Bouton, BoutonIcone, Jeton, Modale, NumberField } from '../ui';
import RuneIcon from './RuneIcon';
import type { Dictionnaire } from '../i18n';
import SymbolesCombo, { nomCombo } from './SymbolesCombo';

const label = (key: string) => RUNE_SETS.find((s) => s.key === key)?.label ?? key;

// Résumé d'une ligne, sous l'intitulé du réglage.
export function resumeBuildsRapides(r: ReglageBuildsRapides, t: Dictionnaire['parametres']): string {
  return t.resumeBuildsRapides(r.combos.length, r.nombre);
}

// Fenêtre du réglage « Builds les plus rapides » : le nombre de builds par
// combinaison, et les combinaisons affichées. Chaque geste s'applique tout de
// suite, comme les autres réglages : il n'y a rien à valider.
export default function DialogueBuildsRapides({ onClose }: { onClose: () => void }) {
  const reglage = useBuildsRapides();
  const [quatre, setQuatre] = useState(SETS_QUATRE[0]);
  const presentes = new Set(reglage.combos.map(cleCombo));
  const parDefaut =
    reglage.nombre === REGLAGE_BUILDS_RAPIDES_DEFAUT.nombre &&
    JSON.stringify(reglage.combos) === JSON.stringify(REGLAGE_BUILDS_RAPIDES_DEFAUT.combos);

  const ecrire = (v: Partial<ReglageBuildsRapides>) => setReglageBuildsRapides({ ...reglage, ...v });
  const ajouter = (deux: string) => ecrire({ combos: [...reglage.combos, { quatre, deux }] });
  const retirer = (c: ComboVitesse) => ecrire({ combos: reglage.combos.filter((x) => cleCombo(x) !== cleCombo(c)) });

  // Un set qu'on peut poser en second : déjà là → désactivé, avec la raison.
  const second = (deux: string, icone: ReactNode, libelle: string) => {
    const deja = presentes.has(cleCombo({ quatre, deux }));
    return (
      <BoutonIcone
        key={deux}
        cadre
        libelle={deja ? `${label(quatre)} + ${libelle} : déjà affichée` : `Ajouter ${label(quatre)} + ${libelle}`}
        icone={icone}
        disabled={deja}
        onClick={() => ajouter(deux)}
        // Grille serrée d'icônes de set : même exemption que SetComboPicker.
        data-cible-fine
        className="h-8 w-8"
      />
    );
  };

  return (
    <Modale
      onClose={onClose}
      labelledBy="titre-builds-rapides"
      titre="Builds les plus rapides"
      sousTitre="Ce que montre le Résumé des runes."
      croix
      largeur="max-w-[520px]"
      // Chaque geste s'applique tout de suite : la croix est la seule sortie,
      // comme sur un dialogue de choix (docs/03-developpeur/interface/librairie-ui/modales-et-panneaux.md).
      actions={
        <Bouton
          fond="vide"
          libelle="Rétablir le défaut"
          disabled={parDefaut}
          title={parDefaut ? 'Déjà le réglage par défaut' : `Les ${REGLAGE_BUILDS_RAPIDES_DEFAUT.combos.length} combinaisons de départ, ${REGLAGE_BUILDS_RAPIDES_DEFAUT.nombre} builds par combinaison`}
          onClick={() => setReglageBuildsRapides(REGLAGE_BUILDS_RAPIDES_DEFAUT)}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">Builds par combinaison</span>
          <NumberField
            value={reglage.nombre}
            min={BUILDS_PAR_COMBO_MIN}
            max={BUILDS_PAR_COMBO_MAX}
            onChange={(v) => v != null && ecrire({ nombre: v })}
            ariaLabel="Builds par combinaison"
          />
        </div>

        {/* ⚠️ L'ajout AVANT la liste : un jeton ajouté allonge la liste, il ne
            doit pas pousser vers le bas les boutons qu'on vient de cliquer. */}
        <div>
          <p className="label mb-1.5">Ajouter une combinaison</p>
          <div className="grid grid-cols-[auto_1fr] rounded-lg border border-border bg-panel p-2">
            <div className="pr-3">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-dimmer">Set 4 pièces</p>
              <div className="grid grid-cols-3 gap-1">
                {SETS_QUATRE.map((k) => (
                  <BoutonIcone
                    key={k}
                    cadre
                    actif={k === quatre}
                    aria-pressed={k === quatre}
                    libelle={label(k)}
                    icone={<RuneIcon setKey={k} size={20} filter={runeSetIconFilter(k === quatre)} />}
                    onClick={() => setQuatre(k)}
                    data-cible-fine
                    className="h-8 w-8"
                  />
                ))}
              </div>
            </div>
            <div className="border-l border-border-soft pl-3">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-dimmer">
                Avec {label(quatre)}
              </p>
              <div className="flex flex-wrap gap-1">
                {SETS_DEUX.map((k) =>
                  second(k, <RuneIcon setKey={k} size={20} filter={runeSetIconFilter(false)} />, label(k))
                )}
                {/* Broken : pas de symbole de set, le mot. */}
                <Bouton
                  taille="sm"
                  libelle="Broken"
                  title={
                    presentes.has(cleCombo({ quatre, deux: BROKEN }))
                      ? `${label(quatre)} + Broken : déjà affichée`
                      : `Ajouter ${label(quatre)} + Broken (2 runes de n'importe quel set)`
                  }
                  disabled={presentes.has(cleCombo({ quatre, deux: BROKEN }))}
                  onClick={() => ajouter(BROKEN)}
                  data-cible-fine
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="label mb-1.5">Combinaisons affichées ({reglage.combos.length})</p>
          {reglage.combos.length === 0 ? (
            <p className="text-xs text-ink-dim">Aucune : le bloc du Résumé reste vide.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {reglage.combos.map((c) => (
                <Jeton
                  key={cleCombo(c)}
                  icone={<SymbolesCombo combo={c} taille={14} />}
                  libelle={nomCombo(c)}
                  onRetirer={() => retirer(c)}
                  libelleRetrait={`Retirer ${nomCombo(c)}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modale>
  );
}
