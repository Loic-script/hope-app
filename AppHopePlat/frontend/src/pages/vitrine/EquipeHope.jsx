import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import ando from '../../assets/vitrine/equipe/ando.jpg';
import elisee from '../../assets/vitrine/equipe/elisee.jpg';
import herilanja from '../../assets/vitrine/equipe/herilanja.jpg';
import { useApparition } from '../../hooks/useApparition.js';
import { urlMedia } from '../../services/api.js';

/**
 * L'equipe de HOPE, sur la page "Nous decouvrir" : qui elle est, les
 * membres du bureau, les benevoles, et le mot de la presidente.
 *
 * Les portraits du bureau et de la presidente sont ceux fournis par
 * HOPE, decoupes au disque interieur de leur anneau
 * (assets/vitrine/equipe) ; les personnes y figurent avec leur accord.
 * Les benevoles, eux, viennent de la plateforme (GET
 * /api/public/benevoles) : les benevoles actifs, avec leur prenom et leur
 * photo, sauf ceux qui ont demande depuis leur profil a ne pas y paraitre.
 */

/* ----------------------------- Le portrait ----------------------------- */

/**
 * Un portrait en medaillon, releve sur les maquettes, l'anneau exterieur
 * (R = 40) pris pour unite : anneau de 0,077 R, cinq rayons de 1,10 a
 * 1,42 R tous les 30 degres, et une barre de chaque cote de la meme
 * longueur, a la couleur de la section (violet au bureau, bleu chez les
 * benevoles). La photo est rognee au disque interieur de l'anneau.
 *
 * Sans photo (un benevole qui n'en a pas mise), le disque porte son
 * initiale. Decoratif : le nom est ecrit sous le portrait.
 */
