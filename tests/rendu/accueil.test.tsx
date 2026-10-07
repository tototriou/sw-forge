// Tests de rendu — l'accueil (`HomePage`). Principe dans
// tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et chaque
// information sont présentes, jamais l'apparence. Écrits AVANT le lot 5 de la
// refonte graphique : l'accueil
// est gardé tel quel et restylé (décision 10) — ces tests doivent rester verts
// sans qu'une assertion change.

import HomePage, { HomeStats } from '../../src/pages/HomePage';
import { RELEASES, libelleVersion } from '../../src/data/releases';
import { egal, ok, titre } from '../outils';
import { bouton, rendre, texteVisible } from './outils-rendu';

const VIDE: HomeStats = { rta: 0, defense: 0, offense: 0, recos: 0 };

function rendreAccueil(stats: HomeStats): string {
  return rendre(<HomePage stats={stats} onImport={() => {}} />);
}

// Chaque lien : sa destination et ce qu'il dit.
function liens(html: string): { href: string; texte: string; nouvelOnglet: boolean }[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, contenu]) => ({
    href: attrs.match(/\shref="([^"]*)"/)?.[1] ?? '',
    texte: texteVisible(contenu),
    nouvelOnglet: /\starget="_blank"/.test(attrs),
  }));
}

export function testRenduAccueil() {
  titre('rendu · Accueil — ce que la page dit et permet');

  const html = rendreAccueil(VIDE);
  const t = texteVisible(html);

  // Héros : le nom, l'accroche, la promesse.
  for (const s of [
    'SW Blacksmith', // rebranding R2 (« SW Forge » avant)
    'La boîte à outils pour Summoners War.',
    // (en deux morceaux : « dans ton navigateur » est en gras, et la balise
    // laisse un espace avant le point.)
    'Runes, RTA, siège, analyse de compte. Importe ton export SWEX et tout est calculé dans ton navigateur',
  ])
    ok(t.includes(s), `héros : « ${s} »`);

  // Zone de dépôt : un bouton (clavier compris), ses textes, son champ fichier.
  ok(/role="button"[^>]*tabindex="0"|tabindex="0"[^>]*role="button"/.test(html), 'zone de dépôt : role="button", atteignable au clavier');
  for (const s of ['Dépose ton fichier .json ici', 'ou clique pour parcourir', 'Export SWEX (.json)', 'lu dans la page, jamais envoyé'])
    ok(t.includes(s), `zone de dépôt : « ${s} »`);
  egal((html.match(/<input[^>]*type="file"[^>]*accept=".json,application\/json"/g) ?? []).length, 2, 'deux sélecteurs de fichier .json (zone de dépôt, dernier appel)');

  // « Ton espace » : absent sans données locales.
  ok(!t.includes('Ton espace'), 'sans données locales, pas de « Ton espace »');

  // Comment ça marche : trois étapes numérotées, le lien SW Exporter.
  ok(t.includes('Comment ça marche'), 'titre « Comment ça marche »');
  for (const [n, titreEtape, desc] of [
    ['01', 'Exporte ton compte', 'Génère un fichier .json de ton compte avec SW Exporter, en lançant le jeu une fois.'],
    ['02', 'Dépose le fichier', "Ici même, en haut de page. Rien n'est envoyé : tout se calcule dans ton navigateur."],
    ['03', 'Prépare et optimise', "Runes, prépa RTA, équipes de siège et analyse de compte se remplissent d'un seul coup."],
  ])
    ok(t.includes(`${n} ${titreEtape} ${desc}`), `étape ${n} : « ${titreEtape} », sa phrase`);
  const exporter = liens(html).find((l) => l.texte === 'SW Exporter');
  ok(exporter?.href === 'https://github.com/Xzandro/sw-exporter' && exporter.nouvelOnglet, 'lien SW Exporter, dans un nouvel onglet');

  // Fonctionnalités : chaque carte, sa destination, son kicker, son titre, sa
  // phrase — dans l'ordre de la page.
  ok(t.includes('Fonctionnalités'), 'titre « Fonctionnalités »');
  const CARTES: [string, string, string, string][] = [
    ['#/rta', 'RTA', 'Préparation RTA', "Classe ta box par set en glisser-déposer et lis l'ordre de tour recalculé selon les leads."],
    ['#/rta/ami', 'RTA', "Prépa d'un ami", "Ouvre la prépa qu'un ami t'a exportée — ou son export SWEX complet — et regarde son classement, ses vitesses et son ordre de tour."],
    ['#/siege/defense', 'Siège', 'Défenses et offenses', 'Compose tes équipes et vérifie tes speed tune sur les ticks 239 et 286.'],
    ['#/siege/recommandations', 'Partage', 'Recommandations', 'Décris tes decks, partage-les en JSON, et vois ce que ton compte peut jouer.'],
    ['#/compte/runes', 'Compte', 'Analyse de runes', 'Résumé chiffré, efficience ou score SW, courbes, et ce que tes meules et gemmes en réserve permettent d\'améliorer dès maintenant.'],
    ['#/compte/artefacts', 'Compte', "Analyse d'artéfacts", "Le score du jeu et l'efficience de chaque pièce, la distribution de ton stock et les propriétés que tu possèdes le plus."],
    ['#/outils/optimizer', 'Outils', 'Optimiseur de runes', 'Cherche, parmi les runes que tu possèdes déjà, la meilleure combinaison de 6 pour un monstre, un set et des minimums donnés.'],
    ['#/outils/speed-tuning', 'Outils', 'Speed tuning', "Tick par tick, vois quel monstre remplit sa barre d'action en premier — ton équipe et celle d'en face, pour savoir qui joue avant qui."],
    ['#/bestiary', 'Données', 'Bestiaire', 'Recherche et filtres par élément et étoiles naturelles, stats de base à portée de main.'],
    ['#/mecaniques', 'Doc', 'Mécaniques', "Vitesse de combat, barre d'action, équation des dégâts et facteur de défense."],
    ['#/releases', 'Suivi', 'Nouveautés', 'Ce qui change à chaque version : ajouts, corrections et calculs revus.'],
    // Application de bureau, décision 14 : site seulement (voir plus bas).
    ['#/telecharger', 'Application', 'Application de bureau', 'SW Blacksmith dans sa propre fenêtre, pour Windows et Linux, avec la mise à jour proposée à chaque version.'],
    ['#/arene', 'Arène · bientôt', 'Arène classique', "Préparation des équipes d'offense et de défense."],
  ];
  const tous = liens(html);
  for (const [href, kicker, titreCarte, phrase] of CARTES) {
    const carte = tous.find((l) => l.href === href && l.texte.includes(titreCarte));
    ok(!!carte && carte.texte === `${kicker} ${titreCarte} ${phrase}`, `carte « ${titreCarte} » → ${href}, kicker « ${kicker} », sa phrase`);
  }
  const ordre = tous.filter((l) => CARTES.some(([h, , ti]) => l.href === h && l.texte.includes(ti))).map((l) => l.href);
  egal(ordre, CARTES.map((c) => c[0]), 'les cartes dans l\'ordre de la page');

  // Dernier appel : le titre, la phrase, le bouton qui IMPORTE.
  ok(t.includes('Prêt à préparer tes équipes ?'), 'dernier appel : titre');
  ok(t.includes('Importe ton fichier SWEX et retrouve ta box, tes runes, ta prépa RTA et tes équipes de siège en quelques secondes.'), 'dernier appel : phrase');
  ok(!!bouton(html, 'Importer mon compte'), 'bouton « Importer mon compte »');

  // Quoi de neuf : la dernière version PUBLIÉE, son titre, le lien.
  const derniere = RELEASES.find((r) => r.version !== null) ?? RELEASES[0];
  const bandeau = tous.find((l) => l.href === '#/releases' && l.texte.includes('Voir les nouveautés'));
  ok(!!bandeau && bandeau.texte === `${libelleVersion(derniere.version)} ${derniere.title} Voir les nouveautés`, `bandeau « ${libelleVersion(derniere.version)} · ${derniere.title} » → #/releases`);
}

