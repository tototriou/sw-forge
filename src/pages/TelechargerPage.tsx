import { ExternalLink } from 'lucide-react';
import { LogoLinux, LogoWindows } from '../components/IconesSystemes';
import { RELEASES, libelleVersion } from '../data/releases';
import { DEPOT, TELECHARGEMENTS } from '../lib/bureau';
import { NOM_APP } from '../marque';
import { Bouton } from '../ui';

// La page « Télécharger » (`#/telecharger`) — application de bureau, lot 6,
// décision 14 de Thomas. SITE seulement : dans l'app, ni entrée ni route
// (App.tsx).
//
// ⚠️ Un clic télécharge le FICHIER de la dernière version publiée
// (`…/releases/latest/download/…`, noms sans version — décision 13), pas la
// page de la release, où il faudrait le chercher parmi les fichiers de la
// mise à jour. Pas de signature (décision 2) : la phrase dit comment passer
// l'avertissement de Windows, avec SES libellés.
// ⚠️ **Au téléphone, sans boutons** : ni un `.exe` ni une AppImage ne s'y
// installent (`lg:`, deux formats, deux contenus).

const ATOUTS: { titre: string; texte: string }[] = [
  { titre: 'Sa propre fenêtre', texte: 'Hors du navigateur, à la taille que tu lui donnes, lancée comme n\'importe quel logiciel.' },
  { titre: 'La mise à jour proposée', texte: "À chaque nouvelle version, l'application te propose de se mettre à jour. C'est toi qui décides quand." },
  { titre: '100 % local', texte: "Comme le site : rien n'est envoyé, tout reste sur ta machine." },
];

export default function TelechargerPage() {
  // La version que télécharge `releases/latest` : la dernière PUBLIÉE (une
  // version en préparation est en tête du journal sans être en ligne).
  const derniere = RELEASES.find((r) => r.version !== null) ?? RELEASES[0];
  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] text-ink mb-2">Télécharger</h1>
      <p className="text-ink-dim text-sm leading-relaxed mb-6">
        {`${NOM_APP} existe en application de bureau pour Windows et Linux : la même boîte à outils, dans sa propre fenêtre.`}
      </p>

      <ul className="mb-8 grid gap-3 sm:grid-cols-3">
        {ATOUTS.map((a) => (
          <li key={a.titre} className="rounded-xl border border-border-soft bg-panel px-4 py-3">
            <p className="text-sm font-semibold text-ink">{a.titre}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">{a.texte}</p>
          </li>
        ))}
      </ul>

      {/* À l'ordinateur : les deux téléchargements. */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap gap-3">
          <Bouton
            ton="accent"
            fond="plein"
            href={TELECHARGEMENTS.windows}
            icone={<LogoWindows size={15} />}
            libelle="Télécharger pour Windows"
          />
          <Bouton
            ton="accent"
            fond="plein"
            href={TELECHARGEMENTS.linux}
            icone={<LogoLinux size={15} />}
            libelle="Télécharger pour Linux"
          />
        </div>
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-dim">
          Windows peut afficher « Windows a protégé votre ordinateur » : clique sur « Informations
          complémentaires », puis sur « Exécuter quand même ».
        </p>
      </div>

      {/* Au téléphone : rien à installer ici. */}
      <p className="text-sm text-ink lg:hidden">À installer depuis un ordinateur Windows ou Linux.</p>

      <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-dim">
        <span>{`Version proposée : ${libelleVersion(derniere.version)}`}</span>
        <a
          href={`${DEPOT}/releases`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent hoverable:text-ink transition"
        >
          Toutes les versions sur GitHub <ExternalLink size={12} />
        </a>
      </p>
    </div>
  );
}
