// Sélection des écrans du banc d'affichage d'après des fichiers modifiés
// (tests/banc/selection.ts, table tests/banc/ecrans.ts). Sans navigateur ni
// Git : le lanceur donne les chemins, la vérification en donne d'autres.

import { readdirSync } from 'fs';
import { ECRANS, MOTIFS_TOUS, ORDRE_FORMATS } from './banc/ecrans';
import { casesExercees, formatsRetenus, lireFiltres, motifFiltre, RefusFiltre } from './banc/filtres';
import { couvre, ecransPourFichiers, motifsPartages } from './banc/selection';
import { egal, ok } from './outils';
import { verifierContratsBanc } from './banc/contrats';

const ids = (fichiers: string[]) => ecransPourFichiers(fichiers).ecrans.map((e) => e.id);

export default function testBancSelection() {
  verifierContratsBanc();
  // Trois fichiers d'exemple, trois formes de motif.
  egal(ids(['src/components/outils/SpeedTuningSection.tsx']), ['optimizer', 'speed-tuning'], 'dossier partagé (outils/) : les deux écrans d’Outils');
  egal(ids(['src/pages/HomePage.tsx']), ['accueil'], 'page propre à un écran : cet écran seul');
  egal(
    ids(['src/components/rta/RtaCard.tsx']),
    ['rta', 'rta-ami'],
    'dossier de composants d’une section à deux routes : les deux routes',
  );
  egal(ids(['src/lib/speedTuneLignes.ts']), ['speed-tuning'], 'motif à préfixe (speedTune*) : le fichier de lignes du speed tuning');

  // Un fichier dans plusieurs motifs de plusieurs écrans les sélectionne tous.
  egal(
    ids(['src/data/releases.ts']),
    ['accueil', 'nouveautes'],
    'un fichier lu par deux écrans (journal des versions) : les deux',
  );
  const siege = ids(['src/components/outils/SpeedTuneModale.tsx']);
  ok(
    ['optimizer', 'speed-tuning', 'siege-defense', 'siege-offense', 'siege-recommandations'].every((i) => siege.includes(i)),
    'la modale de speed tuning est montée par le siège : ses trois écrans y sont aussi',
  );

  // Règle « tous ».
  for (const f of ['src/ui/Button.tsx', 'src/ui/index.ts', 'src/index.css', 'tailwind.config.js']) {
    egal(ids([f]).length, ECRANS.length, `règle « tous » : ${f}`);
    egal(ecransPourFichiers([f]).details[0].regle, 'tous', `règle « tous » : ${f} est étiquetée « tous »`);
  }

  // Le coquillage enveloppe chaque page.
  for (const f of ['src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/TopBar.tsx', 'src/components/MobileTabs.tsx', 'src/components/palette/recherchePalette.ts']) {
    egal(ecransPourFichiers([f]).details[0].regle, 'tous', `coquillage : ${f} sélectionne tous les écrans`);
  }

  // Repli : un fichier de src/ que nul motif ne couvre sélectionne tous les écrans.
  for (const f of ['src/lib/damage.ts', 'src/hooks/useMonsters.ts', 'src/main.tsx']) {
    const rep = ecransPourFichiers([f]);
    egal(rep.details[0].regle, 'repli', `repli : ${f} hors table`);
    egal(rep.ecrans.length, ECRANS.length, `repli : ${f} sélectionne tous les écrans`);
    egal(rep.horsTable, [], `repli : ${f} n'est pas « hors table » sans écran`);
  }

  // Un fichier hors de toute table : aucun écran, signalé.
  const hors = ecransPourFichiers(['docs/README.md', 'scripts/fetch-monsters.mjs']);
  egal(hors.ecrans.length, 0, 'fichiers hors table : aucun écran');
  egal(hors.horsTable, ['docs/README.md', 'scripts/fetch-monsters.mjs'], 'fichiers hors table (hors de src/) : signalés');
  egal(hors.details.map((d) => d.regle), ['aucun', 'aucun'], 'fichiers hors table : règle « aucun »');

  // Mélange : l'union, dans l'ordre de la table, les fichiers hors table signalés à part.
  const melange = ecransPourFichiers(['src/pages/MechanicsPage.tsx', 'src/pages/ComingSoon.tsx', 'README.md']);
  egal(melange.ecrans.map((e) => e.id), ['mecaniques', 'arene'], 'union des écrans, dans l’ordre de la table');
  egal(melange.horsTable, ['README.md'], 'le fichier hors table reste signalé à côté des autres');

  // Normalisation et doublons.
  egal(ids(['.\x5csrc\x5cpages\x5cHomePage.tsx', 'src/pages/HomePage.tsx']), ['accueil'], 'séparateurs Windows et doublon normalisés');
  egal(ecransPourFichiers([]).ecrans.length, 0, 'aucun fichier : aucun écran');

  // Forme des motifs : un nom sans extension ne couvre pas un voisin au nom plus long.
  ok(couvre('src/lib/crafts', 'src/lib/crafts.ts'), 'motif sans extension : le fichier');
  ok(!couvre('src/lib/crafts', 'src/lib/craftsExtra.ts'), 'motif sans extension : pas le voisin au nom plus long');
  ok(couvre('src/ui/', 'src/ui/a/b.tsx'), 'motif de dossier : tout ce qui est dessous');
  ok(!couvre('src/ui/', 'src/uiX/a.tsx'), 'motif de dossier : pas un dossier voisin');

  // Table : identifiants et routes distincts, motifs partagés dits.
  egal(new Set(ECRANS.map((e) => e.id)).size, ECRANS.length, 'identifiants d’écran distincts');
  const hashs = ECRANS.flatMap((e) => [e.hash, ...(e.alias ?? [])]);
  egal(new Set(hashs).size, hashs.length, 'chaque adresse (route ou alias) n’appartient qu’à un écran');
  ok(ECRANS.every((e) => e.motifs.length > 0), 'chaque écran a au moins un motif');
  // Un motif qui ne couvre aucun fichier du dépôt est une faute de frappe ou un
  // fichier disparu : la table ne verrait plus rien changer.
  const fichiersSrc = readdirSync('src', { recursive: true })
    .map((f) => 'src/' + String(f).split(String.fromCharCode(92)).join('/'));
  // Les fichiers que le banc charge (tests/fixtures/) sont aussi des entrées de la table.
  const fichiersFixtures = readdirSync('tests/fixtures').map((f) => 'tests/fixtures/' + f);
  const tous = [...fichiersSrc, ...fichiersFixtures, 'tailwind.config.js'];
  const orphelins = [...new Set(ECRANS.flatMap((e) => e.motifs)), ...MOTIFS_TOUS].filter(
    (m) => !tous.some((f) => couvre(m, f)),
  );
  egal(orphelins, [], 'chaque motif de la table couvre au moins un fichier du dépôt');
  const partages = motifsPartages();
  const rta = partages.find((p) => p.motif === 'src/components/rta/');
  egal(rta?.ecrans, ['rta', 'rta-ami'], 'motifsPartages dit les écrans d’un motif commun');

  verifierFiltres();
}

