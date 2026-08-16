import { ReactNode } from 'react';
import { motion } from 'framer-motion';

// Barre d'onglets du BAS — la navigation sous `lg`.
//
// ⚠️ **En bas, pas en haut.** Sur un téléphone tenu à une main, le haut de
// l'écran est hors d'atteinte du pouce ; le bas est la seule zone confortable.
// C'est aussi ce que font les applications du téléphone lui-même, donc le geste
// est déjà acquis.
//
// ⚠️ **Cinq entrées au maximum.** Au-delà, les cibles passent sous 44 px de
// large et on tape à côté. L'app en compte neuf : les cinq principales sont
// ici, les autres restent atteignables par leur page. Ce qui reste visible
// n'est donc pas un choix esthétique — c'est ce que la largeur d'un pouce
// autorise.
//
// ⚠️ **`env(safe-area-inset-bottom)`** : sans lui, la barre passe sous la barre
// de geste des iPhone récents et le dernier onglet devient intouchable.

export interface OngletMobile {
  key: string;
  label: string;
  hash: string;
  icon: ReactNode;
  actif: boolean;
}

export default function MobileTabs({ onglets }: { onglets: OngletMobile[] }) {
  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-5">
        {onglets.map((o) => (
          <a
            key={o.key}
            href={o.hash}
            aria-current={o.actif ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2.5 text-[9.5px]
                        leading-none transition-colors ${
                          o.actif ? 'text-ctx' : 'text-ink-dimmer'
                        }`}
          >
            {/* ⚠️ **UN SEUL** trait, qui GLISSE d'un onglet à l'autre
                (`layoutId`) au lieu de disparaître ici pour réapparaître là.
                Le déplacement montre d'où l'on vient — c'est la seule chose
                qu'une barre d'onglets peut dire de plus qu'un simple surlignage.
                Posé en HAUT : en bas, il tomberait dans la zone de geste du
                téléphone. */}
            {o.actif && (
              <motion.span
                layoutId="onglet-actif"
                className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-ctx"
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            )}
            {o.icon}
            {o.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
