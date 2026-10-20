import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import OngletsColonnes from './OngletsColonnes';
import {
  agencementBureau, basculerColonne, colonnesAffichees, colonnesParDefaut, deuxColonnesTiennent, ouvrirColonne,
  type ColonneRepliable, type ColonnesOuvertes,
} from '../../../../lib/optimizerColonnes';

// La page de l'Optimizer au format bureau (docs/02-app/optimizer/ecran/README.md,
// « Mise en page d'ensemble », « Ordre d'usage et grille », « Placement et
// adaptation à la largeur ») : les essentiels, le contrôle à onglets, les deux
// colonnes repliables et la colonne de droite. Le format (téléphone ou
// bureau) est choisi par l'app avant d'arriver ici ; cette page ne sert qu'au
// bureau.
//
// ⚠️ **L'agencement se choisit sur la largeur du CONTENEUR**, jamais de la
// fenêtre : la racine porte `@container` (`container-type: inline-size`, sans
// nom), et chaque bascule est une requête de conteneur posée sur un enfant
// direct de la grille ou de ses groupes, sans autre conteneur entre eux et la
// racine. Mêmes seuils que `SEUILS_BUREAU` (src/lib/optimizerColonnes.ts),
// écrits en littéraux parce que Tailwind ne lit que le source :
// - A1 [728, 904[ : une colonne — essentiels, onglets, colonne repliable
//   ouverte (ses cartes deux à deux), colonne de droite ;
// - A2 [904, 1180[ : essentiels à gauche ; à leur droite, les onglets puis la
//   colonne repliable ouverte (cartes empilées) ; la colonne de droite dessous,
//   sur toute la largeur ;
// - A3 dès 1180 : essentiels à gauche, onglets en haut à leur droite ; dessous,
//   la colonne repliable ouverte, INSÉRÉE avant la colonne de droite là où elle
//   tient avec « Exemplaire » (« Artéfacts » dès 1516, « Aura… » dès 1536), en
//   PANNEAU SUPERPOSÉ aux résultats sinon (marge négative de sa largeur : elle
//   ne prend aucune place, rien ne bouge dessous).
//
// ⚠️ **En A3, essentiels, onglets et colonnes repliables restent fixes**
// (`sticky`) pendant que la colonne de droite défile avec la page ; plus hauts
// que la partie visible, ils défilent dans leur propre colonne. Le haut et la
// hauteur visibles se mesurent (`useColle`) : la page défile dans la fenêtre,
// sous la barre du haut, ou dans son volet de l'écran partagé.
//
// ⚠️ **Le contrôle à onglets ne bouge jamais au clic** : il a sa propre rangée,
// la colonne s'ouvre dessous (A2, A3) ou après lui (A1).

// La partie haute que la barre fixe de l'app couvre quand la page défile dans
// la fenêtre (App.tsx : barre de 48 px, contenu posé à 68 px) ; dans un volet,
// c'est le rembourrage haut de la zone qui défile.
const HAUT_PAGE = 68;
// Ce qui reste libre sous une colonne fixe, au bas de la partie visible.
const MARGE_BAS = 16;
// L'espace entre le bord de la partie visible (barre du haut, haut du volet)
// et le haut collé (68 − 48 en pleine page, le rembourrage de 20 du volet) :
// en A3, la rangée des onglets le couvre de son fond (`-mt-5 pt-5`), pour que
// rien de ce qui défile n'y paraisse au-dessus d'elle.
const DESSUS = 20;

interface Colle {
  largeur: number | null;
  style: CSSProperties;
}

