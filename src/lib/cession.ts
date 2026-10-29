// Rendre la main à la boucle d'événements d'un Worker (ou de la page) entre
// deux tranches de calcul. Neutre : ni `self`, ni `worker_threads`.
//
// `MessageChannel` plutôt que `setTimeout(0)` : des rappels `setTimeout`
// enchaînés sont ramenés à 4 ms minimum au-delà de cinq imbrications
// (spécification HTML ; Chromium, Worker compris) : mesuré dans Chromium, ~3,6 %
// du temps d'un Worker d'appariement qui cède toutes les 100 ms ; un message de canal n'est pas bridé, et
// laisse passer un message déjà arrivé (l'arrêt manuel). Repli `setTimeout`
// quand `MessageChannel` manque, ou quand sa création lève (un environnement
// qui l'expose sans le permettre) : la cession ne doit jamais faire échouer
// la recherche. Les deux ports se ferment à la réception, celui qui reçoit
// puis celui qui a envoyé : un port ouvert tiendrait la boucle d'événements
// de Node en vie, et aucun ne sert plus une fois le message reçu.

type FabriqueCanal = new () => MessageChannel;

export function cederLaMain(
  fabrique: FabriqueCanal | null = typeof MessageChannel === 'function' ? MessageChannel : null
): Promise<void> {
  return new Promise<void>((resolve) => {
    let canal: MessageChannel | null = null;
    if (fabrique) {
      try {
        canal = new fabrique();
      } catch {
        canal = null;
      }
    }
    if (!canal) {
      setTimeout(resolve, 0);
      return;
    }
    canal.port1.onmessage = () => {
      canal.port1.close();
      canal.port2.close();
      resolve();
    };
    canal.port2.postMessage(null);
  });
}

/**
 * Relance d'une tâche découpée en tranches : une seule relance en attente à
 * la fois, cédée par `cederLaMain`. La cession prend son tour derrière les
 * messages déjà reçus (annulation, crédit, réponse) : une tranche qui se
 * reprogramme sans fin ne les affame jamais. `annuler` rend sans effet la
 * relance en attente ; un `programmer` suivant en ouvre une nouvelle. La
 * tranche attrape ses propres erreurs : levée ici, elle deviendrait un rejet
 * de promesse que personne n'écoute.
 */
export class Relance {
  private jeton = 0;
  private attente = false;
  constructor(
    private readonly tranche: () => void,
    private readonly ceder: () => Promise<void> = () => cederLaMain()
  ) {}
  get enAttente(): boolean { return this.attente; }
  programmer(): void {
    if (this.attente) return;
    this.attente = true;
    const jeton = this.jeton;
    void this.ceder().then(() => {
      if (jeton !== this.jeton) return;
      this.attente = false;
      this.tranche();
    });
  }
  annuler(): void { this.jeton++; this.attente = false; }
}
