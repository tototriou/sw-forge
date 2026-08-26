import { useLayoutEffect, useRef, useState } from 'react';

// Contrôle générique à **choix unique** : des options côte à côte dans un même
// cadre, dont une seule est enfoncée.
//
// ⚠️ À préférer à une rangée de pastilles quand les options **s'excluent**. Des
// pastilles indépendantes se lisent comme des filtres cumulables : rien dans
// leur forme ne dit qu'en activer une désactive les autres. Le cadre commun le
// dit sans un mot.
//
// Il est né dans [SettingsMenu.tsx](src/components/SettingsMenu.tsx), qui a été
// le premier à en avoir besoin ; **remonté** dans `components/` au deuxième
// usage plutôt que recopié — deux copies auraient divergé, comme les chips
// d'élément avant [elementStyles.ts](src/components/elementStyles.ts) — puis ici
// dans la librairie une fois ses neuf appelants avérés.

// Rembourrage/texte d'une option, par cran. Extrait en constantes parce que la
// COPIE DE MESURE (voir le composant) doit les reproduire à l'identique : deux
// listes de classes qui divergeraient donneraient une mesure fausse, donc un
// mode compact déclenché trop tôt ou trop tard.
//
// ⚠️ `dense` NE force PAS `whitespace-nowrap` : à 4 options longues sur une
// seule ligne, même à `nano` (10 px) le texte se chevauchait faute de place —
// le libellé passe sur deux lignes plutôt que déborder. Les autres crans
// gardent `whitespace-nowrap`, ils ont la place.
const CRAN_DENSE = 'px-1 py-1 text-nano leading-tight';
const CRAN_LARGE = 'px-3 py-1.5 text-xs whitespace-nowrap';
const CRAN_PETIT = 'px-2 py-1 text-micro whitespace-nowrap';

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'sm',
  disabled = false,
  dense,
}: {
  // `disabled` par option : voir le `disabled` du contrôle entier plus bas
  // pour la distinction entre les deux axes.
  options: { key: T; label: string; hint?: string; icon?: React.ReactNode; suffix?: React.ReactNode; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  // 'lg' : chaque option se partage la largeur à égalité, sur une seule
  // ligne bien visible — pour un choix structurant (peu d'options, chacune
  // méritant d'être lue d'un coup d'œil), pas un réglage secondaire.
  // 'md' : le texte et le rembourrage de `lg`, mais SANS forcer la largeur —
  // le cadre reste à sa taille de contenu, posé au milieu d'une rangée de
  // filtres plutôt que seul sur sa ligne. Pour un choix qu'on veut plus lisible
  // à la souris, où la place ne manque pas, sans lui donner le poids visuel
  // d'un choix structurant.
  size?: 'sm' | 'md' | 'lg';
  // Un vrai `disabled` sur chaque bouton (pas juste grisé en CSS) : ni
  // cliquable ni atteignable au clavier tant qu'un réglage parent (ex. « Exclure
  // les runes déjà utilisées ») n'est pas actif — voir OptimizerSection.tsx.
  // ⚠️ AXE DISTINCT de `options[i].disabled` (voir plus haut) : CE `disabled`
  // coupe TOUT le contrôle (ex. rien à choisir du tout), quand une option
  // individuelle peut être indisponible sans que les autres le soient (ex.
  // « Monstre & équipement » de l'Optimizer — un monstre possédé en Box mais
  // jamais mis en RTA désactive SEULEMENT la puce RTA). Les deux se cumulent
  // (`disabled={disabled || o.disabled}` sur chaque bouton).
  disabled?: boolean;
  // **Une seule ligne, texte resserré.** `lg` force toutes les options sur une
  // ligne, mais à 4 options à libellé long (« Défenses siège ») dans une
  // colonne étroite, le rembourrage/texte normal les coupait. `dense` garde
  // tout sur une seule ligne, pleine largeur (jamais empilé), avec un
  // rembourrage/texte réduits (`nano`, le cran de secours des rendus
  // contraints — voir tailwind.config.js) plutôt que de passer à deux lignes.
  //
  // ⚠️ **Laisser `undefined` = AUTOMATIQUE** (le défaut, et le bon choix dans
  // presque tous les cas) : le contrôle mesure lui-même s'il tient dans la
  // place qu'on lui donne, et se resserre uniquement quand il déborderait.
  // Passer `true`/`false` FORCE le rendu — à réserver aux cas où l'on sait
  // mieux que la mesure (voir `AncientFilter.tsx`, qui resserre par cohérence
  // avec une rangée voisine, pas par manque de place).
  dense?: boolean;
}) {
  const large = size === 'lg' || size === 'md';
  // ⚠️ **Mesure de la place RÉELLEMENT disponible, pas de la largeur de la
  // FENÊTRE** — `useMediaQuery(SOUS_SM)` était utilisé pour ça avant : un
  // seuil de fenêtre (639 px) ne dit RIEN de la largeur d'un contrôle posé
  // dans une colonne qui partage son espace avec un voisin. Un sélecteur
  // pouvait déborder sur un écran 1080p (signalement direct) sans que le
  // seuil ne se déclenche jamais. Ici, `clientWidth` de la racine est la
  // place réellement reçue, quelle que soit la résolution.
  const racineRef = useRef<HTMLDivElement>(null);
  const mesureRef = useRef<HTMLDivElement>(null);
  const [serre, setSerre] = useState(false);
  const auto = dense === undefined;

  // ⚠️ `useLayoutEffect` et non `useEffect` : mesurer AVANT que le navigateur
  // peigne évite d'afficher un instant le rendu non resserré (donc débordant)
  // avant correction. Même discipline que `FlottantAuto.tsx`.
  useLayoutEffect(() => {
    if (!auto) return;
    const racine = racineRef.current;
    const mesure = mesureRef.current;
    if (!racine || !mesure) return;
    // ⚠️ Comparaison contre la COPIE DE MESURE (toujours au cran NORMAL), pas
    // contre le contenu réel : mesurer le contenu réel oscillerait sans fin
    // — une fois resserré il ne déborde plus, donc on repasserait au cran
    // normal, donc il déborderait de nouveau. La copie, elle, garde toujours
    // la même largeur naturelle, indépendante de l'état courant.
    const verifier = () => setSerre(mesure.scrollWidth > racine.clientWidth);
    verifier();
    const ro = new ResizeObserver(verifier);
    // Les DEUX : la racine (la place disponible change) ET la copie (les
    // libellés eux-mêmes peuvent changer — options remplacées, traduction).
    ro.observe(racine);
    ro.observe(mesure);
    return () => ro.disconnect();
  }, [auto]);

  const compact = dense ?? serre;

  return (
    <div
      ref={racineRef}
      // `relative` : contexte de positionnement de la copie de mesure
      // ci-dessous, qui doit sortir du flux sans peser sur la mise en page.
      className={`relative flex items-center ${
        size === 'lg' ? 'w-full gap-0' : 'gap-0.5 flex-none'
      } bg-panel2 border border-border rounded-lg p-0.5 ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      {/* ⚠️ **Copie de MESURE, jamais affichée** — sert uniquement à connaître
          la largeur NATURELLE du contrôle au cran normal (voir l'effet
          ci-dessus). `flex-none w-max` : elle rapporte sa largeur au lieu de
          la subir — une copie en `w-full`/`flex-1` PRENDRAIT la largeur de son
          parent au lieu de la RAPPORTER, ce qui, dans un conteneur `absolute`
          sans largeur propre, crée une dépendance circulaire dont le résultat
          n'est pas garanti par la spec CSS. `invisible` et non `hidden` : un
          élément non affiché n'a aucune dimension à mesurer. */}
      {auto && (
        <div
          ref={mesureRef}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 flex w-max flex-none items-center gap-0"
        >
          {options.map((o, i) => (
            <div key={o.key} className="flex flex-none items-stretch">
              {size === 'lg' && i > 0 && <span className="w-px self-stretch" />}
              <span
                className={`flex flex-none items-center justify-center gap-1.5 font-semibold ${
                  large ? CRAN_LARGE : CRAN_PETIT
                }`}
              >
                {o.icon}
                {o.label}
                {o.suffix}
              </span>
            </div>
          ))}
        </div>
      )}

      {options.map((o, i) => {
        const active = value === o.key;
        return (
          <div key={o.key} className={`flex items-stretch ${size === 'lg' ? 'flex-1' : 'flex-none'}`}>
            {/* ⚠️ Élément à part, PAS un `border-l` posé sur le bouton
                arrondi : un `border-l` sur un `rounded-md` se courbe aux
                coins au lieu de rester droit. Un trait dédié, sans rayon,
                reste rigoureusement vertical sur toute la hauteur
                (`self-stretch`). Toujours dessiné, même entre deux cases
                adjacentes dont l'une est sélectionnée. */}
            {size === 'lg' && i > 0 && <span className="w-px self-stretch bg-border" />}
            <button
              onClick={() => onChange(o.key)}
              disabled={disabled || o.disabled}
              title={o.hint}
              aria-pressed={active}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md font-semibold text-center
                          transition disabled:cursor-not-allowed ${
                            compact ? CRAN_DENSE : large ? CRAN_LARGE : CRAN_PETIT
                          } ${
                            // ⚠️ `o.disabled` (grisage PAR OPTION) s'applique
                            // même si le contrôle entier ne l'est pas — le
                            // `opacity-40` posé sur la racine (voir plus haut)
                            // ne couvre que le cas `disabled` global.
                            o.disabled
                              ? 'opacity-40 text-ink-dim'
                              : // ⚠️ Le fond SEUL marque le cran posé — pas d'ombre
                              // en plus, elle faisait décoller le bouton de son
                              // propre cadre : deux signaux pour un seul état, et
                              // une élévation qui ne veut rien dire ici (le cran
                              // ne flotte pas au-dessus du contrôle qui le
                              // contient). Voir spec/shared/design.md.
                              active
                              ? 'bg-accent-soft text-ink'
                              : 'text-ink-dim hoverable:text-ink'
                          }`}
            >
              {o.icon}
              {o.label}
              {/* Après le libellé : un effectif se lit APRÈS ce qu'il compte
                  (« Importées 3 »), là où une icône se lit avant. */}
              {o.suffix}
            </button>
          </div>
        );
      })}
    </div>
  );
}