function parentQuiDefile(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

// La largeur du conteneur (la même que lisent les requêtes de conteneur), et
// les cotes des colonnes fixes de A3, en variables CSS sur la racine.
function useColle(racine: RefObject<HTMLDivElement>, onglets: RefObject<HTMLDivElement>): Colle {
  const [colle, setColle] = useState<Colle>({ largeur: null, style: {} });
  useLayoutEffect(() => {
    const el = racine.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const defile = parentQuiDefile(el);
    const mesurer = () => {
      const largeur = el.getBoundingClientRect().width;
      const haut = defile ? parseFloat(getComputedStyle(defile).paddingTop) || 0 : HAUT_PAGE;
      // `innerHeight` et non `documentElement.clientHeight`, qui vaut la
      // hauteur du document hors mode standard.
      const visible = defile ? defile.clientHeight : window.innerHeight;
      const rangeeOnglets = onglets.current?.offsetHeight ?? 0;
      setColle((avant) => {
        const style = {
          '--colle-haut': `${haut}px`,
          '--colle-onglets': `${haut - DESSUS}px`,
          '--colle-colonnes': `${haut - DESSUS + rangeeOnglets}px`,
          '--hauteur-essentiels': `${Math.max(0, visible - haut - MARGE_BAS)}px`,
          '--hauteur-colonnes': `${Math.max(0, visible - haut + DESSUS - rangeeOnglets - MARGE_BAS)}px`,
        } as CSSProperties;
        const meme = avant.largeur === largeur && JSON.stringify(avant.style) === JSON.stringify(style);
        return meme ? avant : { largeur, style };
      });
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    if (defile) obs.observe(defile);
    if (onglets.current) obs.observe(onglets.current);
    window.addEventListener('resize', mesurer);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, [racine, onglets]);
  return colle;
}

export interface PageBureauProps {
  // Au-dessus de la page (bandeau et phrase d'introduction, jusqu'à leur
  // retrait).
  entete?: ReactNode;
  // Les essentiels, de haut en bas : liste de travail, set de runes, puis
  // Conditions et, à leur droite, les principales et l'état du monstre.
  liste: ReactNode;
  set: ReactNode;
  conditions: ReactNode;
  principales: ReactNode;
  etat: ReactNode;
  // « Artéfacts et relique » : la carte, puis « Meilleurs artéfacts » (absente
  // tant qu'il n'y a rien à proposer).
  artefacts: ReactNode;
  meilleurs: ReactNode;
  // « Aura, exclusion, avancés ».
  auras: ReactNode;
  exclusion: ReactNode;
  avances: ReactNode;
  // La colonne de droite : exemplaire, objectif, résultats.
  droite: ReactNode;
  // L'état des onglets : `null` tant que l'utilisateur n'y a pas touché (l'état
  // de départ suit alors la largeur, `colonnesParDefaut`).
  colonnes: ColonnesOuvertes | null;
  onColonnes: (suivant: ColonnesOuvertes) => void;
  // Ouvrir « Aura, exclusion, avancés » depuis ailleurs (guidage vers
  // l'interrupteur des auras RES/PRE) : chaque nouvelle valeur l'ouvre, sans
  // jamais la refermer.
  guideComplements?: number | null;
}

// Une colonne repliable en A3 : fixe, à défilement propre, superposée sous son
// seuil d'insertion. Les classes sont écrites en entier pour Tailwind.
const COLONNE_A3: Record<ColonneRepliable, string> = {
  artefacts:
    '@[1180px]:sticky @[1180px]:top-[var(--colle-colonnes)] @[1180px]:max-h-[var(--hauteur-colonnes)] @[1180px]:data-[defile]:overflow-y-auto'
    + ' @[1180px]:w-[336px] @[1180px]:-mr-[336px] @[1180px]:z-20 @[1180px]:bg-bg @[1180px]:shadow-glow @[1180px]:shadow-black/60'
    + ' @[1516px]:mr-0 @[1516px]:z-auto @[1516px]:shadow-none',
  complements:
    '@[1180px]:sticky @[1180px]:top-[var(--colle-colonnes)] @[1180px]:max-h-[var(--hauteur-colonnes)] @[1180px]:data-[defile]:overflow-y-auto'
    + ' @[1180px]:w-[356px] @[1180px]:-mr-[356px] @[1180px]:z-20 @[1180px]:bg-bg @[1180px]:shadow-glow @[1180px]:shadow-black/60'
    + ' @[1536px]:mr-0 @[1536px]:z-auto @[1536px]:shadow-none',
};

// Une colonne qui reste fixe en A3 (essentiels, colonne repliable) : son
// contenu dans une boîte intérieure, mesurée. ⚠️ **Elle ne défile seule
// (`overflow-y: auto`) que quand son contenu dépasse la hauteur visible**
// (`data-defile`) : une boîte qui défile rogne les flottants posés en
// `absolute` dedans (aides, menus), qu'il vaut mieux laisser déborder tant
// que rien n'oblige à défiler. Hors A3, aucune hauteur maximale : jamais.
function ColonneFixe({ className, contenu, children, ...donnees }: {
  className: string; contenu: string; children: ReactNode; 'data-zone'?: string; 'data-colonne'?: string;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const interieur = useRef<HTMLDivElement>(null);
  const [depasse, setDepasse] = useState(false);
  useLayoutEffect(() => {
    const b = boite.current, i = interieur.current;
    if (!b || !i || typeof ResizeObserver === 'undefined') return;
    const lire = () => {
      const max = parseFloat(getComputedStyle(b).maxHeight);
      setDepasse(Number.isFinite(max) && i.offsetHeight > max + 0.5);
    };
    lire();
    const obs = new ResizeObserver(lire);
    obs.observe(b);
    obs.observe(i);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={boite} {...donnees} data-defile={depasse ? '' : undefined} className={className}>
      <div ref={interieur} className={contenu}>{children}</div>
    </div>
  );
}

export default function PageBureau(props: PageBureauProps) {
  const racine = useRef<HTMLDivElement>(null);
  const rangeeOnglets = useRef<HTMLDivElement>(null);
  const { largeur, style } = useColle(racine, rangeeOnglets);
  const deux = deuxColonnesTiennent(largeur);
  const etat = props.colonnes ?? colonnesParDefaut(largeur);
  const affichees = colonnesAffichees(etat, deux);
  // Le guidage : l'état résolu (départ compris) avec la colonne ouverte. Lu
  // par une ref pour ne réagir qu'à une NOUVELLE demande.
  const etatCourant = useRef(etat);
  etatCourant.current = etat;
  const { guideComplements, onColonnes } = props;
  useEffect(() => {
    if (guideComplements == null) return;
    onColonnes(ouvrirColonne(etatCourant.current, 'complements'));
  }, [guideComplements, onColonnes]);

  return (
    <div
      ref={racine}
      className="@container"
      style={style}
      data-agencement={largeur != null ? agencementBureau(largeur) : undefined}
    >
      {props.entete && <div className="mb-5 space-y-5">{props.entete}</div>}
      <div
        className={
          'grid grid-cols-[minmax(0,1fr)] items-start gap-y-4'
          + ' @[904px]:grid-cols-[548px_minmax(0,1fr)] @[904px]:grid-rows-[auto_1fr_auto] @[904px]:gap-x-4'
          + ' @[1180px]:grid-cols-[564px_auto_minmax(0,1fr)] @[1180px]:grid-rows-[auto_1fr] @[1180px]:gap-x-0 @[1180px]:gap-y-0'
        }
      >
        {/* Les essentiels : liste de travail en tête, à sa place stable. */}
        <ColonneFixe
          data-zone="essentiels"
          className={
            'w-[548px]'
            + ' @[904px]:col-[1] @[904px]:row-[1/span_2]'
            + ' @[1180px]:sticky @[1180px]:top-[var(--colle-haut)] @[1180px]:z-10 @[1180px]:max-h-[var(--hauteur-essentiels)]'
            + ' @[1180px]:w-[564px] @[1180px]:data-[defile]:overflow-y-auto'
          }
          contenu="flex w-[548px] flex-col gap-4"
        >
          {props.liste}
          {props.set}
          <div className="flex w-[548px] items-start gap-4">
            {props.conditions}
            <div className="flex flex-col gap-4">
              {props.principales}
              {props.etat}
            </div>
          </div>
        </ColonneFixe>

        {/* Le contrôle à onglets : sa propre rangée, jamais déplacée par ce
            qu'il ouvre. En A3, fixe, sur un fond qui masque ce qui défile
            dessous. */}
        <div
          ref={rangeeOnglets}
          data-zone="onglets"
          className={
            '@[904px]:col-[2] @[904px]:row-[1]'
            + ' @[1180px]:col-[2/-1] @[1180px]:sticky @[1180px]:top-[var(--colle-onglets)] @[1180px]:z-30 @[1180px]:-mt-5 @[1180px]:bg-bg @[1180px]:pb-4 @[1180px]:pt-5'
          }
        >
          <OngletsColonnes affichees={affichees} onBasculer={(c) => props.onColonnes(basculerColonne(etat, c, deux))} />
        </div>

        {/* Les colonnes repliables ouvertes. */}
        {(affichees.artefacts || affichees.complements) && (
          <div
            data-zone="colonnes"
            className={
              'flex flex-col gap-4'
              + ' @[904px]:col-[2] @[904px]:row-[2]'
              + ' @[1180px]:flex-row @[1180px]:items-start @[1180px]:gap-0 @[1180px]:self-stretch'
            }
          >
            {affichees.artefacts && (
              <ColonneFixe data-colonne="artefacts" className={COLONNE_A3.artefacts} contenu="flex items-start gap-4 @[904px]:flex-col">
                {props.artefacts}
                {props.meilleurs}
              </ColonneFixe>
            )}
            {affichees.complements && (
              <ColonneFixe
                data-colonne="complements"
                className={COLONNE_A3.complements}
                contenu="grid grid-cols-[340px_340px] items-start gap-4 @[904px]:flex @[904px]:flex-col"
              >
                {props.auras}
                <div className="row-span-2">{props.exclusion}</div>
                <div className="col-start-1 row-start-2">{props.avances}</div>
              </ColonneFixe>
            )}
          </div>
        )}

        {/* La colonne de droite : sur toute la largeur en A1 et A2, à droite
            des colonnes insérées en A3. */}
        <div
          data-zone="droite"
          className={
            'min-w-0 justify-self-stretch'
            + ' @[904px]:col-[1/-1] @[904px]:row-[3]'
            + ' @[1180px]:col-[3] @[1180px]:row-[2]'
          }
        >
          {props.droite}
        </div>
      </div>
    </div>
  );
}