function Portrait({ src, initiale = '', barres = 'violet' }) {
  const id = useId();
  return (
    // Le boitier s'arrete juste sous l'anneau (y = 44) : le nom vient tout pres.
    <svg className={`v-portrait v-portrait--${barres}`} viewBox="-60 -60 120 104" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle r="36.9" />
        </clipPath>
      </defs>
      <g className="v-portrait__rayons">
        <g className="v-portrait__rayons-vif">
          <rect x="-2.3" y="-56.8" width="4.6" height="12.8" rx="2.3" />
          <rect x="-2.3" y="-56.8" width="4.6" height="12.8" rx="2.3" transform="rotate(-30)" />
          <rect x="-2.3" y="-56.8" width="4.6" height="12.8" rx="2.3" transform="rotate(30)" />
          <rect x="-2.3" y="-56.8" width="4.6" height="12.8" rx="2.3" transform="rotate(-60)" />
          <rect x="-2.3" y="-56.8" width="4.6" height="12.8" rx="2.3" transform="rotate(60)" />
        </g>
      </g>
      <g className="v-portrait__barres">
        <rect className="v-portrait__barre v-portrait__barre--gauche" x="-56.8" y="-2.8" width="12.8" height="5.6" rx="2.8" />
        <rect className="v-portrait__barre v-portrait__barre--droite" x="44" y="-2.8" width="12.8" height="5.6" rx="2.8" />
      </g>
      {src ? (
        <image
          href={src}
          x="-36.9"
          y="-36.9"
          width="73.8"
          height="73.8"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id})`}
        />
      ) : (
        <>
          <circle className="v-portrait__fond" r="36.9" />
          <text className="v-portrait__initiale" y="1" textAnchor="middle" dominantBaseline="central">
            {initiale}
          </text>
        </>
      )}
      <circle className="v-portrait__anneau" r="38.45" />
    </svg>
  );
}

/**
 * Le portrait de la presidente, en calques empiles (boitier de 140
 * unites, centre au milieu) :
 *   - derriere la carte : un halo jaune, la couronne de douze rayons
 *     (de 53,5 a 68) qui tourne lentement, et une orbite en pointilles
 *     (R = 49,6) avec son satellite, qui tourne a contresens ;
 *   - devant la carte : la photo (R = 40,2) dans son anneau jaune de 5,2
 *     d'epaisseur (R = 42,6), qui se trace a l'apparition.
 * La carte passe entre les deux : les rayons se couchent derriere elle.
 *
 * Les rotations portent sur les calques entiers (transform seul) et ne
 * tournent que lorsque la section est a l'ecran (.v-direction--en-vue).
 */
function MedaillonDirection({ src }) {
  const id = useId();
  return (
    <div className="v-direction__portrait" aria-hidden="true">
      <span className="v-direction__halo" />
      <svg className="v-direction__couronne" viewBox="-70 -70 140 140">
        <g className="v-portrait__rayons">
          <g className="v-portrait__rayons-vif">
            {Array.from({ length: 12 }, (_, i) => i * 30).map((angle) => (
              <rect
                key={angle}
                x="-3"
                y="-68"
                width="6"
                height="14.5"
                rx="3"
                transform={angle === 0 ? undefined : `rotate(${angle})`}
              />
            ))}
          </g>
        </g>
      </svg>
      <svg className="v-direction__orbite" viewBox="-70 -70 140 140">
        <circle className="v-direction__orbite-trait" r="49.6" />
        <circle className="v-direction__satellite" cy="-49.6" r="2.3" />
      </svg>
      <svg className="v-direction__medaillon" viewBox="-70 -70 140 140">
        <defs>
          <clipPath id={id}>
            <circle r="40.2" />
          </clipPath>
        </defs>
        {/* Le rognage reste fixe ; la photo, elle, se pose en reculant. */}
        <g clipPath={`url(#${id})`}>
          <image
            className="v-direction__photo"
            href={src}
            x="-40.2"
            y="-40.2"
            width="80.4"
            height="80.4"
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
        {/* Tourne d'un quart : le trace de l'anneau part du sommet. */}
        <circle className="v-portrait__anneau v-direction__anneau" r="42.6" pathLength="100" transform="rotate(-90)" />
      </svg>
    </div>
  );
}

/* ------------------------------ Notre equipe ------------------------------ */

function NotreEquipe() {
  const [ref, vu] = useApparition({ seuil: 0.3 });
  return (
    <section ref={ref} className={`v-equipe${vu ? ' v-apparu' : ''}`} aria-labelledby="v-equipe-titre">
      <div className="v-conteneur v-equipe__contenu">
        <h2 className="accueil-section__titre v-entree" id="v-equipe-titre" style={{ '--rang': 0 }}>
          Notre Équipe
        </h2>
        <p className="v-equipe__accroche v-entree" style={{ '--rang': 1 }}>
          Des personnes de cœur, engagées sur le terrain.
        </p>
        <p className="v-equipe__texte v-entree" style={{ '--rang': 2 }}>
          Derrière <strong>Hope for a Better Life</strong>, il y a une équipe passionnée et profondément humaine qui
          met son énergie, ses compétences et son amour au service des enfants et des mères célibataires à
          Madagascar.
        </p>
        <p className="v-equipe__texte v-entree" style={{ '--rang': 3 }}>
          Nous croyons fermement qu’il faut être proches de ceux que nous accompagnons pour comprendre leurs
          besoins et leur offrir les meilleures opportunités.
        </p>
      </div>
    </section>
  );
}

/* --------------------------- Les membres du bureau --------------------------- */

const BUREAU = [
  { cle: 'ando', nom: 'Ando Lalaina Ratovomanana', role: 'Présidente et fondatrice', photo: ando },
  { cle: 'elisee', nom: 'Ratsimbazafy Elisée', role: 'Trésorerie', photo: elisee },
  { cle: 'herilanja', nom: 'Herilanja Niriana Rasoariso', role: 'Secrétaire', photo: herilanja },
];

function MembresDuBureau() {
  const [ref, vu] = useApparition({ seuil: 0.2 });
  return (
    <section ref={ref} className={`v-bureau${vu ? ' v-apparu' : ''}`} aria-labelledby="v-bureau-titre">
      <div className="v-conteneur">
        <h2 className="accueil-section__titre" id="v-bureau-titre">
          Les Membres du bureau
        </h2>
        <ul className="v-bureau__liste">
          {BUREAU.map((membre, rang) => (
            <li key={membre.cle} className="v-membre" style={{ '--rang': rang }}>
              <Portrait src={membre.photo} barres="violet" />
              <h3 className="v-membre__nom">{membre.nom}</h3>
              <p className="v-membre__role">{membre.role}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------ Les benevoles ------------------------------ */

/** Devenir benevole : l'inscription a l'espace benevole. */
const LIEN_BENEVOLE = '/authentification?type=benevole';

function IconeChevron({ sens }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={sens === 'gauche' ? 'M14.5 6 8.5 12l6 6' : 'M9.5 6l6 6-6 6'} />
    </svg>
  );
}

/**
 * Le carrousel des benevoles de la plateforme : trois portraits a
 * l'ecran, un sur telephone ; les fleches font glisser d'un portrait,
 * les points disent ou l'on est et y menent. Sans benevole a montrer, la
 * rubrique invite a rejoindre l'equipe.
 */
function LesBenevoles() {
  const [ref, vu] = useApparition({ seuil: 0.2 });
  const piste = useRef(null);
  const [benevoles, setBenevoles] = useState(null);
  const [courant, setCourant] = useState(0);
  const [bords, setBords] = useState({ debut: true, fin: true });

  useEffect(() => {
    let actif = true;
    fetch('/api/public/benevoles')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => actif && setBenevoles(d.items ?? []))
      .catch(() => actif && setBenevoles([]));
    return () => {
      actif = false;
    };
  }, []);

  const largeurItem = () => piste.current?.querySelector('.v-benevole')?.getBoundingClientRect().width ?? 0;

  const mesurer = useCallback(() => {
    const el = piste.current;
    if (!el) return;
    const l = largeurItem();
    setCourant(l ? Math.round(el.scrollLeft / l) : 0);
    setBords({ debut: el.scrollLeft <= 4, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [mesurer, benevoles]);

  function aller(indice) {
    piste.current?.scrollTo({ left: indice * largeurItem(), behavior: 'smooth' });
  }

  return (
    <section ref={ref} className={`v-benevoles${vu ? ' v-apparu' : ''}`} aria-labelledby="v-benevoles-titre">
      <div className="v-conteneur">
        <h2 className="accueil-section__titre" id="v-benevoles-titre">
          Les Bénévoles
        </h2>
        {benevoles === null ? (
          <p className="v-benevoles__message">Chargement des bénévoles…</p>
        ) : benevoles.length === 0 ? (
          <div className="v-benevoles__message">
            <p>Nos bénévoles se présenteront ici bientôt. Et pourquoi pas vous ?</p>
            <Link to={LIEN_BENEVOLE} className="v-bouton-contour">
              Devenir bénévole
            </Link>
          </div>
        ) : (
          <>
            <div className="v-benevoles__carrousel">
              <button
                type="button"
                className="v-benevoles__fleche v-benevoles__fleche--gauche"
                onClick={() => aller(courant - 1)}
                disabled={bords.debut}
                aria-label="Bénévoles précédents"
              >
                <IconeChevron sens="gauche" />
              </button>
              {/* La piste defile : on la rend atteignable au clavier (fleches du clavier). */}
              <ul
                className="v-benevoles__piste"
                ref={piste}
                onScroll={mesurer}
                tabIndex={0}
                aria-label="Portraits des bénévoles"
              >
                {benevoles.map((benevole, rang) => (
                  <li key={benevole.id} className="v-benevole" style={{ '--rang': Math.min(rang, 5) }}>
                    <Portrait
                      src={urlMedia(benevole.photoUrl)}
                      initiale={benevole.prenom.trim().charAt(0).toUpperCase()}
                      barres="bleu"
                    />
                    <h3 className="v-benevole__nom">{benevole.prenom}</h3>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="v-benevoles__fleche v-benevoles__fleche--droite"
                onClick={() => aller(courant + 1)}
                disabled={bords.fin}
                aria-label="Bénévoles suivants"
              >
                <IconeChevron sens="droite" />
              </button>
            </div>
            <div className="v-benevoles__points" role="tablist" aria-label="Position dans la liste des bénévoles">
              {benevoles.map((benevole, rang) => (
                <button
                  key={benevole.id}
                  type="button"
                  role="tab"
                  className={`v-benevoles__point${rang === courant ? ' v-benevoles__point--actif' : ''}`}
                  aria-selected={rang === courant}
                  aria-label={`Aller à ${benevole.prenom}`}
                  onClick={() => aller(rang)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* --------------------------- Le mot de la direction --------------------------- */

function MotDeLaDirection() {
  const [ref, vu] = useApparition({ seuil: 0.25 });
  // Le soleil ne tourne que lorsque la section est a l'ecran.
  const [enVue, setEnVue] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const section = ref.current;
    if (!section || typeof IntersectionObserver === 'undefined') return undefined;
    const observateur = new IntersectionObserver((entrees) => setEnVue(entrees.some((e) => e.isIntersecting)));
    observateur.observe(section);
    return () => observateur.disconnect();
  }, [ref]);

  return (
    <section
      ref={ref}
      className={`v-direction${vu ? ' v-apparu' : ''}${enVue ? ' v-direction--en-vue' : ''}`}
      aria-labelledby="v-direction-titre"
    >
      <div className="v-conteneur">
        <h2 className="accueil-section__titre" id="v-direction-titre">
          Le mot de la direction
        </h2>
        <div className="v-direction__ensemble">
          <MedaillonDirection src={ando} />
          <blockquote className="v-direction__carte">
            <p>
              « Chaque enfant et chaque mère que nous croisons possède une force extraordinaire. Notre rôle n’est pas
              seulement de leur venir en aide, mais de leur rappeler leur valeur et de leur donner les moyens de bâtir
              leur propre liberté. C’est en unissant nos forces et nos cœurs que nous ferons grandir l’espoir. »
            </p>
            <footer className="v-direction__signature">— La Présidente</footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

export default function EquipeHope() {
  return (
    <>
      <NotreEquipe />
      <MembresDuBureau />
      <LesBenevoles />
      <MotDeLaDirection />
    </>
  );
}
