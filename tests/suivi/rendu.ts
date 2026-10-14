// Suivi en direct des vérifications (tests/suivi.mjs) : ce qu'il lit et ce
// qu'il dessine. Calcul pur, sans terminal ni fichier : tests/suivi.test.ts.
//
// ⚠️ **Il lit le manifeste d'exécution** (tests/execution.ts), que le lanceur
// réécrit toutes les 250 ms, et la sortie du lanceur pour le TEXTE des échecs,
// que le manifeste ne porte pas. Il ne change rien au lanceur ni à ce qu'il
// vérifie : c'est un affichage.
//
// ⚠️ Écrit sans syntaxe propre à TypeScript hors des types (ni `enum`, ni
// propriété de paramètre) : tests/suivi.mjs l'importe directement, Node
// retirant les types.

/** Une entrée du manifeste (`JournalEntree` de tests/execution.ts). */
export interface EntreeManifeste {
  id: string;
  etat: 'attendue' | 'invoquée' | 'rendue' | 'exception';
  controles: number;
  echecs: number;
  ignores: number;
  dureeMs: number | null;
  exception: string | null;
}

/** Ce que le suivi lit du manifeste. */
export interface Manifeste {
  etat: string;
  complet: boolean;
  bilan: { attendues: number | null; controles: number; echecs: number; ignores: number };
  /** Les constats de la validation finale : `null` tant qu'elle n'a pas eu lieu. */
  echecs: string[] | null;
  entrees: EntreeManifeste[];
}

export interface EchecSortie {
  titre: string;
  texte: string;
}

export interface EtatSuivi {
  manifeste: Manifeste | null;
  echecs: EchecSortie[];
  /** Le dernier titre de vérification lu sur la sortie. */
  titre: string;
  fin: { code: number | null; signal: string | null; a: number } | null;
  debut: number;
  maintenant: number;
}

export type ClasseEntree = 'attendue' | 'cours' | 'ok' | 'ignoree' | 'ko';

export function classeEntree(e: EntreeManifeste): ClasseEntree {
  if (e.etat === 'invoquée') return 'cours';
  if (e.etat === 'exception' || e.echecs > 0) return 'ko';
  if (e.etat === 'rendue') return e.controles === 0 && e.ignores > 0 ? 'ignoree' : 'ok';
  return 'attendue';
}

export interface Avancement {
  faites: number;
  attendues: number;
  /** 0 à 100, arrondi vers le bas : 100 seulement quand tout est fait. */
  pct: number;
  termine: boolean;
  /** Un échec vu (manifeste ou sortie), ou un code de sortie non nul. */
  ko: boolean;
  /** Estimation du temps restant, sur la durée moyenne des entrées faites ; `null` trop tôt. */
  resteMs: number | null;
}

export function avancement(s: EtatSuivi): Avancement {
  const entrees = s.manifeste?.entrees ?? [];
  const attendues = s.manifeste?.bilan.attendues ?? 0;
  const faites = entrees.filter((e) => e.etat === 'rendue' || e.etat === 'exception').length;
  const termine = s.fin !== null;
  const ko =
    entrees.some((e) => classeEntree(e) === 'ko') ||
    s.echecs.length > 0 ||
    (s.manifeste?.echecs?.length ?? 0) > 0 ||
    (termine && s.fin!.code !== 0);
  const durees = entrees.flatMap((e) => (e.dureeMs === null ? [] : [e.dureeMs]));
  const moyenne = durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : 0;
  return {
    faites,
    attendues,
    pct: attendues ? Math.floor((faites / attendues) * 100) : 0,
    termine,
    ko,
    resteMs: !termine && faites > 3 && attendues > faites ? moyenne * (attendues - faites) : null,
  };
}

