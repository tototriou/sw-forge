import { Fragment, ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronRight, Lock, LockOpen, SlidersHorizontal, X } from 'lucide-react';
import { Bouton, BoutonIcone } from '../ui';
import { LargeurVolet } from '../hooks/useMediaQuery';
import { palierContenu, SEUIL_CONTENU_BUREAU } from '../lib/volets';
import { useTraduction } from '../hooks/useLangue';

// Un volet de l'écran partagé : son en-tête, puis la page, qui défile seule
// (docs/02-app/transverse/feat-navigation/ecran-partage.md).
//
// ⚠️ **Le volet se rend ACTIF dès qu'on y entre** — un appui (souris, stylet)
// ou le focus clavier, en phase de CAPTURE : il l'est donc avant que le clic
// ne parvienne à un lien de la page, et ce lien navigue dans CE volet. Un
// dialogue ouvert depuis la page passe aussi par ici (les événements React
// remontent à travers les portails) : il appartient au volet qui l'a ouvert.
//
// ⚠️ **Le volet actif se marque d'UN contour d'accent**, qui remplace le
// contour neutre au lieu de s'y ajouter (un contour, 1 px), et d'une pastille
// dans son en-tête. Le fil d'Ariane du volet remplace celui de la barre du
// haut : deux fils pour une même page se liraient comme deux pages.
//
// ⚠️ **La page se met en page selon le VOLET, pas la fenêtre.** Le corps est
// le conteneur CSS `volet` (`data-volet`, voir scripts/lib/postcssVolets.ts),
// et sa largeur, arrondie au dernier seuil franchi, est donnée à
// `useMediaQuery` : la page ne se redessine qu'en franchissant un seuil, pas à
// chaque pixel quand on glisse le séparateur.
//
// ⚠️ **Un volet ÉTROIT porte « Options » dans son en-tête.** Sous le seuil de
// bureau, la page prend sa mise en page de téléphone, qui range ses actions
// dans le panneau « Options » ; au téléphone, il s'ouvre depuis la barre
// d'onglets du bas, qui n'existe pas au bureau. Le bouton y prend sa place.

export interface VoletEcranProps {
  fil: string[];
  actif: boolean;
  verrouille: boolean;
  /** L'autre volet est verrouillé : un seul verrou à la fois. */
  verrouIndisponible: boolean;
  /** Un volet vide n'a rien à verrouiller : pas de cadenas. */
  vide?: boolean;
  onActiver: () => void;
  onVerrouiller: () => void;
  onInverser: () => void;
  onFermer: () => void;
  /** Ouvre ou ferme le panneau « Options » de la page ; absent si elle n'en a pas. */
  onOptions?: () => void;
  optionsOuvertes?: boolean;
  /** Le corps qui défile : remis en haut à chaque changement de page du volet. */
  corpsRef?: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}

// La largeur du CONTENU (marges intérieures retirées), comme la lit une
// requête `@container`.
function largeurContenu(el: HTMLElement): number {
  const s = getComputedStyle(el);
  return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
}

export default function VoletEcran({
  fil,
  actif,
  verrouille,
  verrouIndisponible,
  vide = false,
  onActiver,
  onVerrouiller,
  onInverser,
  onFermer,
  onOptions,
  optionsOuvertes = false,
  corpsRef,
  children,
}: VoletEcranProps) {
  const t = useTraduction().ecranPartage;
  const page = fil[fil.length - 1] ?? '';
  // Avant toute mesure (et au rendu serveur) : le seuil de bureau, la largeur
  // d'un volet à 50/50 sur la plupart des écrans de bureau.
  const [palier, setPalier] = useState(() => palierContenu(SEUIL_CONTENU_BUREAU));
  const etroit = palier < SEUIL_CONTENU_BUREAU;
  const corps = useRef<HTMLDivElement | null>(null);
  const brancherCorps = useCallback(
    (el: HTMLDivElement | null) => {
      corps.current = el;
      corpsRef?.(el);
    },
    [corpsRef]
  );

  useLayoutEffect(() => {
    const el = corps.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => setPalier(palierContenu(largeurContenu(el)));
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      aria-label={t.volet(actif, page)}
      data-volet-actif={actif || undefined}
      onPointerDownCapture={onActiver}
      onFocusCapture={onActiver}
      className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-bg ${
        actif ? 'border-accent' : 'border-border-soft'
      }`}
    >
      <div className="flex h-9 flex-none items-center gap-2 border-b border-border-soft bg-bar pl-3 pr-1.5">
        <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${actif ? 'bg-accent' : 'bg-border'}`} />
        <nav aria-label={t.filAriane} className="flex min-w-0 items-center gap-1.5 text-sm">
          {fil.map((etape, i) => (
            <Fragment key={i}>
              {i > 0 && <ChevronRight size={13} aria-hidden className="flex-none text-ink-dimmer" />}
              <span
                aria-current={actif && i === fil.length - 1 ? 'page' : undefined}
                className={`truncate ${i === fil.length - 1 ? 'font-semibold text-ink' : 'text-ink-dim'}`}
              >
                {etape}
              </span>
            </Fragment>
          ))}
        </nav>
        {verrouille && <span className="flex-none text-xs text-ink-dim">{t.verrouille}</span>}
        <div className="ml-auto flex flex-none items-center gap-0.5">
          {etroit && onOptions && (
            <Bouton
              taille="sm"
              fond="vide"
              trait="aucun"
              actif={optionsOuvertes}
              icone={<SlidersHorizontal size={15} className="flex-none" />}
              libelle={t.options}
              title={t.optionsAide}
              onClick={onOptions}
            />
          )}
          {!vide && (
            <BoutonIcone
              icone={verrouille ? <Lock size={15} /> : <LockOpen size={15} />}
              libelle={
                verrouille ? t.deverrouiller : verrouIndisponible ? t.unSeulVerrou : t.verrouiller
              }
              actif={verrouille}
              aria-pressed={verrouille}
              disabled={verrouIndisponible}
              onClick={onVerrouiller}
            />
          )}
          <BoutonIcone icone={<ArrowLeftRight size={15} />} libelle={t.inverser} onClick={onInverser} />
          <BoutonIcone
            icone={<X size={15} />}
            libelle={verrouille ? t.deverrouillerPourFermer : t.fermer}
            disabled={verrouille}
            onClick={onFermer}
          />
        </div>
      </div>
      <div
        ref={brancherCorps}
        data-volet=""
        // ⚠️ Pas d'`overflow-x-hidden` : un débordement horizontal est un
        // défaut de mise en page, à corriger ; masqué, il couperait la page.
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-5 [container-name:volet] [container-type:inline-size]"
      >
        <LargeurVolet.Provider value={palier}>{children}</LargeurVolet.Provider>
      </div>
    </section>
  );
}
