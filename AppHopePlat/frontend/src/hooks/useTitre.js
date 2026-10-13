import { useEffect } from 'react';

export function useTitre(titre, page) {
  useEffect(() => {
    if (titre) document.title = titre;
  }, [titre, page]);
}
