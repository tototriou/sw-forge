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
