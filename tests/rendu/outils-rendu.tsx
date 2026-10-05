// Outils des tests de RENDU — refonte graphique, `spec/chantiers/refonte-graphique.md`.
//
// Un test de rendu affiche un vrai composant avec des données d'exemple
// (`react-dom/server`, sans navigateur) et vérifie qu'une FONCTIONNALITÉ ou une
// INFORMATION est présente : un bouton et son libellé, son état désactivé et
// la raison donnée en infobulle, un badge, un texte.
//
// ⚠️ On interroge le SENS, jamais la forme : texte visible, `aria-label`,
// `title`, `disabled`, rôle. Jamais une classe CSS, une couleur, une position
// ou un ordre de balises — la refonte les change, et c'est voulu. Un test de
// rendu qui casse pendant la refonte signale une fonctionnalité perdue, pas un
// changement d'apparence.
//
// ⚠️ Rendu serveur : les `useEffect` ne tournent pas. Un composant qui charge
// ses données dans un effet s'affiche dans son état initial ; on lui passe
// donc ses données en props (ou via le faux `localStorage`, que les hooks
// lisent de façon synchrone).

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// En rendu serveur, `useLayoutEffect` ne fait rien et React le signale à
// chaque rendu (`MobileSheet`, la barre du haut…). Il ne tourne pas plus
// qu'un `useEffect` ici : on l'aligne dessus pour taire un bruit qui noierait
// les vraies sorties des tests. Par `require` : un import ES est immuable,
// l'objet module CommonJS (le même que celui des composants) ne l'est pas.
const reactModule = require('react') as { useLayoutEffect: unknown; useEffect: unknown };
reactModule.useLayoutEffect = reactModule.useEffect;

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'", nbsp: ' ' };
const decoder = (s: string) => s.replace(/&(#x27|#39|amp|lt|gt|quot|nbsp);/g, (_, e) => ENTITES[e]);

export function rendre(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

// Le texte qu'un joueur lit : balises retirées, espaces fusionnés.
export function texteVisible(html: string): string {
  return decoder(html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attr(balise: string, nom: string): string | null {
  const m = balise.match(new RegExp(`\\s${nom}="([^"]*)"`));
  return m ? decoder(m[1]) : null;
}

export interface Bouton {
  texte: string;
  ariaLabel: string | null;
  title: string | null;
  desactive: boolean;
  // `aria-pressed` : true / false pour un bouton à deux états, null sinon.
  presse: boolean | null;
}

// Tous les boutons, avec ce qui les nomme et leur état.
export function boutons(html: string): Bouton[] {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, contenu]) => {
    const presse = attr(attrs, 'aria-pressed');
    return {
      texte: texteVisible(contenu),
      ariaLabel: attr(attrs, 'aria-label'),
      title: attr(attrs, 'title'),
      desactive: /\sdisabled(=""|\s|$)/.test(attrs),
      presse: presse === null ? null : presse === 'true',
    };
  });
}

// Le bouton nommé `nom` (texte, aria-label ou title), ou undefined.
export function bouton(html: string, nom: string): Bouton | undefined {
  return boutons(html).find((b) => b.texte === nom || b.ariaLabel === nom || b.title === nom || b.texte.includes(nom));
}

// Toutes les valeurs d'un attribut dans la page (ex. tous les `title`).
export function valeurs(html: string, nom: string): string[] {
  return [...html.matchAll(new RegExp(`\\s${nom}="([^"]*)"`, 'g'))].map((m) => decoder(m[1]));
}

// ⚠️ **Rendu TÉLÉPHONE** (refonte graphique, lot 11). Les panneaux « Options »
// (`MobileSheet`) ne s'affichent qu'au format téléphone, lu par `matchMedia`,
// et passent par un PORTAIL — deux choses qu'un rendu serveur n'a pas : sans
// navigateur, le panneau rend `null` et son contenu échappe aux tests. On
// simule donc, LE TEMPS DU RENDU seulement :
//   - `window.matchMedia` : vrai pour les requêtes « au plus » (`max-width`,
//     donc SOUS_LG, SOUS_SM), faux pour le reste — une largeur de téléphone ;
//   - `document` (et son `body`), que le panneau et la `Modale` exigent avant
//     de monter leur portail ;
//   - `createPortal`, qui rend son contenu EN PLACE au lieu de l'envoyer
//     ailleurs : c'est ce qui le fait apparaître dans le HTML rendu.
// Aucun code de l'app n'est modifié pour autant.
const reactDom = require('react-dom') as { createPortal: unknown };
export function auTelephone<T>(faire: () => T): T {
  const g = globalThis as Record<string, unknown>;
  const avant = { window: g.window, document: g.document, createPortal: reactDom.createPortal };
  g.window = {
    matchMedia: (q: string) => ({ matches: q.includes('max-width'), addEventListener() {}, removeEventListener() {} }),
  };
  // `body` : la `Modale` vérifie qu'elle a où se monter avant son portail.
  g.document = { body: {} };
  reactDom.createPortal = (enfants: unknown) => enfants;
  try {
    return faire();
  } finally {
    g.window = avant.window;
    g.document = avant.document;
    reactDom.createPortal = avant.createPortal;
  }
}
