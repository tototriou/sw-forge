import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import OngletsColonnes from './OngletsColonnes';
import { BANDE, BANDE_FIXE, PANNEAU, SECTIONS, coinsDuPanneau } from './panneau';
import { type PartieObjectif } from './ObjectifEtRechercherBureau';
import { AidesHorsDeLaBoite } from '../../../HelpPopover';
import {
  agencementBureau, basculerColonne, colonnesAffichees, colonnesParDefaut, deuxColonnesTiennent, formeObjectifBureau, ouvrirColonne,
  type ColonneRepliable, type ColonnesOuvertes, type FormeObjectifBureau,
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
// - A1 [728, 904[ : une colonne — essentiels, bloc « Objectif et Rechercher »
//   (large, à sa place) suivi de sa barre fine (« Rechercher » / « Arrêter » et
//   la progression), seule collée au bas de la partie visible tant que sa
//   place est plus bas ; onglets, colonne repliable ouverte (ses sections deux
//   à deux), « Exemplaire », résultats ;
// - A2 [904, 1180[ : essentiels à gauche ; à leur droite, le bloc (étroit), les
//   onglets puis la colonne repliable ouverte (cartes empilées) ; dessous, sur
//   toute la largeur, « Exemplaire » puis les résultats ;
// - A3 dès 1180 : essentiels à gauche, onglets en haut à leur droite ; dessous,
//   la colonne repliable ouverte, INSÉRÉE avant la colonne de droite là où elle
//   tient avec « Exemplaire » (« Artéfacts » dès 1516, « Aura… » dès 1536), en
//   PANNEAU SUPERPOSÉ aux résultats sinon (marge négative de sa largeur : elle
//   ne prend aucune place, rien ne bouge dessous) ; la colonne de droite :
//   « Exemplaire », le bloc à côté de lui (étroit) quand elle fait au moins 972
//   px, dessous (large) sinon, puis les résultats.
//
// ⚠️ **Chaque colonne est un panneau** (bureau/panneau.ts) : essentiels,
// colonnes repliables, colonne de droite ; leurs boîtes y sont des sections.
// Le panneau prend sa place moins `RETRAIT_PANNEAU` : 24 px entre deux
// panneaux, aucun seuil déplacé.
//
// ⚠️ **La colonne de droite n'est une boîte qu'en A3** (`data-zone="droite"`) :
// « Exemplaire », le bloc et les résultats y défilent ensemble, sur deux
// pistes (`607px` d'« Exemplaire », le reste), où le bloc étroit prend la
// seconde. En A1 et A2, cette boîte s'efface (`display: contents`) : ses
// cases sont celles de la grille de la page, « Exemplaire » et les résultats,
// l'un sous l'autre, en dessinent chacun une moitié du panneau.
// Le bloc suit les essentiels dans le DOM en A1 et A2 (ordre d'usage :
// l'objectif se choisit tôt) ; en A3, il ouvre la colonne de droite, qui suit
// les colonnes repliables comme à l'écran. Sa place se choisit donc sur
// l'agencement mesuré. Sa forme vient de `formeObjectifBureau` : largeur et
// colonnes insérées, donc un clic d'onglet, jamais le lancement d'une
// recherche.
//
// ⚠️ **En A2 et A3, la page tient dans la partie visible et ne défile pas** :
// sa hauteur est celle de la fenêtre sous la barre du haut, ou du corps de son
// volet de l'écran partagé, moins `MARGE_BAS` (`useHauteurVisible`). En A3,
// chaque colonne est un panneau à hauteur de page qui défile seul :
// essentiels, colonne repliable (insérée ou superposée), colonne de droite.
// En A2, « Exemplaire » et les résultats passent sous les essentiels : aucune
// colonne n'y va de haut en bas, et la page défile en elle-même, d'un bloc,
// la fenêtre immobile. En A1, la page défile dans la fenêtre, comme avant ;
// seule sa barre fine est collée. Aucun défilement ne se reporte d'un panneau à la page ou à un autre
// (`overscroll-behavior: contain`).
//
// ⚠️ **Le contrôle à onglets ne bouge jamais au clic** : il a sa propre rangée,
// la colonne s'ouvre dessous (A2, A3) ou après lui (A1). En A3, cette rangée
// court au-dessus des colonnes repliables et de la colonne de droite, sans fond :
// rien ne défile sous elle.

// Ce qui reste libre au bas de la partie visible, sous les panneaux.
const MARGE_BAS = 16;

interface Mesure {
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

// Ce qui suit la racine jusqu'au bas de ce qui défile (rembourrages, contours
// et marges des ancêtres) : la racine le rend par une marge négative, pour que
// la page finisse à `MARGE_BAS` du bas de la partie visible, sans la faire
// défiler. ⚠️ La racine est le dernier élément de la page dans le flux.
function espaceApres(el: HTMLElement, defile: HTMLElement | null): number {
  let total = 0;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p);
    total += parseFloat(s.paddingBottom) || 0;
    if (p === defile) break;
    total += (parseFloat(s.borderBottomWidth) || 0) + (parseFloat(s.marginBottom) || 0);
  }
  return total;
}

