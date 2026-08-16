import { ReactNode } from 'react';
import { LogOut } from 'lucide-react';

// Barre SUPÉRIEURE, fixe.
//
// ⚠️ Trois zones, trois rôles :
//   — à gauche, l'IDENTITÉ (le logo, qui ramène à l'accueil) ;
//   — au centre, OÙ L'ON EST — la section courante ;
//   — à droite, ce qui SORT (aujourd'hui l'effacement des données ; demain la
//     déconnexion, quand les comptes vivront en base).
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
// disposition, il se serait décalé dès que la zone de droite change de largeur
// (un bouton de plus, un libellé plus long). Un repère qui bouge n'en est plus
// un.

export default function TopBar({
  titre,
  icone,
  gauche,
  onDeconnexion,
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
  onDeconnexion: () => void;
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
      className="fixed right-0 top-0 z-20 h-12 border-b border-border bg-panel
                 transition-[left] duration-[180ms]"
      style={{ left: `var(--top-left, 0px)`, ['--top-left' as string]: `${decalage}px` }}
    >
      <div className="relative flex h-full items-center gap-3 px-3">
        <div className="flex min-w-0 items-center gap-2">{gauche}</div>

        {/* ⚠️ `pointer-events-none` : le titre couvre toute la largeur pour
            rester centré, et capterait sinon les clics destinés aux boutons
            qu'il recouvre. */}
        <span
          className="pointer-events-none absolute inset-x-0 flex items-center justify-center
                     gap-2 font-display text-[15px] tracking-wide text-ink"
        >
          {icone && <span className="flex-none text-ctx">{icone}</span>}
          {titre}
        </span>

        <button
          type="button"
          onClick={onDeconnexion}
          title="Effacer mes données de cet appareil"
          className="relative z-10 ml-auto flex items-center gap-1.5 rounded-md px-2 py-1.5
                     text-[13px] text-ink-dim transition-colors
                     hoverable:bg-panel2 hoverable:text-bad"
        >
          <LogOut size={16} className="flex-none" />
          {/* Le libellé tombe sous `sm` : trois zones plus un mot ne tiennent
              pas sur 380 px, et l'icône de sortie se reconnaît seule. */}
          <span className="hidden sm:inline">Se déconnecter</span>
        </button>
      </div>
    </header>
  );
}
