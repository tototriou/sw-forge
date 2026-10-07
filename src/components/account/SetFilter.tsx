import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { RuneDetail, RUNE_SETS } from '../../types';
import RuneIcon from '../RuneIcon';
import { runeSetIconFilter } from '../../lib/effects';
import { useMediaQuery, COMPACT, SOUS_LG } from '../../hooks/useMediaQuery';
import { MARQUEUR_FILTRE_ACTIF } from '../../ui/Pastille';
import { ACTIF_FILTRE_LG, CADRE_FILTRE_LG, CASE_FILTRE_LG } from './gabaritFiltre';

// Filtre multi-sélection par set de runes, **icônes seules**.
//
// Règle d'interface (voir ../../spec/compte/runes.md) : partout où l'on filtre
// sur les sets, on montre **l'icône du jeu sans le nom**. Les icônes sont
// reconnues d'un coup d'œil par n'importe quel joueur, alors que les libellés
// alignés sur une ligne font un mur de texte et limitent le nombre de sets
// visibles sans défilement. Le nom reste en infobulle et en `aria-label`.
export default function SetFilter({
  runes,
  value,
  onChange,
  label = 'Sets',
}: {
  runes: RuneDetail[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}) {
  // Pointeur grossier (téléphone) → icônes de set agrandies pour la visée.
  const auDoigt = useMediaQuery(COMPACT);
  // Au-delà de `lg`, un filtre actif est un aplat d'accent (`ACTIF_FILTRE_LG`).
  const aLaSouris = !useMediaQuery(SOUS_LG);

  // Seulement les sets réellement présents dans l'inventaire : proposer un
  // filtre qui ne peut rien renvoyer n'aide personne.
  const present = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  // ⚠️ **Sémantique en LISTE BLANCHE** : un set coché est un set AFFICHÉ. Par
  // défaut tous les présents sont cochés (tout est montré) ; n'en cocher aucun,
  // c'est ne rien vouloir voir. Le bouton bascule entre ces deux extrêmes.
  const toutSelectionne = present.length > 0 && present.every((s) => value.has(s.key));

  const toggle = (key: string) => {
    const next = new Set(value);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="label mr-1">{label}</span>
      {/* Une SEULE barre continue plutôt que des boutons détachés : les symboles
          se lisent comme une rangée d'icônes du jeu, et l'ensemble tient sur une
          ligne même avec 25 sets. Seul l'état actif porte un cadre. */}
      {/* ⚠️ À la SOURIS, le gabarit du `Segmented` (`CADRE_FILTRE_LG`) : les
          filtres des runes tiennent sur une ligne à côté des antiques, qui en
          sont un — le mainteneur : « que les boutons aient tous la même tête ». */}
      <div className={`flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-panel p-1 coarse:gap-1 ${CADRE_FILTRE_LG}`}>
        {/* Bascule TOUT / RIEN, EN TÊTE de la grille et au même gabarit que les
            sets — comme la tuile « Tous » du jeu, pas un bouton à part greffé
            sur le côté. */}
        {present.length > 0 && (
          <button
            onClick={() => onChange(toutSelectionne ? new Set() : new Set(present.map((s) => s.key)))}
            title={toutSelectionne ? 'Tout désélectionner' : 'Tout sélectionner'}
            aria-label={toutSelectionne ? 'Tout désélectionner' : 'Tout sélectionner'}
            aria-pressed={toutSelectionne}
            data-cible-fine
            className={`flex items-center justify-center w-7 h-7 coarse:w-9 coarse:h-9 rounded-md border transition select-none ${CASE_FILTRE_LG}
              ${
                toutSelectionne
                  ? `${MARQUEUR_FILTRE_ACTIF} ${ACTIF_FILTRE_LG}`
                  : 'border-transparent opacity-50 hoverable:opacity-100 hoverable:bg-panel2'
              }`}
          >
            <Layers size={auDoigt ? 24 : 18} strokeWidth={1.75} />
          </button>
        )}
        {present.map((s) => {
          const active = value.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              title={s.label}
              aria-label={s.label}
              aria-pressed={active}
              // ⚠️ `data-cible-fine` : la règle tactile globale (40 px) ne
              // s'applique pas à cette GRILLE. Vingt-six sets à 40 px feraient
              // quatre lignes de pastilles avant le premier résultat — la
              // liste qu'on vient filtrer se retrouvait hors écran. C'est
              // l'ESPACEMENT entre cibles alignées qui évite d'activer le
              // voisin, pas leur taille.
              // ⚠️ Au DOIGT (`coarse:`), la case passe tout de même à 36 px et
              // l'icône grossit un peu : 28 px se visaient mal du pouce. À la
              // souris elles restent compactes.
              data-cible-fine
              className={`flex items-center justify-center w-7 h-7 coarse:w-9 coarse:h-9 rounded-md border transition select-none ${CASE_FILTRE_LG}
                ${
                  // ⚠️ Fond seul (voir spec/shared/design.md). La bordure reste
                  // TRANSPARENTE et non `border`, comme au repos : ces pastilles
                  // n'ont pas de contour, en faire apparaître un à la sélection
                  // ajouterait un second marqueur — c'est le fond qui parle.
                  active
                    ? `${MARQUEUR_FILTRE_ACTIF} ${ACTIF_FILTRE_LG}`
                    : 'border-transparent opacity-50 hoverable:opacity-100 hoverable:bg-panel2'
                }`}
            >
              {/* ⚠️ Taille selon le POINTEUR : 24 px au doigt (visée du pouce),
                  18 px à la souris — la taille est posée en `style` inline par
                  RuneIcon, donc un `coarse:` en `className` serait ignoré. */}
              {/* Actif à la souris, sur l'aplat d'accent : le doré du repos,
                  pas l'éclairci. Au doigt, l'actif garde un fond doux : doré
                  éclairci. */}
              <RuneIcon setKey={s.key} size={auDoigt ? 24 : 18} filter={runeSetIconFilter(active && !aLaSouris)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
