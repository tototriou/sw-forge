import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Onglets } from '../../../../ui';
import { COIN_RACCORD, HAUT_FIXE, HAUT_FIXE_RACCORD, PANNEAU, SECTIONS, coinsDuPanneau } from './panneau';
import { type PartieObjectif } from './ObjectifEtRechercherBureau';
import { SetDeplieContext } from './setDeplie';
import { configurationBureau, ongletOuvert, LARGEURS_BUREAU, RETRAIT_PANNEAU, type ColonneReglage } from '../../../../lib/optimizerColonnes';

// Bureau seulement : la largeur du conteneur décide des colonnes et du
// groupe. Chaque colonne défile seule, ou les deux piles sous le seuil.
// docs/02-app/optimizer/ecran/README.md, « Les quatre configurations ».
const MARGE_BAS = 16;

// Ce que la page reprend, à gauche et à droite, sur le rembourrage de ce qui
// la porte (`-mx-3`, voir la racine).
const EMPIETEMENT = 12;

// L'empiètement possible de chaque côté : la place entre le contenu du parent
// et le bord de ce qui défile (sa boîte de rembourrage), ou de la fenêtre,
// au plus `EMPIETEMENT`. ⚠️ Sans rembourrage autour (la page montée seule), la
// page empiéterait hors de la partie visible et ferait défiler en largeur.
function empietement(el: HTMLElement, defile: HTMLElement | null): { gauche: number; droite: number } {
  const parent = el.parentElement;
  if (!parent) return { gauche: 0, droite: 0 };
  const r = parent.getBoundingClientRect();
  const s = getComputedStyle(parent);
  const contenuG = r.left + (parseFloat(s.borderLeftWidth) || 0) + (parseFloat(s.paddingLeft) || 0);
  const contenuD = r.right - (parseFloat(s.borderRightWidth) || 0) - (parseFloat(s.paddingRight) || 0);
  let bordG = 0;
  let bordD = document.documentElement.clientWidth;
  if (defile) {
    const d = defile.getBoundingClientRect();
    bordG = d.left + defile.clientLeft;
    bordD = bordG + defile.clientWidth;
  }
  const borne = (v: number) => Math.max(0, Math.min(EMPIETEMENT, Math.floor(v)));
  return { gauche: borne(contenuG - bordG), droite: borne(bordD - contenuD) };
}

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


