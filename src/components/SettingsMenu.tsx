import { ReactNode, useEffect, useRef, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { IconeParametres } from './IconesAtelier';
import { choixMesure, setRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';
import { setFormeResultats, useFormeResultats, type FormeResultats } from '../hooks/useFormeResultats';
import { setPersistence, storageAvailable, usePersistence } from '../hooks/usePersistence';
import { choixTheme, setTheme, useTheme } from '../hooks/useTheme';
import { setChoixLangue, useChoixLangue, useTraduction } from '../hooks/useLangue';
import { LANGUES, NOM_LANGUE, type ChoixLangue, type Dictionnaire } from '../i18n';
import { setOvercapDisplay, useOvercapDisplay } from '../hooks/useOvercapDisplay';
import { setAdversaireReference, useAdversaireReference } from '../hooks/useAdversaireReference';
import { useBuildsRapides } from '../hooks/useBuildsRapides';
import DialogueBuildsRapides, { resumeBuildsRapides } from './DialogueBuildsRapides';
import AccountFreshness from './AccountFreshness';
import BlocApplication from './BlocApplication';
import { EtatSession, estBureau, selonSupport } from '../lib/bureau';
import { useEtatSession } from '../hooks/useSessionEnCours';
import Segmented from '../ui/Segmented';
import Bouton from '../ui/Bouton';
import Flottant from '../ui/Flottant';
import Switch from './Switch';
import DrapeauLangue from './DrapeauLangue';

/* --------------------------------------------------------------------------
 * Briques de réglage — ajouter un paramètre = ajouter un <Setting>, rien d'autre
 * ----------------------------------------------------------------------- */

// Une ligne de réglage : intitulé à gauche, contrôle à droite. `hint` reste
// disponible pour un futur réglage moins évident, mais on s'en passe quand
// l'intitulé et les options parlent d'eux-mêmes.
// `repere` : un `data-repere`, pour le mode preuve (bureau/preuve.ts).
// `break-words` : un texte sans espace (un chemin de dossier) se coupe au
// lieu de déborder ; un texte ordinaire n'en est pas affecté.
function Setting({ title, hint, repere, children }: { title: string; hint?: string; repere?: string; children: ReactNode }) {
  return (
    <div data-repere={repere} className="py-2.5 border-b border-border/60 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {children}
      </div>
      {hint && <p className="mt-1 break-words text-micro text-ink-dim leading-snug">{hint}</p>}
    </div>
  );
}

// ── Le dossier SW Blacksmith (docs/02-app/transverse/) ────────────

// Pure : la ligne sous « Dossier SW Blacksmith » (`null` : rien reçu).
export function presentationDossierSwblacksmith(etat: EtatSession | null, t: Dictionnaire['parametres']): string {
  return etat?.dossier ? etat.dossier : t.dossierVide;
}

// Application de bureau seulement : le site n'écrit dans aucun dossier.
function ReglageDossierSwblacksmith() {
  const { etat, agir } = useEtatSession();
  const t = useTraduction().parametres;
  return (
    <Setting title={t.dossier} hint={presentationDossierSwblacksmith(etat, t)} repere="dossier-swblacksmith">
      <div className="flex flex-none gap-2">
        {/* Toujours affiché, désactivé sans dossier : il ne disparaît pas
            selon l'état. */}
        <Bouton
          taille="sm"
          fond="vide"
          trait="aucun"
          libelle={t.retirer}
          title={t.retirerAide}
          disabled={!etat?.dossier}
          onClick={() => void agir((s) => s.oublierDossier())}
        />
        <Bouton taille="sm" libelle={t.choisir} onClick={() => void agir((s) => s.choisirDossier())} />
      </div>
    </Setting>
  );
}

/* --------------------------------------------------------------------------
 * Le menu
 * ----------------------------------------------------------------------- */

// Réglages GLOBAUX de l'application : on les pose une fois, ils valent partout.
// Règle (voir docs/03-developpeur/) : un réglage qui concerne plusieurs pages vient
// ICI, jamais dupliqué en sélecteur sur chaque page.
//
// ⚠️ **Exportée** : la PAGE de réglages (`#/parametres`) affiche exactement la
// même liste que le popover. Deux copies auraient divergé au premier réglage
// ajouté — et c'est le genre de divergence qu'on ne voit pas, puisqu'on n'ouvre
// jamais les deux à la fois.
export function SettingsList({
  onClearData,
  onSauvegarderSession,
  sauvegardeIndisponible = null,
  onKeepAccount,
  accountExportedAt,
  groupes = false,
}: {
  onClearData?: () => void;
  onSauvegarderSession?: () => void;
  // Pourquoi « Sauvegarder » est désactivé (le compte se relit encore), ou
  // `null`. Le bouton reste affiché, désactivé avec cette raison en infobulle.
  sauvegardeIndisponible?: string | null;
  onKeepAccount?: () => void;
  accountExportedAt?: number | null;
  // ⚠️ **La PAGE de réglages, à la SOURIS** (la
  // maquette) : deux blocs intitulés, « Réglages » puis « Mes données »,
  // chacun dans sa carte. Même liste, même ordre — seul le rangement change.
  // Au doigt, les classes ne s'appliquent pas : une seule carte, portée par la
  // page, comme avant. Le popover ⚙ n'en a pas l'usage.
  groupes?: boolean;
}) {
  const textes = useTraduction();
  const t = textes.parametres;
  const choixLangue = useChoixLangue();
  const metric = useRuneMetric();
  const formeResultats = useFormeResultats();
  const keep = usePersistence();
  const storageOk = storageAvailable();
  const theme = useTheme();
  const overcap = useOvercapDisplay();
  const adversaireRef = useAdversaireReference();
  const buildsRapides = useBuildsRapides();
  const [dialogueBuildsRapides, setDialogueBuildsRapides] = useState(false);
  // ⚠️ Aux DEUX formats : la page de réglages
  // range ses blocs de la même façon au doigt qu'à la souris.
  const carteLg = groupes ? 'rounded-xl border border-border bg-panel px-4 py-1' : '';
  const intitule = (texte: string) =>
    groupes ? <span className="mb-2 block label">{texte}</span> : null;
  return (
    <div className={groupes ? 'flex flex-col gap-5' : ''}>
      <section>
      {intitule(t.blocReglages)}
      {/* ⚠️ `border-b` : le filet qui séparait « Adversaire de référence » de
          « Garder mes données » doit rester (popover ⚙, et la page au doigt) —
          le dernier réglage du bloc perd le sien (`last:border-0`). À la
          souris, la carte du bloc le remplace. */}
      <div className={`border-b border-border/60 ${carteLg}`}>
      {/* Les réglages les plus globaux de tous : ils changent l'app entière, ils
          viennent donc en premier, la langue d'abord — c'est elle qui rend les
          autres lisibles. ⚠️ TROIS options chacun, pas un interrupteur — « Auto »
          doit rester un choix explicite, sinon quelqu'un dont le système change
          perd ce comportement sans l'avoir demandé.
          Voir docs/02-app/transverse/feat-langues.md et docs/03-developpeur/interface/.
          ⚠️ Chaque langue s'écrit DANS sa langue (« English », pas « Anglais ») :
          on reconnaît la sienne même dans une interface qu'on ne lit pas. */}
      <Setting title={textes.langue.titre}>
        <Segmented<ChoixLangue>
          options={[
            { key: 'auto', label: textes.langue.auto, hint: selonSupport(textes.langue.autoNavigateur, textes.langue.autoSysteme) },
            ...LANGUES.map((l) => ({ key: l, label: NOM_LANGUE[l], icon: <DrapeauLangue langue={l} /> })),
          ]}
          value={choixLangue}
          onChange={setChoixLangue}
        />
      </Setting>

      <Setting title={t.theme}>
        <Segmented options={choixTheme(textes)} value={theme} onChange={setTheme} />
      </Setting>

      <Setting title={t.score}>
        <Segmented options={choixMesure(textes)} value={metric} onChange={setRuneMetric} />
      </Setting>

      {/* ⚠️ Ici, et plus au-dessus des résultats : au bureau, le tableau
          réorganise la page de l'Optimizer (ses réglages se rangent en
          onglets pour lui laisser la place) ; choisi dans l'Optimizer, le clic
          aurait déplacé ce qu'on venait de cliquer. */}
      <Setting
        title={t.resultatsOptimizer}
        hint={t.resultatsOptimizerAide}
      >
        <Segmented<FormeResultats>
          options={[{ key: 'cartes', label: t.cartes }, { key: 'tableau', label: t.tableau }]}
          value={formeResultats}
          onChange={setFormeResultats}
        />
      </Setting>

      {/* Ce que montre le Résumé des runes. Une fenêtre plutôt qu'un contrôle
          en ligne : une liste de combinaisons ne tient pas dans le popover. */}
      <Setting title={t.buildsRapides} hint={resumeBuildsRapides(buildsRapides, t)}>
        <Bouton
          taille="sm"
          libelle={t.choisir}
          title={t.buildsRapidesAide}
          onClick={() => setDialogueBuildsRapides(true)}
          className="flex-none"
        />
      </Setting>
      {dialogueBuildsRapides && <DialogueBuildsRapides onClose={() => setDialogueBuildsRapides(false)} />}

      <Setting
        title={t.overcap}
        hint={t.overcapAide}
      >
        <Switch
          checked={overcap}
          onChange={setOvercapDisplay}
          label={t.overcapInterrupteur}
        />
      </Setting>

      <Setting
        title={t.adversaire}
        hint={t.adversaireAide}
      >
        <Switch
          checked={adversaireRef}
          onChange={setAdversaireReference}
          label={t.adversaireInterrupteur}
        />
      </Setting>
      </div>
      </section>

      <section>
      {intitule(t.blocDonnees)}
      <div className={carteLg}>
      <Setting
        title={t.garder}
        hint={storageOk ? selonSupport(t.garderAideNavigateur, t.garderAideBureau) : t.garderIndisponible}
      >
        <Switch
          checked={keep && storageOk}
          disabled={!storageOk}
          onChange={(v) => setPersistence(v, onKeepAccount)}
          label={t.garderInterrupteur}
        />
      </Setting>

      {/* L'âge des données vit ICI, à côté du réglage qui décide de leur
          conservation : c'est là qu'on se pose la question, et ça n'encombre
          aucune page. */}
      <AccountFreshness exportedAt={accountExportedAt ?? null} className="pb-2.5" />

      {/* La sauvegarde de session (docs/02-app/transverse/) :
          avant la suppression, qui reste la dernière ligne du bloc. L'app ne
          la fournit que dans l'application de bureau. */}
      {onSauvegarderSession && (
        <Setting
          title={t.session}
          hint={t.sessionAide}
        >
          <Bouton
            taille="sm"
            icone={<Save size={12} />}
            libelle={t.sauvegarder}
            onClick={onSauvegarderSession}
            disabled={!!sauvegardeIndisponible}
            title={sauvegardeIndisponible ?? t.sauvegarderAide}
            className="flex-none"
          />
        </Setting>
      )}
      {onSauvegarderSession && estBureau() && <ReglageDossierSwblacksmith />}

      {/* ⚠️ La suppression vit ICI, pas à côté du bouton d'import : une action
          destructrice collée au bouton le plus utilisé finit par être cliquée de
          travers. Dans un menu qu'on ouvre exprès, le geste est délibéré. */}
      {/* Dans l'application de bureau, c'est le SEUL moyen de tout effacer :
          elle n'a pas « Se déconnecter » dans la barre du haut. */}
      {onClearData && (
        <Setting title={t.mesDonnees}>
          {/* ⚠️ Le `Bouton` de la LIBRAIRIE, ton `danger` : il était dessiné à la main,
              et ne disait son danger
              qu'au survol. */}
          <Bouton
            taille="sm"
            ton="danger"
            icone={<Trash2 size={12} />}
            libelle={t.toutSupprimer}
            onClick={onClearData}
            title={t.toutSupprimerAide}
            className="flex-none"
          />
        </Setting>
      )}
      </div>
      </section>

      {/* Application de bureau seulement : la version, et la mise à
          jour à portée quand elle a été remise à plus tard. Sur le site, le
          bloc n'existe pas — ce n'est pas un état des données, c'est une
          autre app. */}
      {estBureau() && (
        <BlocApplication
          intitule={intitule(t.blocApplication)}
          classeCarte={groupes ? carteLg : 'border-t border-border/60'}
        />
      )}
    </div>
  );
}

// `bar` = à côté du hamburger, quand la nav est repliée : les réglages doivent
// rester accessibles en UN geste, donc jamais enfouis dans le menu. Même gabarit
// que le bouton hamburger (44 px, encadré) pour former une paire.
export default function SettingsMenu({
  onClearData,
  onSauvegarderSession,
  sauvegardeIndisponible = null,
  onKeepAccount,
  accountExportedAt,
}: {
  onClearData?: () => void;
  onSauvegarderSession?: () => void;
  // Pourquoi « Sauvegarder » est désactivé (le compte se relit encore), ou
  // `null`. Le bouton reste affiché, désactivé avec cette raison en infobulle.
  sauvegardeIndisponible?: string | null;
  onKeepAccount?: () => void;
  accountExportedAt?: number | null;
}) {
  const t = useTraduction().parametres;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // ⚠️ Une modale ouverte DEPUIS le popover (« Builds les plus rapides »)
      // est portalisée dans `<body>`, donc hors de `ref` : sans cette garde, le
      // premier clic dedans fermait le popover, qui la démontait avec lui.
      if ((e.target as Element | null)?.closest?.('[role="dialog"]')) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Échap ferme d'abord la modale ouverte par-dessus, pas le popover dessous.
    const onEsc = (e: KeyboardEvent) =>
      e.key === 'Escape' && !document.querySelector('[role="dialog"]') && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // ⚠️ La variante `bar` (44 px, encadrée) a disparu avec la barre mobile
  // qu'elle accompagnait : sur mobile, les réglages sont désormais une ICÔNE de
  // la barre supérieure menant à leur page, pas un popover.
  const btnClass = `aspect-square w-9 h-9 rounded-lg ${
    open ? 'bg-panel2 text-ink' : 'text-ink-dim hoverable:text-ink hoverable:bg-panel2'
  }`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t.blocReglages}
        title={t.blocReglages}
        className={`flex items-center justify-center transition ${btnClass}`}
      >
        {/* Les curseurs de Paramètres. */}
        <IconeParametres size={16} />
      </button>
      {open && (
        // ⚠️ Le `Flottant` de la librairie (les
        // bulles de l'app ont toutes le même gabarit) : il en était une copie
        // écrite à la main. Ancré à DROITE de son bouton, donc origine en haut
        // à droite : le menu sort de l'engrenage, pas de son propre centre.
        // ⚠️ `max-w-[calc(100vw-2rem)]` : ancré à droite de son bouton, le
        // popover sortait de l'écran sur un téléphone — les réglages les plus
        // à gauche devenaient inatteignables. `min-w` seul ne borne rien.
        <Flottant
          cote="droite"
          largeur="w-fit min-w-[260px] max-w-[calc(100vw-2rem)]"
          rembourrage="md"
        >
          <div className="flex items-baseline gap-3 border-b border-border pb-1.5">
            <span className="label">{t.blocReglages}</span>
            {/* ⚠️ Vers la PAGE : ce popover porte sept réglages dont deux à
                explication longue, et 260 px ne suffisent pas à les lire. Il
                reste le geste rapide ; la page est là pour s'y attarder. */}
            <a
              href="#/parametres"
              onClick={() => setOpen(false)}
              className="ml-auto text-micro text-accent transition hoverable:text-ink"
            >
              {t.toutVoir}
            </a>
          </div>
          <SettingsList
            onClearData={onClearData}
            onSauvegarderSession={onSauvegarderSession}
            sauvegardeIndisponible={sauvegardeIndisponible}
            onKeepAccount={onKeepAccount}
            accountExportedAt={accountExportedAt}
          />
        </Flottant>
      )}
    </div>
  );
}