export function formatDuree(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `testRenduAppFil` → `RenduAppFil` : le préfixe commun n'apprend rien. */
export function nomCourt(id: string): string {
  return id.replace(/^test/, '');
}

const ANSI = /\x1b\[[0-9;]*m/g;

/**
 * Lit la sortie du lanceur ligne à ligne : le titre courant (en gras, voir
 * `titre()` de tests/outils.ts), et chaque « KO » avec ses lignes de détail
 * en retrait. ⚠️ Le récapitulatif final (« Échecs : ») répète les KO : ce qui
 * le suit n'est pas relu.
 */
export class LecteurSortie {
  echecs: EchecSortie[] = [];
  titre = '';
  /** Les dernières lignes, sans couleurs. */
  queue: string[] = [];
  private reste = '';
  private recapitulatif = false;
  private detailOuvert = false;

  lire(morceau: string): void {
    const lignes = (this.reste + morceau).split('\n');
    this.reste = lignes.pop() ?? '';
    for (const brute of lignes) this.ligne(brute);
  }

  private ligne(brute: string): void {
    if (/^\x1b\[1m/.test(brute)) this.titre = brute.replace(ANSI, '').trim();
    const ligne = brute.replace(ANSI, '');
    this.queue.push(ligne);
    if (this.queue.length > 200) this.queue.splice(0, this.queue.length - 200);
    if (ligne.trim() === 'Échecs :') this.recapitulatif = true;
    if (this.recapitulatif) return;
    const ko = /^\s*KO\s+(.*)$/.exec(ligne);
    if (ko) {
      this.echecs.push({ titre: this.titre, texte: ko[1] });
      this.detailOuvert = true;
    } else if (this.detailOuvert && /^\s{6,}\S/.test(ligne)) {
      this.echecs[this.echecs.length - 1].texte += '\n' + ligne.trim();
    } else {
      this.detailOuvert = false;
    }
  }
}

// ---- Le tableau du terminal ----

export interface Couleurs {
  gras: (t: string) => string;
  pale: (t: string) => string;
  accent: (t: string) => string;
  bon: (t: string) => string;
  attention: (t: string) => string;
  mauvais: (t: string) => string;
}

const code = (c: string) => (t: string) => `\x1b[${c}m${t}\x1b[0m`;
export const COULEURS_ANSI: Couleurs = {
  gras: code('1'),
  pale: code('2'),
  // La braise de l'app, en 256 couleurs : lisible sur fond clair comme sombre.
  accent: code('38;5;208'),
  bon: code('32'),
  attention: code('33'),
  mauvais: code('31'),
};
const neutre = (t: string) => t;
export const SANS_COULEURS: Couleurs = {
  gras: neutre, pale: neutre, accent: neutre, bon: neutre, attention: neutre, mauvais: neutre,
};

/** Largeur affichée d'une ligne, couleurs retirées. */
export function largeurVisible(t: string): number {
  return [...t.replace(ANSI, '')].length;
}

/** Coupe une ligne à `largeur` colonnes visibles, couleurs comprises. */
export function couper(t: string, largeur: number): string {
  if (largeurVisible(t) <= largeur) return t;
  let vus = 0;
  let sortie = '';
  for (const morceau of t.split(/(\x1b\[[0-9;]*m)/)) {
    if (/^\x1b\[/.test(morceau)) { sortie += morceau; continue; }
    for (const c of morceau) {
      if (vus >= largeur - 1) return sortie + '…\x1b[0m';
      sortie += c;
      vus++;
    }
  }
  return sortie;
}

const nombre = (n: number) => n.toLocaleString('fr-FR');

/**
 * Le tableau à dessiner, une chaîne par ligne, chacune tenant dans `largeur`.
 * ⚠️ `hauteur` borne le nombre de lignes : un tableau plus haut que le
 * terminal ne pourrait plus se redessiner sur place (le haut serait parti dans
 * l'historique). La mosaïque cède alors sa place la première.
 */
export function tableau(s: EtatSuivi, largeur: number, hauteur: number, c: Couleurs = COULEURS_ANSI): string[] {
  const a = avancement(s);
  const m = s.manifeste;
  const entrees = m?.entrees ?? [];
  const L = Math.max(30, largeur);

  const statut = !m
    ? a.termine ? c.mauvais('interrompue avant de commencer') : c.pale('préparation…')
    : a.termine
      ? a.ko ? c.mauvais(`✖ échec (code ${s.fin!.code ?? s.fin!.signal})`) : c.bon('✔ toutes réussies')
      : c.accent('● en cours');
  const temps = formatDuree((a.termine ? s.fin!.a : s.maintenant) - s.debut);
  const reste = a.resteMs !== null ? c.pale(` · encore ~${formatDuree(a.resteMs)}`) : '';
  const tete = ` ${c.gras('Vérifications')} ${c.pale('·')} ${statut}`;
  const droite = `${temps}${reste} `;
  const espace = Math.max(1, L - largeurVisible(tete) - largeurVisible(droite));
  const lignes: string[] = [tete + ' '.repeat(espace) + droite];

  const pct = a.termine && !a.ko ? 100 : a.pct;
  const texteAvancement = ` ${String(pct).padStart(3)} %  ${nombre(a.faites)}/${nombre(a.attendues)} entrées`;
  const largeurBarre = Math.max(10, L - largeurVisible(texteAvancement) - 2);
  const pleins = Math.round((pct / 100) * largeurBarre);
  const teinte = a.termine ? (a.ko ? c.mauvais : c.bon) : c.accent;
  lignes.push(' ' + teinte('█'.repeat(pleins)) + c.pale('░'.repeat(largeurBarre - pleins)) + texteAvancement);

  const nbEchecs = Math.max(m?.bilan.echecs ?? 0, s.echecs.length);
  lignes.push(
    ` ${c.bon('✔')} ${nombre(m?.bilan.controles ?? 0)} contrôles   ` +
      `${nbEchecs ? c.mauvais(`✖ ${nombre(nbEchecs)} échec${nbEchecs > 1 ? 's' : ''}`) : c.pale('✖ 0 échec')}   ` +
      `${c.attention('◌')} ${nombre(m?.bilan.ignores ?? 0)} ignorés`
  );

  const courante = entrees.find((e) => e.etat === 'invoquée');
  lignes.push(
    courante
      ? ` ${c.accent('▶')} ${nomCourt(courante.id)}${s.titre ? c.pale(` · ${s.titre}`) : ''}`
      : a.termine ? ` ${c.pale('▶ terminé')}` : ` ${c.pale('▶ …')}`
  );

  // La mosaïque : un caractère par entrée, dans l'ordre du registre.
  const marque: Record<ClasseEntree, string> = {
    attendue: c.pale('·'), cours: c.accent('●'), ok: c.bon('■'), ignoree: c.attention('■'), ko: c.mauvais('■'),
  };
  const parLigne = Math.max(10, L - 2);
  const mosaique: string[] = [];
  for (let i = 0; i < entrees.length; i += parLigne) {
    mosaique.push(' ' + entrees.slice(i, i + parLigne).map((e) => marque[classeEntree(e)]).join(''));
  }
  const legende =
    ` ${c.bon('■')} réussie  ${c.attention('■')} ignorée  ${c.mauvais('■')} échec  ${c.accent('●')} en cours  ${c.pale('·')} attendue`;

  // Les derniers échecs, une ligne chacun ; le détail complet vient à la fin.
  const echecs: string[] = s.echecs.slice(-5).map((e) => ` ${c.mauvais('✖')} ${e.titre ? c.pale(`${e.titre} — `) : ''}${e.texte.split('\n')[0]}`);
  for (const e of entrees.filter((x) => x.etat === 'exception')) echecs.push(` ${c.mauvais('✖')} ${nomCourt(e.id)} — exception : ${e.exception ?? ''}`);

  const corps = [...lignes, ''];
  const avecMosaique = mosaique.length ? [...mosaique, legende, ''] : [];
  const fin = echecs.length ? [...echecs] : [];
  const tout = corps.length + avecMosaique.length + fin.length <= hauteur ? [...corps, ...avecMosaique, ...fin] : [...corps, ...fin];
  return tout.slice(0, Math.max(1, hauteur)).map((l) => couper(l, L));
}