// Application de bureau, lot 6 (décisions 13 et 14) : le lien du héros vers
// la page « Télécharger » — sur le SITE ; dans l'app, rien.
export function testRenduAccueilBureau() {
  titre('rendu · Accueil — le lien vers « Télécharger »');
  const html = rendreAccueil(VIDE);
  const t = texteVisible(html);
  const tous = liens(html);
  const bouton = tous.find((l) => l.texte === "Télécharger l'application");
  ok(bouton?.href === '#/telecharger' && !bouton.nouvelOnglet, "« Télécharger l'application » : un lien vers #/telecharger");
  const contenu = [...html.matchAll(/<a\b[^>]*href="#\/telecharger"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => m[1])
    .find((c) => texteVisible(c) === "Télécharger l'application") ?? '';
  ok(contenu.indexOf('data-logo="windows"') >= 0 && contenu.indexOf('data-logo="windows"') < contenu.indexOf('data-logo="linux"'), 'ses logos : Windows puis Linux');
  const ligne = tous.find((l) => l.texte === 'Existe aussi en application pour Windows et Linux.');
  ok(ligne?.href === '#/telecharger', 'au téléphone : la ligne d\'information, en lien vers la page');
  // Dans le héros, sous la promesse, avant la zone de dépôt.
  ok(t.indexOf('dans ton navigateur') < t.indexOf("Télécharger l'application") && t.indexOf("Télécharger l'application") < t.indexOf('Dépose ton fichier'), 'sous la promesse, avant la zone de dépôt');
  ok(!t.includes('Télécharger pour Windows'), 'les téléchargements eux-mêmes sont sur la page, pas sur l\'accueil');

  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
  try {
    const appHtml = rendreAccueil(VIDE);
    const app = texteVisible(appHtml);
    ok(!app.includes("Télécharger l'application") && !app.includes('Existe aussi en application'), 'dans l\'app de bureau : ni bouton ni ligne');
    ok(!liens(appHtml).some((l) => l.href === '#/telecharger'), 'dans l\'app de bureau : pas de carte « Application de bureau »');
  } finally {
    delete pont.swblacksmithBureau;
  }
}

export function testRenduAccueilEspace() {
  titre('rendu · Accueil — « Ton espace » avec des données locales');

  const html = rendreAccueil({ rta: 12, defense: 1, offense: 0, recos: 3 });
  const t = texteVisible(html);
  ok(t.includes('Ton espace'), 'titre « Ton espace »');

  // Chaque tuile : sa sous-section exacte, son libellé, le chiffre et l'unité
  // accordée ; une valeur à 0 est AFFICHÉE (atténuée, pas masquée).
  const TUILES: [string, string, string][] = [
    ['#/rta', 'Prépa RTA', '12 monstres'],
    ['#/siege/defense', 'Défense de siège', '1 équipe'],
    ['#/siege/offense', 'Offense de siège', '0 équipe'],
    ['#/siege/recommandations', 'Recommandations', '3 recos'],
  ];
  const tous = liens(html);
  for (const [href, libelle, valeur] of TUILES)
    ok(tous.some((l) => l.href === href && l.texte === `${libelle} ${valeur}`), `tuile « ${libelle} » → ${href} : « ${valeur} »`);

  // Une seule donnée suffit à faire apparaître le bloc.
  ok(texteVisible(rendreAccueil({ ...VIDE, recos: 1 })).includes('Ton espace'), 'une seule reco suffit à afficher « Ton espace »');
  ok(texteVisible(rendreAccueil({ ...VIDE, recos: 1 })).includes('1 reco'), 'unité au singulier : « 1 reco »');
}
