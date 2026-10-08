// Barre latérale : la clé de destination qui REPOSE son niveau (voir
// docs/02-app/transverse/, « L'état de la barre : trois valeurs »).
//
// ⚠️ Défaut corrigé : la clé ne valait que le titre de SECTION. Choisir une
// sous-section par le panneau de survol, dans la section où l'on se trouvait
// déjà, laissait donc la clé identique — aucune remise à zéro, et la barre
// restait au premier niveau. Le même geste vers une AUTRE section, lui,
// faisait bien descendre la barre : deux comportements pour un seul geste.

import { readFileSync } from 'fs';
import { cleRouteBarre, SidebarGroupe, SidebarSection } from '../src/components/Sidebar';
import { egal, ok, titre } from './outils';

// Fabrique minimale : seuls `key` et `actif` comptent pour la clé.
function lien(key: string, actif: boolean) {
  return { key, label: key, icon: null, actif };
}
function sectionOutils(actifKey: string): SidebarSection {
  return {
    titre: 'Outils',
    icon: null,
    groupes: [
      {
        liens: [
          lien('outils-optimizer', actifKey === 'outils-optimizer'),
          lien('outils-speed-tuning', actifKey === 'outils-speed-tuning'),
          lien('outils-edition-json', actifKey === 'outils-edition-json'),
        ],
      },
    ],
  };
}
function premierNiveau(actifKey: string): SidebarGroupe[] {
  return [
    {
      liens: [
        lien('accueil', actifKey === 'accueil'),
        lien('bestiary', actifKey === 'bestiary'),
        lien('outils', actifKey === 'outils'),
        lien('compte', actifKey === 'compte'),
      ],
    },
  ];
}

export default function testNavigation() {
  titre('Navigation — barre latérale');

  /* --- LE défaut : deux sous-sections de la MÊME section --------------- */

  const surOptimizer = cleRouteBarre(sectionOutils('outils-optimizer'), premierNiveau('outils'));
  const surSpeedTune = cleRouteBarre(sectionOutils('outils-speed-tuning'), premierNiveau('outils'));
  ok(
    surOptimizer !== surSpeedTune,
    'deux sous-sections de la même section donnent des clés DIFFÉRENTES — c’est ce qui manquait au panneau de survol'
  );

  // La preuve du défaut : le seul titre de section ne les distinguait pas.
  egal(
    sectionOutils('outils-optimizer').titre,
    sectionOutils('outils-speed-tuning').titre,
    'le titre de section, lui, est identique dans les deux cas'
  );

  /* --- Ce qui marchait déjà ne doit pas régresser ---------------------- */

  const surCompte = cleRouteBarre(
    { titre: 'Mon compte', icon: null, groupes: [{ liens: [lien('compte-monstres', true)] }] },
    premierNiveau('compte')
  );
  ok(surCompte !== surOptimizer, 'deux sections différentes donnent toujours des clés différentes');

  /* --- Stabilité : même destination, même clé -------------------------- */

  egal(
    cleRouteBarre(sectionOutils('outils-optimizer'), premierNiveau('outils')),
    surOptimizer,
    'la même destination donne toujours la même clé — sinon la barre se rabattrait à chaque rendu'
  );

  /* --- Pages SANS section ---------------------------------------------- */

  const accueil = cleRouteBarre(null, premierNiveau('accueil'));
  const bestiaire = cleRouteBarre(null, premierNiveau('bestiary'));
  ok(
    accueil !== bestiaire,
    'deux pages sans sous-sections se distinguent aussi — sinon la barre garderait une section ouverte en passant de l’une à l’autre'
  );

  /* --- CONTRÔLE DE SOURCE : le câblage React n'est pas testable ici ----- */

  {
    const src = readFileSync('src/components/Sidebar.tsx', 'utf8');
    // Refonte graphique, lot 4 : la section n'est plus passée à la barre, elle
    // la déduit de l'entrée active (`sectionRoute`) — la clé reste la même.
    ok(
      src.includes('const cleRoute = cleRouteBarre(sectionRoute, groupes);'),
      'la barre utilise bien la clé élargie, pas le seul titre de section'
    );
    ok(
      !src.includes('const cleRoute = section?.titre ?? null;'),
      'l’ancienne clé, limitée à la section, a disparu'
    );

    // Le panneau de survol, qui avait ici son propre contrôle (il devait
    // reposer la barre au clic), a été retiré par le mainteneur le 2026-09-24
    // ([retrait #12] du cadrage de la refonte graphique). On vérifie qu'il ne
    // revient pas par morceaux.
    ok(
      !src.includes('— sous-sections`}') && !src.includes('onMouseEnter'),
      'plus d’aperçu au survol à côté de la barre ([retrait #12])'
    );
  }
}
