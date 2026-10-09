import { Fragment } from 'react';

import { decouperLiens, surligner } from './outils.js';

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
