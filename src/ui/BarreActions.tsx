import { Fragment, ReactNode, useLayoutEffect, useRef, useState } from 'react';
import Bouton from './Bouton';
import Menu, { ElementMenu, HAUTEUR_EN_TETE } from './Menu';

// BARRE D'ACTIONS d'un en-tête d'écran : TOUTES les actions en boutons quand
// elles tiennent sur la ligne, sinon les actions `toujours` + un menu « ⋯ »
// pour les autres.
//
// ⚠️ Demandé par Thomas (RTA, lot 6) : « sur PC, afficher ces boutons si on a
// la place ». Le menu cachait derrière un clic des actions qu'un grand écran
// pouvait montrer d'emblée.
//
// ⚠️ **On MESURE la place, on ne devine pas d'après la largeur d'écran.** La
// place dépend aussi de la barre latérale (dépliée : 248 px, repliée : 56) et
// du titre de l'écran. Un point de rupture fixe se tromperait dans un sens ou
// dans l'autre : menu sur un 1920 px à barre dépliée qui avait la place, ou
// boutons qui débordent sur un 1440 px.
//
// Mécanique : une COPIE invisible de la rangée complète (hors flux, `inert`,
// masquée aux lecteurs d'écran) donne la largeur qu'il faudrait ; on la compare
// à la place disponible, et on la recompare à chaque redimensionnement.
// ⚠️ La copie n'est rendue qu'APRÈS le montage : en rendu serveur, et au tout
// premier rendu, c'est le menu — la forme qui tient partout. Le basculement a
// lieu dans un `useLayoutEffect`, donc avant la première peinture : rien ne
// saute à l'écran.
//
// ⚠️ Mêmes entrées dans les deux formes (`ElementMenu`) : libellé, icône,
// désactivation et sa raison, `danger`. Aucune action n'existe que dans l'une.

export interface BarreActionsProps {
  // Toujours visibles, à gauche du « ⋯ » quand le menu est là (« Exporter »).
  toujours: ElementMenu[];
  // Les autres : en boutons s'il y a la place, sinon dans le menu. Les entrées
  // `danger` passent en dernier, derrière un filet, dans les deux formes.
  autres: ElementMenu[];
  libelleMenu: string;
}

export default function BarreActions({ toujours, autres, libelleMenu }: BarreActionsProps) {
  const zone = useRef<HTMLDivElement>(null);
  const copie = useRef<HTMLDivElement>(null);
  const [monte, setMonte] = useState(false);
  const [enLigne, setEnLigne] = useState(false);

  useLayoutEffect(() => setMonte(true), []);

  useLayoutEffect(() => {
    if (!monte || !zone.current || !copie.current) return;
    const mesurer = () => {
      if (!zone.current || !copie.current) return;
      setEnLigne(copie.current.scrollWidth <= zone.current.clientWidth);
    };
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(zone.current);
    return () => ro.disconnect();
  }, [monte, toujours, autres]);

  const rangee = (
    <Rangee elements={[...toujours, ...autres.filter((e) => !e.danger)]} danger={autres.filter((e) => e.danger)} />
  );

  return (
    // `flex-1 min-w-0` : la zone prend toute la place laissée par le titre —
    // c'est CETTE largeur qu'on compare à la rangée complète.
    <div ref={zone} className="relative flex min-w-0 flex-1 items-center justify-end">
      {monte && (
        <div
          ref={copie}
          aria-hidden
          // `inert` : la copie n'est ni focusable ni cliquable. Chaîne vide et
          // non booléen : React 18 ne connaît pas encore l'attribut.
          {...{ inert: '' }}
          className="pointer-events-none invisible absolute right-0 top-0 flex whitespace-nowrap"
        >
          {rangee}
        </div>
      )}
      {enLigne ? (
        rangee
      ) : (
        <div className="flex flex-none items-center gap-2">
          {toujours.map((e) => (
            <BoutonAction key={e.cle} e={e} />
          ))}
          <Menu libelle={libelleMenu} elements={autres} />
        </div>
      )}
    </div>
  );
}

function Rangee({ elements, danger }: { elements: ElementMenu[]; danger: ElementMenu[] }) {
  return (
    <div className="flex flex-none items-center gap-2">
      {elements.map((e) => (
        <BoutonAction key={e.cle} e={e} />
      ))}
      {danger.length > 0 && (
        <>
          {/* Le filet sépare les gestes qui perdent quelque chose — comme dans
              le menu. */}
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          {danger.map((e) => (
            <Fragment key={e.cle}>
              <BoutonAction e={e} />
            </Fragment>
          ))}
        </>
      )}
    </div>
  );
}

function BoutonAction({ e }: { e: ElementMenu }) {
  return (
    <Bouton
      onClick={e.onClick}
      disabled={e.disabled}
      title={e.title}
      aria-label={e['aria-label']}
      icone={e.icone}
      libelle={e.libelle as ReactNode}
      // Principal : l'aplat d'accent (décision 4). À deux états : le fond
      // d'accent quand il est enclenché, `aria-pressed` — comme partout.
      ton={e.danger ? 'danger' : e.principal || e.actif ? 'accent' : 'neutre'}
      // ⚠️ Principal ET à deux états (« Vérifier mes speed ») : plein tant
      // qu'il est éteint ; enclenché, le fond doux d'accent de tout bouton
      // actif (le `Bouton` l'impose).
      fond={e.principal && !e.actif ? 'plein' : undefined}
      actif={e.actif || undefined}
      className={HAUTEUR_EN_TETE}
    />
  );
}
