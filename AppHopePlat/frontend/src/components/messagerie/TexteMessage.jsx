import { Fragment } from 'react';

import { decouperLiens, surligner } from './outils.js';

/**
 * Le texte d'un message : des liens cliquables, et rien d'autre.
 *
 * Tout passe par React, qui echappe le texte : un message qui contient du
 * HTML l'affiche tel quel, il ne l'interprete jamais. Les liens sont
 * produits par decouperLiens, qui n'accepte que http, https et mailto.
 *
 * @param {{ texte: string, terme?: string }} props terme : a surligner
 */
export default function TexteMessage({ texte, terme = '' }) {
  return decouperLiens(texte).map((morceau, index) => {
    if (morceau.type === 'lien') {
      return (
        <a
          key={index}
          className="msg-lien"
          href={morceau.href}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
        >
          <Surlignage texte={morceau.libelle} terme={terme} />
        </a>
      );
    }
    return (
      <Fragment key={index}>
        <Surlignage texte={morceau.texte} terme={terme} />
      </Fragment>
    );
  });
}

/** Le terme recherche, marque dans un texte. */
export function Surlignage({ texte, terme }) {
  if (!terme) return texte;
  return surligner(texte, terme).map((morceau, index) =>
    morceau.trouve ? (
      <mark key={index} className="msg-surligne">
        {morceau.texte}
      </mark>
    ) : (
      <Fragment key={index}>{morceau.texte}</Fragment>
    )
  );
}