// La largeur du conteneur (la même que lisent les requêtes de conteneur) ; en
// A2 et A3, la hauteur de la page : la partie visible de ce qui défile (la
// fenêtre, ou le corps du volet), moins ce qui est au-dessus de la page dans
// ce qui défile et `MARGE_BAS`.
function useHauteurVisible(racine: RefObject<HTMLDivElement>): Mesure {
  const [mesure, setMesure] = useState<Mesure>({ largeur: null, style: {} });
  useLayoutEffect(() => {
    const el = racine.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const defile = parentQuiDefile(el);
    const mesurer = () => {
      // La largeur de CONTENU, barre de défilement de la page retirée (A2) :
      // celle que lisent les requêtes de conteneur.
      const largeur = el.getBoundingClientRect().width - (el.offsetWidth - el.clientWidth);
      const agencement = agencementBureau(largeur);
      let style: CSSProperties = {};
      if (agencement !== 'A1') {
        const haut = el.getBoundingClientRect().top;
        // Le haut de la page dans ce qui défile, défilement retiré ;
        // `innerHeight` et non `documentElement.clientHeight`, qui vaut la
        // hauteur du document hors mode standard.
        const dessus = defile
          ? haut - defile.getBoundingClientRect().top - defile.clientTop + defile.scrollTop
          : haut + window.scrollY;
        const visible = defile ? defile.clientHeight : window.innerHeight;
        style = {
          height: `${Math.max(0, Math.round(visible - dessus - MARGE_BAS))}px`,
          marginBottom: `${-Math.round(espaceApres(el, defile))}px`,
          // A2 : aucune colonne n'y va de haut en bas ; la page défile en
          // elle-même, sa barre réservée hors du conteneur (comme celle de la
          // fenêtre avant elle : aucune largeur ne bouge) et toujours là (les
          // résultats qui arrivent ne la rétrécissent pas).
          ...(agencement === 'A2' ? { overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable' } : {}),
        };
      }
      setMesure((avant) => {
        const meme = avant.largeur === largeur && JSON.stringify(avant.style) === JSON.stringify(style);
        return meme ? avant : { largeur, style };
      });
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    // Ce qui défile change de hauteur avec la fenêtre, le volet ou ce qui
    // s'affiche au-dessus de la page (message d'import).
    obs.observe(defile ?? document.body);
    window.addEventListener('resize', mesurer);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, [racine]);
  return mesure;
}

// Ce que la page demande au bloc « Objectif et Rechercher »
// (`ObjectifEtRechercherBureau`) : sa forme, son panneau (seul en A1 et A2,
// section du panneau de droite en A3), la partie à rendre.
export interface PresentationObjectif {
  forme: FormeObjectifBureau;
  cadre: boolean;
  partie: PartieObjectif;
}

export interface PageBureauProps {
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
  // La colonne de droite : « Exemplaire », le bloc « Objectif et Rechercher »,
  // rendu dans la forme que choisit la page (`formeObjectifBureau`), avec ou
  // sans son propre panneau, entier ou en deux parties (A1), et les résultats.
  exemplaire: ReactNode;
  objectif: (presentation: PresentationObjectif) => ReactNode;
  resultats: ReactNode;
  // L'état des onglets : `null` tant que l'utilisateur n'y a pas touché (l'état
  // de départ suit alors la largeur, `colonnesParDefaut`).
  colonnes: ColonnesOuvertes | null;
  onColonnes: (suivant: ColonnesOuvertes) => void;
  // Le rappel « Pense à vérifier les sets d'aura externes. » est-il en cours
  // (`rappelAuras` d'OptimizerSection) ? Annoncé par la page, toujours montée.
  rappelAuras: boolean;
  // Ouvrir « Aura, exclusion, avancés » depuis ailleurs (guidage vers
  // l'interrupteur des auras RES/PRE) : chaque nouvelle valeur l'ouvre, sans
  // jamais la refermer.
  guideComplements?: number | null;
}

// Le défilement d'une colonne en A3 : seule (`data-defile`, voir `Colonne`),
// sans report sur la page ni sur une autre colonne une fois au bout.
const DEFILE_A3 = '@[1180px]:min-h-0 @[1180px]:overscroll-contain @[1180px]:data-[defile]:overflow-y-auto @[1180px]:data-[defile]:overflow-x-hidden';

// ⚠️ **La boîte qui défile s'arrête à sa barre** : large de son panneau, de
// 4 px et de la barre de défilement (10 px), pour que la barre se lise comme
// celle de SA colonne ; le reste de l'écart entre deux panneaux (24 px) est
// une marge, hors de la boîte. Décision de l'utilisateur : une barre au bord
// de la place se collait au panneau suivant. La colonne de droite, la
// dernière, garde aussi 4 px entre son panneau et sa barre, au bord de la
// page.
//
// Une colonne repliable en A3, à défilement propre : superposée sous son seuil
// d'insertion (marge négative de sa largeur : elle ne prend aucune place),
// haute de son contenu au plus de la page (elle ne couvre des résultats que
// ce qu'elle montre) ; insérée au-delà, sa boîte et sa marge font sa place et
// la gouttière (336 ou 356), et elle est haute de la page, son panneau
// jusqu'en bas. Les classes sont écrites en entier pour Tailwind ; l'ombre
// (celle des flottants) va au panneau, superposé seulement. La bande braise
// est le contour du haut du panneau (`BANDE`), recopiée en haut de la boîte
// en A3 pour y rester quand la colonne défile (`BANDE_FIXE`).
const COLONNE_A3: Record<ColonneRepliable, { boite: string; panneau: string }> = {
  artefacts: {
    boite: `${DEFILE_A3} @[1180px]:max-h-full @[1180px]:w-[326px] @[1180px]:-mr-[326px] @[1180px]:z-20 @[1516px]:h-full @[1516px]:mr-[10px] @[1516px]:z-auto`,
    panneau: `${BANDE} ${BANDE_FIXE} @[1180px]:shadow-glow @[1180px]:shadow-black/60 @[1516px]:min-h-full @[1516px]:shadow-none`,
  },
  complements: {
    boite: `${DEFILE_A3} @[1180px]:max-h-full @[1180px]:w-[346px] @[1180px]:-mr-[346px] @[1180px]:z-20 @[1536px]:h-full @[1536px]:mr-[10px] @[1536px]:z-auto`,
    panneau: `${BANDE} ${BANDE_FIXE} @[1180px]:shadow-glow @[1180px]:shadow-black/60 @[1536px]:min-h-full @[1536px]:shadow-none`,
  },
};

// Les sections d'un panneau de colonne repliable : côte à côte en A1 (un trait
// vertical entre deux), empilées dès A2 (un trait horizontal).
const SECTIONS_COLONNE = '[&>*+*]:ml-2 [&>*+*]:border-l [&>*+*]:border-border-soft [&>*+*]:pl-2'
  + ' @[904px]:[&>*+*]:ml-0 @[904px]:[&>*+*]:border-l-0 @[904px]:[&>*+*]:pl-0'
  + ' @[904px]:[&>*+*]:mt-2 @[904px]:[&>*+*]:border-t @[904px]:[&>*+*]:pt-2';

// Une colonne de A3 (essentiels, colonne repliable, colonne de droite) : son
// contenu dans une boîte intérieure, mesurée. ⚠️ **Elle ne défile seule
// (`overflow-y: auto`) que quand son contenu dépasse sa hauteur**
// (`data-defile`) : une boîte qui défile rogne les flottants posés en
// `absolute` dedans (menus), qu'il vaut mieux laisser déborder tant que rien
// n'oblige à défiler. Hors A3, aucune hauteur imposée : jamais.
// ⚠️ **Les aides en sortent toujours** (`AidesHorsDeLaBoite`, HelpPopover.tsx) :
// une bulle de 340 px ancrée près du bord droit déborde de la colonne même
// quand elle tient en hauteur ; en portail, elle s'affiche en entier.
// ⚠️ **Une colonne qui défile garde les coins arrondis de son panneau** : la
// boîte est rognée aux coins du haut du panneau (`coinsDuPanneau`), pour que
// le contenu qui passe sous la bande ne s'y voie pas.
function Colonne({ className, contenu, children, ...donnees }: {
  className: string; contenu: string; children: ReactNode; 'data-zone'?: string; 'data-colonne'?: string;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const interieur = useRef<HTMLDivElement>(null);
  const [coins, setCoins] = useState<string | null>(null);
  useLayoutEffect(() => {
    const b = boite.current, i = interieur.current;
    if (!b || !i || typeof ResizeObserver === 'undefined') return;
    // La boîte a la hauteur de son contenu tant que rien ne la borne (A1, A2,
    // colonne de droite effacée) : le contenu ne la dépasse alors jamais.
    const lire = () => {
      if (i.offsetHeight <= b.clientHeight + 0.5) { setCoins(null); return; }
      const largeur = Math.round(i.getBoundingClientRect().right - b.getBoundingClientRect().left);
      setCoins(coinsDuPanneau(largeur, parseFloat(getComputedStyle(i).borderTopLeftRadius) || 0));
    };
    lire();
    const obs = new ResizeObserver(lire);
    obs.observe(b);
    obs.observe(i);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={boite}
      {...donnees}
      data-defile={coins != null ? '' : undefined}
      style={coins != null ? { clipPath: coins } : undefined}
      className={className}
    >
      <div ref={interieur} className={contenu}>
        <AidesHorsDeLaBoite.Provider value>{children}</AidesHorsDeLaBoite.Provider>
      </div>
    </div>
  );
}

// L'annonce du rappel des auras, pour les lecteurs d'écran : une région
// `aria-live` TOUJOURS montée, hors de la colonne repliable (la carte des sets
// d'aura, qui affiche le rappel, n'est montée que colonne ouverte, et le rappel
// sous la liste n'annonce rien). Vide le reste du temps : c'est l'arrivée du
// texte qui s'annonce.
function AnnonceRappelAuras({ rappel }: { rappel: boolean }) {
  return (
    <p className="sr-only" aria-live="polite">
      {rappel ? 'Pense à vérifier les sets d\'aura externes.' : ''}
    </p>
  );
}

export default function PageBureau(props: PageBureauProps) {
  const racine = useRef<HTMLDivElement>(null);
  const { largeur, style } = useHauteurVisible(racine);
  const deux = deuxColonnesTiennent(largeur);
  const etat = props.colonnes ?? colonnesParDefaut(largeur);
  const affichees = colonnesAffichees(etat, deux);
  const forme = formeObjectifBureau(largeur, affichees);
  const etroite = forme === 'etroite';
  // Le guidage : l'état résolu (départ compris) avec la colonne ouverte. Lu
  // par une ref pour ne réagir qu'à une NOUVELLE demande.
  const etatCourant = useRef(etat);
  etatCourant.current = etat;
  const { guideComplements, onColonnes } = props;
  useEffect(() => {
    if (guideComplements == null) return;
    onColonnes(ouvrirColonne(etatCourant.current, 'complements'));
  }, [guideComplements, onColonnes]);

  // A1 (largeur inconnue comprise, la forme de départ) : le bloc à sa place,
  // sa barre fine collée à part. A3 : le bloc est une section du panneau de
  // droite, dont il ouvre la boîte.
  const agencement = largeur != null ? agencementBureau(largeur) : 'A1';
  const a1 = agencement === 'A1';
  const a3 = agencement === 'A3';
  const cadre = !a3;

  // Le bloc « Objectif et Rechercher ». A1 : large, à sa place sous les
  // essentiels. A2 : étroit, à droite des essentiels, au-dessus des onglets.
  // A3 : section du panneau de droite, à côté d'« Exemplaire » (étroit,
  // seconde piste) ou dessous (large).
  const objectif = (
    <div
      data-zone="objectif"
      data-forme={forme}
      className={
        a3
          ? (etroite
            ? 'col-[2] row-[1] border-l border-border-soft pl-2'
            : 'col-[1/-1] row-[2] mt-2 border-t border-border-soft pt-2')
          : '@[904px]:col-[2] @[904px]:row-[1]'
      }
    >
      {props.objectif({ forme, cadre, partie: a1 ? 'reglages' : 'tout' })}
    </div>
  );

  return (
    <div
      ref={racine}
      // ⚠️ **Marges de 12 px à gauche et à droite, au lieu des 24 de l'app** :
      // la page empiète de 12 px de chaque côté sur le rembourrage de la page
      // (pleine page) ou du volet, sans toucher aux autres pages ni au
      // téléphone (décision de l'utilisateur : la place va aux colonnes). Le
      // conteneur gagne ces 24 px : à fenêtre égale, chaque seuil est atteint
      // 24 px plus tôt.
      className="-mx-3 @container"
      style={style}
      data-agencement={largeur != null ? agencement : undefined}
      // La page tient dans la partie visible (A2, A3) : sans pied de page de
      // l'app, la fenêtre ne défile pas (index.css, « Optimizer à hauteur de
      // fenêtre »).
      data-page-fenetre={largeur != null && !a1 ? '' : undefined}
    >
      <AnnonceRappelAuras rappel={props.rappelAuras} />
      <div
        className={
          'grid grid-cols-[minmax(0,1fr)] items-start gap-y-6'
          + ' @[904px]:grid-cols-[548px_minmax(0,1fr)] @[904px]:grid-rows-[auto_auto_1fr_auto_auto] @[904px]:gap-x-4'
          // A3 : la grille a la hauteur de la page, ses colonnes défilent.
          + ' @[1180px]:h-full @[1180px]:grid-cols-[564px_auto_minmax(0,1fr)] @[1180px]:grid-rows-[auto_minmax(0,1fr)] @[1180px]:gap-x-0 @[1180px]:gap-y-0'
        }
      >
        {/* Les essentiels : liste de travail en tête, à sa place stable ; à
            droite des Conditions, la sous-colonne des principales et de l'état
            du monstre, qui finit à peu près à leur hauteur. En A3, panneau
            haut de la page. */}
        <Colonne
          data-zone="essentiels"
          className={
            'w-[548px]'
            + ' @[904px]:col-[1] @[904px]:row-[1/span_3]'
            + ` @[1180px]:row-[1/-1] @[1180px]:h-full @[1180px]:w-[554px] ${DEFILE_A3}`
          }
          contenu={`flex w-[540px] flex-col ${PANNEAU} ${BANDE} ${BANDE_FIXE} ${SECTIONS} @[1180px]:min-h-full`}
        >
          {props.liste}
          {props.set}
          <div className="flex items-start gap-2">
            {props.conditions}
            <div className={`flex min-w-0 flex-1 flex-col self-stretch border-l border-border-soft pl-2 ${SECTIONS}`}>
              {props.principales}
              {props.etat}
            </div>
          </div>
        </Colonne>

        {/* Le bloc, en A1 et A2 (en A3, il ouvre la colonne de droite) ; en
            A1, sa barre fine (« Rechercher » / « Arrêter » et la progression)
            le suit, collée au bas de la partie visible tant que sa place est
            plus bas (« Rechercher » toujours atteignable). */}
        {!a3 && objectif}
        {a1 && (
          <div data-zone="barre" className="sticky bottom-0 z-10 -mt-4 @[904px]:hidden">
            {props.objectif({ forme, cadre, partie: 'barre' })}
          </div>
        )}

        {/* Le contrôle à onglets : sa propre rangée, jamais déplacée par ce
            qu'il ouvre. En A3, au-dessus des colonnes repliables et de la
            colonne de droite, qui défilent chacune sous sa rangée, jamais
            dessous : il n'a pas de fond. */}
        <div
          data-zone="onglets"
          className={
            '@[904px]:col-[2] @[904px]:row-[2]'
            + ' @[1180px]:col-[2/-1] @[1180px]:row-[1] @[1180px]:pb-4'
          }
        >
          <OngletsColonnes affichees={affichees} onBasculer={(c) => props.onColonnes(basculerColonne(etat, c, deux))} />
        </div>

        {/* Les colonnes repliables ouvertes, chacune son panneau. */}
        {(affichees.artefacts || affichees.complements) && (
          <div
            data-zone="colonnes"
            className={
              'flex flex-col gap-6'
              + ' @[904px]:col-[2] @[904px]:row-[3]'
              + ' @[1180px]:col-[2] @[1180px]:row-[2] @[1180px]:h-full @[1180px]:min-h-0 @[1180px]:flex-row @[1180px]:items-start @[1180px]:gap-0'
            }
          >
            {affichees.artefacts && (
              <Colonne
                data-colonne="artefacts"
                className={COLONNE_A3.artefacts.boite}
                contenu={`flex w-fit items-start @[904px]:flex-col ${PANNEAU} ${SECTIONS_COLONNE} ${COLONNE_A3.artefacts.panneau}`}
              >
                <div className="w-[294px]">{props.artefacts}</div>
                {props.meilleurs && <div className="w-[294px]">{props.meilleurs}</div>}
              </Colonne>
            )}
            {affichees.complements && (
              <Colonne
                data-colonne="complements"
                className={COLONNE_A3.complements.boite}
                contenu={`grid w-fit grid-cols-[auto_auto] items-start @[904px]:flex @[904px]:flex-col ${PANNEAU} ${COLONNE_A3.complements.panneau}`}
              >
                <div className="w-[314px]">{props.auras}</div>
                <div className="row-span-2 ml-2 w-[323px] border-l border-border-soft pl-2 @[904px]:ml-0 @[904px]:mt-2 @[904px]:w-[314px] @[904px]:border-l-0 @[904px]:border-t @[904px]:pl-0 @[904px]:pt-2">
                  {props.exclusion}
                </div>
                <div className="col-start-1 row-start-2 mt-2 w-[314px] border-t border-border-soft pt-2">{props.avances}</div>
              </Colonne>
            )}
          </div>
        )}

        {/* La colonne de droite. En A3, un panneau haut de la page, qui défile
            seul : le bloc, « Exemplaire » et les résultats sur deux pistes
            (« Exemplaire » sur la première, 616 de place moins le bord du
            panneau ; le bloc étroit sur la seconde). En A1 et A2, effacée
            (`display: contents`) : « Exemplaire » et les résultats sont des
            cases de la grille de la page. Les classes de son panneau sont
            celles de `PANNEAU`, en A3 seulement. ⚠️ Elle défile toujours, sa
            barre réservée (`scrollbar-gutter: stable`) : les résultats qui
            arrivent ne la rétrécissent pas, et « Rechercher » ne bouge pas
            sous le clic. Son panneau s'arrête à 4 px de la barre. */}
        <Colonne
          data-zone="droite"
          className={
            'contents @[1180px]:col-[3] @[1180px]:row-[2] @[1180px]:block @[1180px]:h-full @[1180px]:min-h-0 @[1180px]:min-w-0'
            + ' @[1180px]:overflow-y-auto @[1180px]:overflow-x-hidden @[1180px]:overscroll-contain @[1180px]:[scrollbar-gutter:stable]'
          }
          contenu={
            'contents @[1180px]:grid @[1180px]:mr-1 @[1180px]:min-h-full @[1180px]:grid-cols-[607px_minmax(0,1fr)] @[1180px]:content-start'
            + ' @[1180px]:rounded-xl @[1180px]:border @[1180px]:border-border @[1180px]:bg-panel @[1180px]:p-2'
            // La bande (`BANDE`, en A3 seulement), et sa copie fixe, sur toutes
            // les rangées de la grille du panneau.
            + ' @[1180px]:border-t-[3px] @[1180px]:border-t-transparent @[1180px]:pt-[6px]'
            + ` ${BANDE_FIXE} @[1180px]:before:col-[1/-1] @[1180px]:before:row-[1/span_3]`
          }
        >
          {a3 && objectif}

          {/* « Exemplaire » : sous les réglages en A1 et A2, il y dessine le
              haut du panneau de droite, dont les résultats dessinent le bas ;
              en tête de la colonne de droite en A3. */}
          <div
            data-zone="exemplaire"
            className={
              `rounded-b-none border-b-0 pb-2 ${PANNEAU}`
              + ' @[904px]:col-[1/-1] @[904px]:row-[4]'
              + ' @[1180px]:col-[1] @[1180px]:row-[1] @[1180px]:rounded-none @[1180px]:border-0 @[1180px]:bg-transparent @[1180px]:p-0'
            }
          >
            {props.exemplaire}
          </div>

          {/* Les résultats, présents dès le départ (place d'attente) : sur
              toute la largeur en A1 et A2, sous « Exemplaire » et le bloc en
              A3. Un trait les sépare de ce qui les précède dans le panneau. */}
          <div
            data-zone="resultats"
            className={
              `-mt-6 min-w-0 rounded-t-none border-t-0 pt-0 ${PANNEAU}`
              + ' @[904px]:col-[1/-1] @[904px]:row-[5]'
              + ' @[1180px]:mt-0 @[1180px]:rounded-none @[1180px]:border-0 @[1180px]:bg-transparent @[1180px]:p-0'
              + (etroite
                ? ' @[1180px]:col-[1/-1] @[1180px]:row-[2]'
                : ' @[1180px]:col-[1/-1] @[1180px]:row-[3]')
            }
          >
            <div className="border-t border-border-soft pt-2 @[1180px]:mt-2">{props.resultats}</div>
          </div>
        </Colonne>
      </div>
    </div>
  );
}
