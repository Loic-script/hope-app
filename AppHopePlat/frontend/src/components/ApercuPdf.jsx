import { useEffect, useRef, useState } from 'react';

/**
 * Apercu d'un PDF, dessine dans la page.
 *
 * Pourquoi ne pas simplement poser une <iframe> sur le fichier : le
 * navigateur n'affiche un PDF que s'il embarque un lecteur, et surtout
 * il obeit a ses reglages. Chrome sait etre regle sur << telecharger les
 * PDF au lieu de les ouvrir >> : le cadre reste blanc et un
 * enregistrement demarre, alors qu'on demandait justement a voir avant
 * de decider. Ici, rien n'est navigue : les octets sont lus et les pages
 * peintes sur des canevas.
 *
 * pdf.js ne se charge qu'a l'ouverture de l'apercu, par un import
 * dynamique : le fichier pese plus d'un megaoctet et n'a pas a ralentir
 * l'espace pour ceux qui n'ouvriront aucun rapport.
 */
export default function ApercuPdf({ url, titre, pagesMax = 6 }) {
  const conteneur = useRef(null);
  const [etat, setEtat] = useState('chargement');
  const [pages, setPages] = useState(0);
  // La cause exacte de l'echec, affichee telle quelle : sans elle, un
  // apercu blanc ne se diagnostique pas a distance.
  const [raison, setRaison] = useState('');

  useEffect(() => {
    if (!url) return undefined;

    let annule = false;
    let rendu = null;
    // La tache de chargement, et non le document : c'est elle qui porte
    // destroy(), et elle seule sait couper les requetes en cours.
    let tache = null;
    const zone = conteneur.current;
    if (zone) zone.replaceChildren();
    setEtat('chargement');
    setPages(0);
    setRaison('');

    (async () => {
      try {
        garantirWithResolvers();
        const pdfjs = await import('pdfjs-dist');

        // Le worker vient du meme paquet : aucune ressource distante,
        // l'espace doit fonctionner sur une connexion pauvre. S'il ne
        // se charge pas, on continue quand meme : pdf.js sait dessiner
        // sur le fil principal, plus lentement mais visiblement.
        try {
          const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
          pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        } catch {
          /* rendu sur le fil principal */
        }

        // Les octets sont lus ici, et non confies a pdf.js par une URL :
        // une erreur de reseau devient alors lisible (fichier absent,
        // origine refusee) au lieu d'un cadre vide.
        const reponse = await fetch(url, { credentials: 'omit' });
        if (!reponse.ok) {
          throw new Error(`le fichier n’a pas pu être lu (erreur ${reponse.status})`);
        }
        const octets = new Uint8Array(await reponse.arrayBuffer());
        if (annule) return;

        tache = pdfjs.getDocument({ data: octets });
        const ouvert = await tache.promise;
        if (annule) return;
        setPages(ouvert.numPages);

        const nombre = Math.min(ouvert.numPages, pagesMax);
        for (let numero = 1; numero <= nombre; numero += 1) {
          const page = await ouvert.getPage(numero);
          if (annule) return;

          // La largeur disponible commande l'echelle ; le rapport de
          // pixels garde le texte net sur un ecran dense.
          const largeur = (conteneur.current?.clientWidth ?? 600) - 2;
          const base = page.getViewport({ scale: 1 });
          const echelle = largeur / base.width;
          const vue = page.getViewport({ scale: echelle });
          const densite = Math.min(window.devicePixelRatio || 1, 2);

          const canevas = document.createElement('canvas');
          canevas.className = 'apercu-pdf__page';
          canevas.width = Math.floor(vue.width * densite);
          canevas.height = Math.floor(vue.height * densite);
          canevas.style.width = `${Math.floor(vue.width)}px`;
          canevas.style.height = `${Math.floor(vue.height)}px`;
          conteneur.current?.append(canevas);

          rendu = page.render({
            canvasContext: canevas.getContext('2d'),
            viewport: page.getViewport({ scale: echelle * densite }),
          });
          await rendu.promise;
          rendu = null;
          if (annule) return;
        }
        setEtat('pret');
      } catch (echec) {
        if (annule) return;
        console.error('Apercu du PDF :', echec);
        setRaison(echec?.message ? String(echec.message) : String(echec));
        setEtat('echec');
      }
    })();

    return () => {
      annule = true;
      // Un rendu poursuivi sur un canevas detache ne sert plus a rien,
      // et empeche de rouvrir l'apercu tout de suite.
      rendu?.cancel();
      tache?.destroy();
    };
  }, [url, pagesMax]);

  return (
    <div className="apercu-pdf">
      <div className="apercu-pdf__pages" ref={conteneur} aria-label={`Aperçu — ${titre}`} />

      {etat === 'chargement' && <p className="apercu-pdf__note">Chargement de l’aperçu…</p>}

      {etat === 'echec' && (
        <p className="apercu-pdf__note apercu-pdf__note--echec">
          L’aperçu n’a pas pu s’afficher{raison ? ` : ${raison}` : ''}. Le document reste
          téléchargeable.
        </p>
      )}

      {etat === 'pret' && pages > pagesMax && (
        <p className="apercu-pdf__note">
          {pagesMax} premières pages sur {pages}. Téléchargez le document pour la suite.
        </p>
      )}
    </div>
  );
}

/**
 * pdf.js 6 s'appuie sur Promise.withResolvers, arrive dans les
 * navigateurs fin 2023 (Chrome 119, Firefox 121, Safari 17.4). Sur un
 * poste dont le navigateur n'a pas ete mis a jour, son absence suffit a
 * faire echouer tout l'apercu. Le supplement tient en six lignes.
 */
function garantirWithResolvers() {
  if (typeof Promise.withResolvers === 'function') return;
  Promise.withResolvers = function withResolvers() {
    let resoudre;
    let rejeter;
    const promesse = new Promise((ok, ko) => {
      resoudre = ok;
      rejeter = ko;
    });
    return { promise: promesse, resolve: resoudre, reject: rejeter };
  };
}
