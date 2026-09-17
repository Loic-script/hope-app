import { useEffect, useRef, useState } from 'react';

/**
 * Apercu d'un PDF, dessine dans la page.
 *
 * Pourquoi ne pas simplement poser une <iframe> sur le fichier : le
 * navigateur n'affiche un PDF que s'il embarque un lecteur. Les
 * navigateurs de bureau en ont un, la plupart de ceux des telephones
 * non -- ils proposent un telechargement, ou ne montrent rien. Un cadre
 * vide serait exactement le contraire de ce qu'un apercu doit faire.
 *
 * pdf.js dessine donc les pages nous-memes, sur des canevas. Il ne se
 * charge qu'a l'ouverture de l'apercu, par un import dynamique : le
 * fichier pese plus d'un megaoctet, et n'a pas a ralentir le premier
 * affichage de l'espace pour tous ceux qui n'ouvriront aucun rapport.
 */
export default function ApercuPdf({ url, titre, pagesMax = 6 }) {
  const conteneur = useRef(null);
  const [etat, setEtat] = useState('chargement');
  const [pages, setPages] = useState(0);

  useEffect(() => {
    if (!url) return undefined;

    let annule = false;
    const zone = conteneur.current;
    if (zone) zone.replaceChildren();
    setEtat('chargement');
    setPages(0);

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // Le worker vient du meme paquet : aucune ressource distante,
        // l'espace doit fonctionner sur une connexion pauvre.
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        const document_ = await pdfjs.getDocument({ url }).promise;
        if (annule) return;
        setPages(document_.numPages);

        const nombre = Math.min(document_.numPages, pagesMax);
        for (let numero = 1; numero <= nombre; numero += 1) {
          const page = await document_.getPage(numero);
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

          await page.render({
            canvasContext: canevas.getContext('2d'),
            viewport: page.getViewport({ scale: echelle * densite }),
          }).promise;
          if (annule) return;
        }
        setEtat('pret');
      } catch (echec) {
        if (!annule) setEtat('echec');
      }
    })();

    return () => {
      annule = true;
    };
  }, [url, pagesMax]);

  return (
    <div className="apercu-pdf">
      <div className="apercu-pdf__pages" ref={conteneur} aria-label={`Aperçu — ${titre}`} />

      {etat === 'chargement' && <p className="apercu-pdf__note">Chargement de l’aperçu…</p>}

      {etat === 'echec' && (
        <p className="apercu-pdf__note apercu-pdf__note--echec">
          L’aperçu n’a pas pu s’afficher. Le document reste téléchargeable.
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