// Filtres --etats / --tailles du lanceur (banc/filtres.ts).
function verifierFiltres() {
  const optimizer = ECRANS.filter((e) => e.id === 'optimizer');
  const refuse = (brut: { etats?: string; tailles?: string }, motif: RegExp) => {
    try { lireFiltres(optimizer, brut); return false; } catch (e) { return e instanceof RefusFiltre && motif.test(e.message); }
  };
  ok(refuse({ etats: 'resultat-tableau' }, /--etats : inconnu.*resultat-tableau[\s\S]*connus : .*resultats-tableau/), 'un état mal orthographié : refusé, les connus listés');
  ok(refuse({ tailles: 'bureau' }, /--tailles : inconnu.*bureau/), 'une taille inconnue : refusée');
  ok(refuse({ etats: 'reco-defense' }, /inconnu des écrans retenus/), 'un état d’un autre écran que ceux retenus : refusé');
  ok(refuse({ etats: ' , ' }, /au moins un identifiant/), 'une liste vide : refusée');

  const sans = lireFiltres(optimizer, {});
  const toutes = casesExercees(optimizer, sans);
  const f = lireFiltres(optimizer, { etats: 'resultats-tableau', tailles: 'ordinateur,volet-groupe' });
  egal(casesExercees(optimizer, f).map((c) => `${c.etat}@${c.taille}`), ['resultats-tableau@ordinateur', 'resultats-tableau@volet-groupe'],
    'un état et deux tailles : ces deux cases seules');
  ok(toutes.length > 100 && casesExercees(optimizer, lireFiltres(optimizer, { etats: 'defaut' })).every((c) => c.etat === 'defaut'),
    `sans filtre, toute la grille (${toutes.length} cases) ; --etats defaut : cet état seul`);
  egal(motifFiltre(f, 'defaut', 'ordinateur'), 'état non retenu (--etats)', 'motif d’une case écartée par l’état');
  egal(motifFiltre(f, 'resultats-tableau', 'telephone'), 'taille non retenue (--tailles)', 'motif d’une case écartée par la taille');
  egal(motifFiltre(sans, 'resultats', 'telephone'), null, 'sans filtre, aucune case écartée par lui');

  // Un état réservé à d'autres tailles : aucune case, le lanceur refuse avant la construction.
  egal(casesExercees(optimizer, lireFiltres(optimizer, { etats: 'set-flottant', tailles: 'ordinateur' })), [], 'set-flottant à 1400 × 1000 : aucune case exerçable');
  egal(formatsRetenus(optimizer, lireFiltres(optimizer, { tailles: 'ordinateur' }), ORDRE_FORMATS), ['ordinateur'], 'une taille de bureau seule : le compte n’est importé qu’au format ordinateur');
  egal(formatsRetenus(optimizer, sans, ORDRE_FORMATS), ['telephone', 'ordinateur'], 'sans filtre : les deux formats');
}
