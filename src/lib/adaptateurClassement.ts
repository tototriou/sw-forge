import { candidatAvecSaPaire, type ResultatArtefacts } from './artifactQueue';
import type { BuildCandidate } from './runeBuildOptim';
import type { PublicationClassement, PublicationTransport } from './classementCompact';

/** Projection de compatibilité seulement ; elle est jetée si le propriétaire est perdu. */
export class AdaptateurClassement {
  private recherche = 0;
  private generationCache = 0;
  private candidats: BuildCandidate[] = [];
  private cache = new Map<string, ResultatArtefacts>();
  appliquer(p: PublicationTransport): PublicationClassement {
    if (p.versions.idRecherche !== this.recherche) { this.recherche = p.versions.idRecherche; this.candidats = []; }
    if (p.generationCache !== this.generationCache) { this.generationCache = p.generationCache; this.cache.clear(); }
    if (p.candidats) this.candidats = p.candidats;
    for (const [cle, r] of p.changements) this.cache.set(cle, r);
    const lire = (i: number) => {
      if (!Number.isSafeInteger(i) || i < 0 || i >= this.candidats.length) throw new Error('Ordinal publié absent de la génération');
      return this.candidats[i];
    };
    if (p.ordreBase.length !== this.candidats.length) throw new Error('Publication de candidats incomplète');
    return { versions: p.versions, vue: p.vue, candidats: this.candidats,
      base: Array.from(p.ordreBase, lire), affichees: Array.from(p.ordreAffiche, (i) => candidatAvecSaPaire(lire(i), this.cache)),
      parBuild: new Map(this.cache), enAttente: p.enAttente, bilan: p.bilan };
  }
  detruire(): void { this.recherche = 0; this.generationCache = 0; this.candidats = []; this.cache.clear(); }
}
