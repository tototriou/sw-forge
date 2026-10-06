import { ReactNode, useEffect, useState } from 'react';
import {
  EtatMiseAJour,
  EtatSwex,
  rechercherMiseAJour,
  redemarrerPourMettreAJour,
  suivreMiseAJour,
  telechargerMiseAJour,
} from '../lib/bureau';
import { useEtatSwex } from '../hooks/useEtatSwex';
import Bouton from '../ui/Bouton';
import Selecteur from '../ui/Selecteur';

// Le bloc « Application » des Réglages — application de bureau seulement
// (lot 5, décision 12). ⚠️ **La mise à jour reste à portée** : remise à plus
// tard (la croix de la notification), elle se fait ici quand il veut. UN
// bouton, toujours affiché, qui suit la phase (bureau/miseAJour.ts) —
// désactivé quand il n'y a rien à faire, jamais retiré.

export interface PresentationMiseAJour {
  libelle: string;
  // Absente : bouton désactivé.
  action?: () => void;
  // La ligne sous la version — toujours une : le bloc ne change pas de
  // hauteur d'une phase à l'autre.
  texte: string;
}

// Pure : ce que le bloc montre pour un état (`null` : la page n'a encore rien
// reçu, comme « aucune »).
export function presentationMiseAJour(etat: EtatMiseAJour | null): PresentationMiseAJour {
  switch (etat?.phase ?? 'aucune') {
    case 'aucune':
      return { libelle: 'Rechercher', action: rechercherMiseAJour, texte: 'Les nouvelles versions sont cherchées au lancement.' };
    case 'recherche':
      return { libelle: 'Recherche…', texte: "Recherche d'une nouvelle version…" };
    case 'a-jour':
      return { libelle: 'Rechercher', action: rechercherMiseAJour, texte: 'Tu as la dernière version.' };
    case 'injoignable':
      return { libelle: 'Rechercher', action: rechercherMiseAJour, texte: 'Impossible de vérifier : pas de connexion ?' };
    case 'disponible':
      return { libelle: 'Mettre à jour', action: telechargerMiseAJour, texte: `Nouvelle version ${etat!.version} disponible.` };
    case 'telechargement':
      return { libelle: 'Téléchargement…', texte: `Téléchargement de la version ${etat!.version}…` };
    case 'prete':
      return {
        libelle: 'Redémarrer',
        action: redemarrerPourMettreAJour,
        texte: `Version ${etat!.version} prête : installée au redémarrage, ou à la fermeture de l'app.`,
      };
    case 'echec':
      return { libelle: 'Réessayer', action: telechargerMiseAJour, texte: "Le téléchargement n'a pas abouti." };
  }
}

export default function BlocApplication({ classeCarte, intitule }: { classeCarte: string; intitule?: ReactNode }) {
  const [etat, setEtat] = useState<EtatMiseAJour | null>(null);
  useEffect(() => suivreMiseAJour(setEtat), []);
  const p = presentationMiseAJour(etat);
  return (
    // `data-bloc-application` : repère du mode preuve (bureau/preuve.ts).
    <section data-bloc-application>
      {intitule}
      <div className={classeCarte}>
        <div className="py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">Version {__APP_VERSION__}</span>
            {/* ⚠️ Largeur réservée : « Rechercher » → « Recherche… » ne
                déplace pas le bouton qu'on vient de cliquer. */}
            <Bouton
              taille="sm"
              libelle={p.libelle}
              onClick={p.action}
              disabled={!p.action}
              className="flex-none min-w-[8.5rem]"
            />
          </div>
          <p className="mt-1 text-micro text-ink-dim leading-snug">{p.texte}</p>
        </div>
        <ReglageSwex />
      </div>
    </section>
  );
}

// ── Le dossier SW Exporter (lot 9, décision 15) ─────────────────────────────

