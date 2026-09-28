import { Fragment, ReactNode } from 'react';
import { ChevronRight, LogOut, Search, Settings } from 'lucide-react';
import { Bouton } from '../ui';

// Barre SUPÉRIEURE, fixe.
//
// ⚠️ **Trois zones, et rien de plus** : à gauche le menu des actions de la page
// (mobile) ou l'identité, OÙ L'ON EST au centre, les PARAMÈTRES à droite.
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
  fil,
  gauche,
  onDeconnexion,
  parametresActifs,
  onToggleParametres,
  onRecherche,
  // Bord GAUCHE de la barre : celui de la barre latérale, qu'elle ne recouvre
  // pas. ⚠️ Piloté par l'appelant, qui seul sait si elle est repliée.
  decalage,
}: {
  titre: string;
  // Icône de la section, la MÊME que dans la barre latérale : c'est elle qu'on
  // a cliquée, la retrouver ici confirme qu'on est au bon endroit. Elle prend
  // l'accent contextuel, comme partout ailleurs.
  icone?: ReactNode;
  // Fil d'Ariane du BUREAU (groupe › section › sous-section), qui y remplace
  // `titre` et `icone`. Tiré du menu bureau par l'appelant.
  fil?: string[];
  gauche?: ReactNode;
  // Efface les données de l'appareil — « Se déconnecter » en attendant que les
  // comptes vivent en base. ⚠️ Bureau seulement (voir plus bas).
  onDeconnexion: () => void;
  parametresActifs: boolean;
  // ⚠️ Le bouton BASCULE : il ouvre les paramètres, puis ramène d'où l'on
  // vient. Un lien seul n'offrait aucune sortie — on y entrait sans pouvoir en
  // revenir autrement qu'en choisissant une autre destination.
  onToggleParametres: () => void;
  // Ouvre la palette Ctrl K (lot 13, décision 29). Au TÉLÉPHONE seulement, par
  // une loupe : sans clavier, c'est son seul accès. Au bureau, le champ de la
  // barre latérale et Ctrl K suffisent.
  onRecherche?: () => void;
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
      // ⚠️ La barre DESCEND sous l'encoche : sa hauteur s'ajoute à
      // `safe-area-inset-top`, et son contenu se décale d'autant. Sans cela,
      // le titre et les boutons passaient sous l'encoche d'un iPhone.
      // Fond `bar` : celui des barres de l'application (rebranding, décision 5).
      className="fixed inset-x-0 top-0 z-20 border-b border-border bg-bar
                 lg:left-[var(--top-left)] lg:right-0 lg:transition-[left] lg:duration-[180ms]"
      style={{
        ['--top-left' as string]: `${decalage}px`,
        height: 'calc(3rem + env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* ⚠️ `pr-2.5` à droite contre `pl-3` à gauche : le bouton de paramètres
          a son propre padding interne (32 px de cible pour une icône de 16),
          alors que le logo à gauche n'en a pas. Un padding égal des deux côtés
          l'aurait visuellement décollé du bord. */}
      <div className="relative flex h-full items-center gap-3 pl-3 pr-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {gauche}
        </div>

        {/* TÉLÉPHONE — OÙ L'ON EST, à gauche, sur deux lignes (refonte
            graphique, lot 11a, décision 24, la maquette) : la section en petit
            (« Jouer · RTA », « Mon compte · Runes »), la page dessous (« Ma
            prépa », « Liste »). Il était centré, en Cinzel, avec l'icône de la
            section : il ne disait que la page, pas où elle se range.
            ⚠️ Tiré du MÊME fil que le bureau (`fil`, construit depuis le menu),
            jamais ressaisi. Sans fil, le titre seul.
            ⚠️ `lg:hidden` : sur bureau, c'est le fil d'Ariane ci-dessous. */}
        {(() => {
          const chemin = fil && fil.length > 0 ? fil : [titre];
          const page = chemin[chemin.length - 1];
          const section = chemin.slice(0, -1).join(' · ');
          return (
            <div className="flex min-w-0 flex-col leading-tight lg:hidden">
              {section && <span className="truncate text-micro text-ink-dimmer">{section}</span>}
              <span className="truncate text-sm font-semibold text-ink">{page}</span>
            </div>
          );
        })()}

        {/* BUREAU — le FIL D'ARIANE, à gauche, comme dans la maquette : le
            chemin du menu jusqu'à la page (« Mon compte › Runes › Liste »),
            en police de texte, sans icône. Relevé par Thomas : le titre
            centré (Cinzel, icône colorée) « n'est pas raccord avec le menu ».
            ⚠️ Construit par l'appelant À PARTIR DU MENU lui-même, jamais
            ressaisi : le fil ne peut pas contredire la barre latérale. */}
        {fil && fil.length > 0 && (
          <nav aria-label="Fil d'Ariane" className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
            {fil.map((etape, i) => (
              <Fragment key={i}>
                {i > 0 && <ChevronRight size={14} aria-hidden className="flex-none text-ink-dimmer" />}
                <span
                  aria-current={i === fil.length - 1 ? 'page' : undefined}
                  className={`truncate ${i === fil.length - 1 ? 'font-semibold text-ink' : 'text-ink-dim'}`}
                >
                  {etape}
                </span>
              </Fragment>
            ))}
          </nav>
        )}

        {/* ⚠️ **Zone droite : un contenu par format, et strictement un.**

            BUREAU — « Se déconnecter » seule. Le ⚙ en a été retiré : le pied de
            la barre latérale en porte déjà un, à côté du nom du compte et de
            l'import (voir SidebarCompte). Deux chemins vers le même écran, à
            60 px l'un de l'autre, se lisent comme deux réglages différents — et
            c'est dans le bloc compte que celui-ci a sa place.

            MOBILE — le ⚙ seul, parce qu'il n'y a pas de barre latérale et
            qu'aucun onglet ne mène aux paramètres : c'est le seul accès. La
            déconnexion et l'import y descendent, faute de place — trois cibles
            dans 48 px de haut, à côté d'un titre centré, ne laissaient à chacune
            ni la marge d'erreur qu'un doigt réclame. */}
        {/* Bouton de la librairie (décision 16) : la hauteur commune des
            boutons de l'app, ton `danger` qui ne rougit qu'au survol. */}
        <Bouton
          onClick={onDeconnexion}
          title="Effacer mes données de cet appareil"
          ton="danger"
          fond="vide"
          trait="aucun"
          icone={<LogOut size={16} className="flex-none" />}
          libelle="Se déconnecter"
          className="relative z-10 ml-auto hidden lg:inline-flex"
        />

        {/* TÉLÉPHONE — la loupe de la palette Ctrl K (lot 13, décision 29, la
            maquette), juste avant le ⚙. Même gabarit que lui. */}
        {onRecherche && (
          <button
            type="button"
            onClick={onRecherche}
            title="Rechercher une page, un monstre, une action"
            aria-label="Rechercher"
            className="relative z-10 ml-auto flex aspect-square h-8 w-8 items-center justify-center rounded-md
                       text-ink-dim transition-colors hoverable:bg-panel2 hoverable:text-ink lg:hidden"
          >
            <Search size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleParametres}
          title={parametresActifs ? 'Fermer les paramètres' : 'Paramètres'}
          aria-label={parametresActifs ? 'Fermer les paramètres' : 'Paramètres'}
          aria-pressed={parametresActifs}
          // ⚠️ `lg:hidden` : sur bureau, le pied de la barre latérale porte le
          // même accès, à côté du nom du compte. Le garder ici aurait fait deux
          // boutons pour un seul écran.
          // ⚠️ `ml-auto` seulement sans loupe : avec elle, c'est la loupe qui
          // pousse la paire à droite ; deux `ml-auto` se partageraient la place.
          className={`relative z-10 ${onRecherche ? '' : 'ml-auto'} flex aspect-square h-8 w-8 items-center justify-center
                      rounded-md transition-colors lg:hidden ${
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
