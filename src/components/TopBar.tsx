import { ReactNode } from 'react';
import { Settings } from 'lucide-react';

// Barre SUPÉRIEURE, fixe.
//
// ⚠️ **Trois zones, et rien de plus** : l'identité à gauche, OÙ L'ON EST au
// centre, les PARAMÈTRES à droite.
//
// Elle a d'abord porté l'import et la déconnexion. Ni l'un ni l'autre n'y
// avait sa place : ce sont des gestes RARES, et la barre est ce qu'on lit en
// permanence. Ils vivent dans les paramètres, où l'on va justement quand on
// veut changer quelque chose — l'import y côtoie l'état du compte, la
// suppression des données y côtoie le réglage de conservation.
//
// ⚠️ **Fixe, et elle COMMENCE après la barre latérale** — elle ne la surplombe
// pas. La barre latérale est la navigation principale : la couper d'un bandeau
// horizontal la ferait passer pour un panneau secondaire. La barre du haut
// appartient au CONTENU, dont elle annonce la section.
//
// C'est le seul repère qui ne bouge jamais en défilant : une barre qui
// disparaît oblige à remonter pour savoir où l'on est.
//
// ⚠️ Le titre est **au centre en absolu**, pas dans le flux : centré par la
// disposition, il se serait décalé dès que la zone de droite change de largeur.
// Un repère qui bouge n'en est plus un.

export default function TopBar({
  titre,
  icone,
  gauche,
  parametresActifs,
  onToggleParametres,
  // Bord GAUCHE de la barre : celui de la barre latérale, qu'elle ne recouvre
  // pas. ⚠️ Piloté par l'appelant, qui seul sait si elle est repliée.
  decalage,
}: {
  titre: string;
  // Icône de la section, la MÊME que dans la barre latérale : c'est elle qu'on
  // a cliquée, la retrouver ici confirme qu'on est au bon endroit. Elle prend
  // l'accent contextuel, comme partout ailleurs.
  icone?: ReactNode;
  gauche?: ReactNode;
  parametresActifs: boolean;
  // ⚠️ Le bouton BASCULE : il ouvre les paramètres, puis ramène d'où l'on
  // vient. Un lien seul n'offrait aucune sortie — on y entrait sans pouvoir en
  // revenir autrement qu'en choisissant une autre destination.
  onToggleParametres: () => void;
  decalage: number;
}) {
  return (
    <header
      // ⚠️ `left` suit la barre latérale, à la MÊME durée qu'elle : les deux
      // doivent bouger ensemble, sinon on voit un trou apparaître puis se
      // combler au repli.
      // `z-20` — SOUS la barre latérale (`z-30`) : elle passe devant, c'est
      // elle la navigation principale.
      // ⚠️ Fond OPAQUE, pas de flou : le contenu qu'on devinait derrière ne
      // disait rien d'utile et brouillait le titre par transparence. Une barre
      // de repère doit se lire net.
      // ⚠️ `left` en CLASSE, pas en style inline : le décalage ne vaut qu'à
      // partir de `lg`. En inline il s'appliquait à TOUTES les largeurs, et sur
      // mobile — où la barre latérale n'existe pas — la barre partait 224 px
      // hors écran : le titre disparaissait à droite et le bouton de
      // déconnexion devenait inatteignable.
      className="fixed inset-x-0 top-0 z-20 h-12 border-b border-border bg-panel
                 lg:left-[var(--top-left)] lg:right-0 lg:transition-[left] lg:duration-[180ms]"
      style={{ ['--top-left' as string]: `${decalage}px` }}
    >
      {/* ⚠️ `pr-2.5` à droite contre `pl-3` à gauche : le bouton de paramètres
          a son propre padding interne (32 px de cible pour une icône de 16),
          alors que le logo à gauche n'en a pas. Un padding égal des deux côtés
          l'aurait visuellement décollé du bord. */}
      <div className="relative flex h-full items-center gap-3 pl-3 pr-2.5">
        <div className="flex min-w-0 items-center gap-2">{gauche}</div>

        {/* ⚠️ `pointer-events-none` : le titre couvre toute la largeur pour
            rester centré, et capterait sinon les clics destinés aux boutons
            qu'il recouvre. */}
        <span
          // ⚠️ Marges LATÉRALES sur le titre, pas `inset-x-0` : centré sur toute
          // la largeur, il passait SOUS le bouton — le ⚙ chevauchait « RTA »
          // sur mobile. 56 px réservés à droite (la cible de 32 px plus sa
          // gouttière), 60 px à gauche pour le logo. Au-dessus de `lg` le logo
          // vit dans la barre latérale : la marge gauche retombe à celle du
          // conteneur. `truncate` finit le travail sur « Recommandations ».
          className="pointer-events-none absolute inset-y-0 left-[60px] right-[56px] flex
                     items-center justify-center gap-2 font-display text-[15px]
                     tracking-wide text-ink lg:left-3"
        >
          {icone && <span className="flex-none text-ctx">{icone}</span>}
          <span className="truncate">{titre}</span>
        </span>

        {/* ⚠️ Les PARAMÈTRES seuls. C'est le seul geste qui mérite d'être
            atteignable depuis n'importe quel écran sans passer par la
            navigation — tout le reste y est déjà. */}
        <button
          type="button"
          onClick={onToggleParametres}
          title={parametresActifs ? 'Fermer les paramètres' : 'Paramètres'}
          aria-label={parametresActifs ? 'Fermer les paramètres' : 'Paramètres'}
          aria-pressed={parametresActifs}
          className={`relative z-10 ml-auto flex h-8 w-8 items-center justify-center rounded-md
                      transition-colors ${
                        parametresActifs
                          ? 'bg-ctx-soft text-ctx'
                          : 'text-ink-dim hoverable:bg-panel2 hoverable:text-ink'
                      }`}
        >
          {/* L'engrenage pivote d'un huitième de tour quand les paramètres sont
              ouverts : le bouton dit alors qu'il fera l'inverse au prochain
              clic, sans changer d'icône — une croix aurait fait croire à une
              fermeture de la page entière. */}
          <Settings
            size={16}
            className={`transition-transform ${parametresActifs ? 'rotate-45' : ''}`}
          />
        </button>
      </div>
    </header>
  );
}