const date = (ms: number) =>
  new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export interface PresentationSwex {
  // La ligne sous « Dossier SW Exporter ».
  dossier: string;
  // Les choix d'invocateur (vide : sélecteur désactivé).
  options: { valeur: string; libelle: string }[];
  // La ligne sous « Invocateur ».
  invocateur: string;
}

// Pure : ce que montrent les deux lignes pour un état (`null` : rien reçu).
// Toujours une ligne sous chacune (hauteur constante).
export function presentationSwex(etat: EtatSwex | null): PresentationSwex {
  if (!etat?.dossier) {
    return {
      dossier: 'Choisis le dossier où SW Exporter enregistre ses exports : « Mon compte » suivra chaque nouvel export.',
      options: [],
      invocateur: 'Aucun dossier choisi.',
    };
  }
  if (etat.introuvable) {
    return { dossier: etat.dossier, options: [], invocateur: 'Dossier introuvable : vérifie qu’il existe encore, ou choisis-en un autre.' };
  }
  // Deux invocateurs du même nom (deux serveurs) : l'identifiant les sépare.
  const homonymes = new Set(etat.exports.filter((e, i, t) => t.findIndex((x) => x.nom === e.nom) !== i).map((e) => e.nom));
  const options = etat.exports.map((e) => ({ valeur: e.fichier, libelle: homonymes.has(e.nom) ? `${e.nom} (${e.id})` : e.nom }));
  if (options.length === 0) {
    return { dossier: etat.dossier, options, invocateur: 'Aucun export de compte à la racine de ce dossier.' };
  }
  const suivi = etat.exports.find((e) => e.fichier === etat.fichier);
  if (!suivi) return { dossier: etat.dossier, options, invocateur: 'Choisis l’invocateur à suivre.' };
  const invocateur =
    etat.dernierLu !== null && etat.dernierLu >= suivi.modifie
      ? `Export du ${date(suivi.modifie)} — lu.`
      : `Export du ${date(suivi.modifie)} — lecture en cours…`;
  return { dossier: etat.dossier, options, invocateur };
}

// Le choix de l'invocateur se fait AUSSI depuis la carte du compte, en tête de
// la barre latérale (SidebarCompte) : un seul réglage, deux accès.
function ReglageSwex() {
  const { etat, agir } = useEtatSwex();
  const p = presentationSwex(etat);
  return (
    // `data-reglage-swex` : repère du mode preuve (bureau/preuve.ts).
    <div data-reglage-swex className="border-t border-border/60">
      <div className="py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">Dossier SW Exporter</span>
          <div className="flex flex-none gap-2">
            {/* Toujours affiché, désactivé sans dossier : il ne disparaît pas
                selon l'état. */}
            <Bouton
              taille="sm"
              fond="vide"
              trait="aucun"
              libelle="Retirer"
              title="Ne plus suivre de dossier SW Exporter"
              disabled={!etat?.dossier}
              onClick={() => void agir((s) => s.oublier())}
            />
            <Bouton taille="sm" libelle="Choisir…" onClick={() => void agir((s) => s.choisirDossier())} />
          </div>
        </div>
        <p className="mt-1 break-all text-micro leading-snug text-ink-dim">{p.dossier}</p>
      </div>
      <div className="border-t border-border/60 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">Invocateur</span>
          <Selecteur
            taille="sm"
            pleineLargeur={false}
            aria-label="Invocateur à suivre"
            value={etat?.fichier ?? ''}
            disabled={p.options.length === 0}
            onChange={(e) => {
              const fichier = e.target.value;
              if (fichier) void agir((s) => s.choisirInvocateur(fichier));
            }}
            className="min-w-[10rem]"
          >
            <option value="" disabled>
              {p.options.length === 0 ? '—' : 'Choisir…'}
            </option>
            {p.options.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </Selecteur>
        </div>
        <p className="mt-1 text-micro leading-snug text-ink-dim">{p.invocateur}</p>
      </div>
    </div>
  );
}