// La hauteur visible vaut pour toutes les configurations, pleine page et volet.
function useHauteurVisible(racine: RefObject<HTMLDivElement>): Mesure {
  const [mesure, setMesure] = useState<Mesure>({ largeur: null, style: {} });
  useLayoutEffect(() => {
    const el = racine.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const defile = parentQuiDefile(el);
    const mesurer = () => {
      const largeur = el.getBoundingClientRect().width;
      const { gauche, droite } = empietement(el, defile);
      const haut = el.getBoundingClientRect().top;
      const dessus = defile
        ? haut - defile.getBoundingClientRect().top - defile.clientTop + defile.scrollTop
        : haut + window.scrollY;
      const visible = defile ? defile.clientHeight : window.innerHeight;
      const style: CSSProperties = {
        marginLeft: `${-gauche}px`, marginRight: `${-droite}px`,
        height: `${Math.max(0, Math.round(visible - dessus - MARGE_BAS))}px`,
        marginBottom: `${-Math.round(espaceApres(el, defile))}px`,
      };
      setMesure(avant => avant.largeur === largeur && JSON.stringify(avant.style) === JSON.stringify(style) ? avant : { largeur, style });
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    obs.observe(defile ?? document.body);
    window.addEventListener('resize', mesurer);
    return () => { obs.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [racine]);
  return mesure;
}

export interface PresentationObjectif { cadre: boolean; partie: PartieObjectif }
export interface PageBureauProps {
  liste: ReactNode;
  set: ReactNode;
  conditions: ReactNode;
  principales: ReactNode;
  etat: ReactNode;
  artefacts: ReactNode;
  meilleurs: ReactNode;
  auras: ReactNode;
  exclusion: ReactNode;
  avances: ReactNode;
  exemplaire: ReactNode;
  objectif: (presentation: PresentationObjectif) => ReactNode;
  resultats: ReactNode;
  onglet: ColonneReglage | null;
  onOnglet: (suivant: ColonneReglage | null) => void;
  rappelAuras: boolean;
  guideComplements?: number | null;
  guideCriteres?: number | null;
}

export interface MesureColonne { boite: number; naturelle: number }

// La boîte déborde de 6 px sur la gouttière : panneau (place - 8),
// écart de 4, barre de 10. Sans débordement vertical, la barre est absente
// mais le panneau garde sa largeur. Résultats : barre toujours réservée.
function Colonne({ place, children, surMesure, zone, colonne, raccord = false }: {
  place?: number; children: ReactNode; surMesure?: (mesure: MesureColonne) => void;
  zone?: string; colonne?: ColonneReglage; raccord?: boolean;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const interieur = useRef<HTMLDivElement>(null);
  const [coins, setCoins] = useState<string>();
  const mesureRef = useRef(surMesure);
  mesureRef.current = surMesure;
  useLayoutEffect(() => {
    const b = boite.current, i = interieur.current;
    if (!b || !i || typeof ResizeObserver === 'undefined') return;
    const lire = () => {
      const dernier = i.lastElementChild;
      if (dernier) {
        const s = getComputedStyle(i);
        mesureRef.current?.({ boite: b.clientHeight, naturelle: dernier.getBoundingClientRect().bottom - i.getBoundingClientRect().top
          + (parseFloat(s.paddingBottom) || 0) + (parseFloat(s.borderBottomWidth) || 0) });
      }
      const s = getComputedStyle(i);
      setCoins(coinsDuPanneau(i.getBoundingClientRect().width, parseFloat(s.borderTopRightRadius) || 0, parseFloat(s.borderTopLeftRadius) || 0));
    };
    lire();
    const obs = new ResizeObserver(lire);
    obs.observe(b); obs.observe(i);
    return () => obs.disconnect();
  }, [colonne]);
  return (
    <div ref={boite} data-zone={zone} data-colonne={colonne}
      className={`h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain ${place == null ? '[scrollbar-gutter:stable]' : ''}`}
      style={{ width: place == null ? '100%' : place + 6, clipPath: coins }}>
      <div ref={interieur}
        style={{ width: place == null ? 'calc(100% - 4px)' : place - RETRAIT_PANNEAU }}
        className={`flex min-h-full flex-col ${PANNEAU} ${raccord ? HAUT_FIXE_RACCORD : HAUT_FIXE} ${SECTIONS}`}>
        {children}
      </div>
    </div>
  );
}

// La décision se reprend à hauteur ou écart changés, jamais à contenu changé :
// choisir un set ou une principale ne replie pas la grille sous le pointeur.
function useSetDeplie(autorise: boolean) {
  const [deplie, setDeplie] = useState(false);
  const deplieRendu = useRef(deplie);
  deplieRendu.current = deplie;
  const autoriseRef = useRef(autorise);
  autoriseRef.current = autorise;
  const ecart = useRef<number | null>(null);
  const derniere = useRef<MesureColonne | null>(null);
  const evaluee = useRef('');
  const decider = useCallback(() => {
    const m = derniere.current;
    if (!m) return;
    const e = ecart.current;
    const cle = `${Math.round(m.boite)}|${e == null ? '' : Math.round(e)}|${autoriseRef.current}`;
    if (cle === evaluee.current) return;
    evaluee.current = cle;
    const compacte = m.naturelle - (deplieRendu.current && e != null ? e : 0);
    const cible = autoriseRef.current && e != null && compacte + e <= m.boite + 0.5;
    // `deplieRendu` ne suit que le rendu : une mesure prise avant que la
    // nouvelle forme soit dessinée se rapporte encore à l'ancienne.
    if (cible !== deplieRendu.current) setDeplie(cible);
  }, []);
  // L'autorisation change même à hauteur égale au passage en deux piles.
  useLayoutEffect(() => { decider(); }, [autorise, decider]);
  const surMesure = useCallback((m: MesureColonne) => { derniere.current = m; decider(); }, [decider]);
  const reporterEcart = useCallback((e: number) => { ecart.current = e; decider(); }, [decider]);
  const contexte = useMemo(() => ({ deplie: autorise && deplie, reporterEcart }), [autorise, deplie, reporterEcart]);
  return { contexte, surMesure };
}


const NOMS = {
  criteres: { libelle: 'Critères', title: 'Critères de recherche' },
  artefacts: { libelle: 'Artéfacts', title: 'Artéfacts et relique' },
  complements: { libelle: 'Options', title: 'Aura, exclusion, avancés' },
};

// Le bouton collé a pour contenant toute la pile, y compris les réglages.
// Le fond du panneau commence au bloc de recherche, hors du flux : il
// n'enferme pas le bouton dans un contenant qui commencerait trop bas.
function PileDroite({ groupe, objectif, resultats }: {
  groupe: ReactNode; objectif: PageBureauProps['objectif']; resultats: ReactNode;
}) {
  const reglages = useRef<HTMLDivElement>(null);
  const bloc = useRef<HTMLDivElement>(null);
  const fond = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const r = reglages.current, b = bloc.current, f = fond.current;
    if (!r || !b || !f || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => { f.style.top = `${b.offsetTop}px`; };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(r);
    return () => obs.disconnect();
  }, []);
  return (
    <div data-zone="pile-droite" className="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
      <div className="relative mr-1">
        <div ref={fond} aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 ${PANNEAU}`} />
        <div ref={reglages} className="relative pb-6">{groupe}</div>
        <div ref={bloc} data-zone="objectif" className="relative px-[9px] pt-[9px]">{objectif({ cadre: false, partie: 'reglages' })}</div>
        <div data-zone="barre" className="sticky bottom-0 z-10 px-[9px] py-2">{objectif({ cadre: false, partie: 'barre' })}</div>
        <div className="relative px-[9px]">{objectif({ cadre: false, partie: 'progression' })}</div>
        <div className="relative px-[9px] pb-[9px] pt-2"><div data-zone="resultats" className="min-w-0 border-t border-border-soft pt-2">{resultats}</div></div>
      </div>
    </div>
  );
}

export default function PageBureau(props: PageBureauProps) {
  const racine = useRef<HTMLDivElement>(null);
  const { largeur, style } = useHauteurVisible(racine);
  const disposition = useMemo(() => configurationBureau(largeur ?? 752), [largeur]);
  const actif = ongletOuvert(disposition.groupe, props.onglet);
  const { onOnglet, guideComplements, guideCriteres } = props;
  const courant = useRef({ groupe: disposition.groupe, actif });
  courant.current = { groupe: disposition.groupe, actif };
  // Mémoriser aussi les remplacements au redimensionnement : revenir à un
  // groupe n'y ressuscite pas un onglet qui n'en faisait plus partie.
  useLayoutEffect(() => { if (props.onglet !== actif) onOnglet(actif); }, [actif, props.onglet, onOnglet]);
  useLayoutEffect(() => {
    if (guideComplements != null) onOnglet(ongletOuvert(courant.current.groupe, courant.current.actif, 'complements'));
  }, [guideComplements, onOnglet]);
  useLayoutEffect(() => {
    if (guideCriteres != null) onOnglet(ongletOuvert(courant.current.groupe, courant.current.actif, 'criteres'));
  }, [guideCriteres, onOnglet]);
  const setDeplie = useSetDeplie(!disposition.deuxPiles);
  const contenus: Record<ColonneReglage, ReactNode> = {
    criteres: <><SetDeplieContext.Provider value={setDeplie.contexte}>{props.set}</SetDeplieContext.Provider>{props.conditions}{props.principales}{props.etat}</>,
    artefacts: <>{props.artefacts}{props.meilleurs}</>,
    complements: <>{props.auras}{props.exclusion}{props.avances}</>,
  };
  // En deux piles seulement, les sections fixes se partagent les rangées
  // tant que 294 px chacune tiennent. Leur ordre reste celui du DOM.
  const contenuPile = (cle: ColonneReglage) => (
    <div data-colonne={cle} className="flex flex-wrap items-start gap-4">
      {cle === 'criteres'
        ? <><div className="w-[294px]"><SetDeplieContext.Provider value={setDeplie.contexte}>{props.set}</SetDeplieContext.Provider></div><div className="w-[294px]">{props.conditions}</div><div className="w-[294px]">{props.principales}</div><div className="w-[294px]">{props.etat}</div></>
        : cle === 'artefacts'
          ? <><div className="w-[294px]">{props.artefacts}</div>{props.meilleurs && <div className="w-[294px]">{props.meilleurs}</div>}</>
          : <><div className="w-[294px]">{props.auras}</div><div className="w-[294px]">{props.exclusion}</div><div className="w-[294px]">{props.avances}</div></>}
    </div>
  );
  // La ligne de base des onglets s'arrête au rayon du coin haut droit du
  // panneau, qui la prolonge en arrondi (`HAUT_FIXE_RACCORD`, `COIN_RACCORD`).
  const onglets = <Onglets aria-label="Réglages de recherche" valeur={actif ?? 'criteres'} className="pr-[var(--radius-xl)]"
    options={disposition.groupe.map(cle => ({ cle, ...NOMS[cle] }))} onChange={onOnglet} />;
  // Comme une colonne fixe, le groupe prend 326 px dans sa piste de 320 :
  // panneau 312 + écart 4 + barre 10, puis 10 px libres jusqu'à la piste
  // suivante. Son tabpanel doit offrir toute cette largeur au défilement.
  const groupe = actif && (
    <div data-zone="onglets" className={disposition.deuxPiles ? '' : 'flex h-full min-h-0 flex-col'}
      style={disposition.deuxPiles ? undefined : { width: LARGEURS_BUREAU.reglage + 6 }}>
      <div className="flex-none" style={disposition.deuxPiles ? undefined : { width: LARGEURS_BUREAU.reglage - RETRAIT_PANNEAU }}>{onglets}</div>
      {disposition.deuxPiles
        ? <div role="tabpanel" aria-label={NOMS[actif].title} className={`${PANNEAU} ${COIN_RACCORD}`}>{contenuPile(actif)}</div>
        : <div role="tabpanel" aria-label={NOMS[actif].title} className="min-h-0 flex-1">
            <Colonne place={LARGEURS_BUREAU.reglage} colonne={actif} raccord surMesure={actif === 'criteres' ? setDeplie.surMesure : undefined}>{contenus[actif]}</Colonne>
          </div>}
    </div>
  );
  const pistes = disposition.deuxPiles ? [] : [...disposition.colonnes, ...(disposition.groupe.length ? ['groupe'] : [])];
  return (
    <div ref={racine} className="-mx-3 @container" style={style} data-configuration={largeur != null ? disposition.configuration : undefined} data-page-fenetre="">
      <p className="sr-only" aria-live="polite">{props.rappelAuras ? "Pense à vérifier les sets d'aura externes." : ''}</p>
      <div className="grid h-full min-h-0 gap-4" style={{ gridTemplateColumns: `${LARGEURS_BUREAU.monstre}px ${pistes.map(() => `${LARGEURS_BUREAU.reglage}px `).join('')}minmax(0,1fr)` }}>
        <Colonne place={LARGEURS_BUREAU.monstre} zone="monstre"><div>{props.liste}</div><div data-zone="exemplaire">{props.exemplaire}</div></Colonne>
        {disposition.colonnes.map(cle => <Colonne key={cle} place={LARGEURS_BUREAU.reglage} colonne={cle} surMesure={cle === 'criteres' ? setDeplie.surMesure : undefined}>{contenus[cle]}</Colonne>)}
        {!disposition.deuxPiles && groupe}
        {disposition.deuxPiles ? (
          <PileDroite groupe={groupe} objectif={props.objectif} resultats={props.resultats} />
        ) : (
          <Colonne zone="resultats">
            <div data-zone="objectif">{props.objectif({ cadre: false, partie: 'tout' })}</div>
            <div>{props.resultats}</div>
          </Colonne>
        )}
      </div>
    </div>
  );
}
