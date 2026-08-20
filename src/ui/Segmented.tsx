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
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'sm',
  disabled = false,
  dense = false,
}: {
  options: { key: T; label: string; hint?: string; icon?: React.ReactNode; suffix?: React.ReactNode }[];
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
  disabled?: boolean;
  // ⚠️ **Une seule ligne, texte resserré.** `lg` force toutes les options
  // sur une ligne, mais avec 4 options à libellé long (« Défenses siège »)
  // dans un panneau mobile resserré, le rembourrage/texte normal de `lg`
  // les coupait. `dense` garde tout sur une seule ligne, pleine largeur
  // (jamais empilé), avec un rembourrage/texte réduits (`nano`, le cran de
  // secours des rendus contraints — voir tailwind.config.js) plutôt que de
  // passer à deux lignes.
  dense?: boolean;
}) {
  const large = size === 'lg' || size === 'md';
  return (
    <div
      className={`flex items-center ${
        size === 'lg' ? 'w-full gap-0' : 'gap-0.5 flex-none'
      } bg-panel2 border border-border rounded-lg p-0.5 ${disabled ? 'opacity-40' : ''} ${className}`}
    >
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
              disabled={disabled}
              title={o.hint}
              aria-pressed={active}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md font-semibold text-center
                          transition disabled:cursor-not-allowed ${
                            // ⚠️ `dense` NE force PAS `whitespace-nowrap` : à 4
                            // options longues sur une seule ligne, même à
                            // `nano` (10 px) le texte se chevauchait faute de
                            // place — le libellé passe sur deux lignes plutôt
                            // que déborder. Les trois autres tailles gardent
                            // `whitespace-nowrap`, elles ont la place.
                            dense
                              ? 'px-1 py-1 text-nano leading-tight'
                              : large
                                ? 'px-3 py-1.5 text-xs whitespace-nowrap'
                                : 'px-2 py-1 text-micro whitespace-nowrap'
                          } ${
                            // ⚠️ Le fond SEUL marque le cran posé — pas d'ombre
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
