import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import couverture from '../../assets/vitrine/akany-soavina.jpg';
import { IconeEnveloppe, IconeFleche, IconeRepere, IconeTelephone, IconeUtilisateur } from '../../components/HopeIcons.jsx';
import { Champ } from '../../components/parcours/champs.jsx';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { useApparition } from '../../hooks/useApparition.js';

/**
 * "Contact" : ecrire a HOPE sans compte.
 *
 * Le bandeau sur la photo, puis deux colonnes : a gauche, comment nous
 * joindre et pourquoi nous ecrire ; a droite, le formulaire -- nom,
 * courriel, telephone s'il veut, le sujet en pastilles de texte, le message --
 * dans l'habit des champs du parcours (components/parcours/champs.jsx).
 * Envoye, la carte laisse place au merci, avec la coche qui se trace.
 *
 * Le serveur (POST /api/public/contact) garde le message, previent
 * l'equipe et accuse reception au visiteur. Un champ piege, invisible,
 * arrete les robots.
 */

/** Les sujets, tels que le serveur les connait ; en attendant sa reponse. */
const SUJETS_PAR_DEFAUT = [
  { cle: 'don', libelle: 'Faire un don' },
  { cle: 'benevolat', libelle: 'Devenir bénévole' },
  { cle: 'partenariat', libelle: 'Partenariat' },
  { cle: 'presse', libelle: 'Presse et médias' },
  { cle: 'autre', libelle: 'Autre demande' },
];

const MESSAGE_MAX = 2000;
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEPHONE = /^\+?[\d\s.()-]{6,20}$/;

const VIDE = { nom: '', courriel: '', telephone: '', sujet: '', message: '', siteWeb: '' };

/** Ordre des champs : c'est aussi l'ordre du focus en erreur. */
const ORDRE = ['nom', 'courriel', 'telephone', 'sujet', 'message'];

/** Les erreurs du formulaire, champ par champ. */
function verifier(champs) {
  const erreurs = {};
  if (champs.nom.trim().length < 2) erreurs.nom = 'Indiquez votre nom.';
  if (champs.courriel.trim() === '') erreurs.courriel = 'Indiquez votre adresse de courriel.';
  else if (!COURRIEL.test(champs.courriel.trim())) erreurs.courriel = 'Cette adresse de courriel n’est pas valide.';
  if (champs.telephone.trim() !== '' && !TELEPHONE.test(champs.telephone.trim())) {
    erreurs.telephone = 'Ce numéro n’est pas valide.';
  }
  if (!champs.sujet) erreurs.sujet = 'Choisissez le sujet de votre message.';
  if (champs.message.trim().length < 10) erreurs.message = 'Écrivez-nous quelques mots, dix caractères au moins.';
  else if (champs.message.length > MESSAGE_MAX) erreurs.message = `Au plus ${MESSAGE_MAX} caractères.`;
  return erreurs;
}

/* ------------------------------- Le bandeau ------------------------------- */

function Couverture() {
  return (
    <section className="contact-hero" aria-labelledby="contact-hero-titre">
      <img className="contact-hero__photo" src={couverture} alt="" fetchPriority="high" />
      <div className="contact-hero__voile" aria-hidden="true" />
      <div className="v-conteneur contact-hero__contenu">
        <p className="contact-hero__sur-titre">Contact</p>
        <h1 className="contact-hero__titre" id="contact-hero-titre">
          <span className="contact-hero__ligne">Parlons</span>
          <span className="contact-hero__ligne">de ce qui compte.</span>
        </h1>
        <div className="contact-hero__trait" aria-hidden="true" />
        <p className="contact-hero__texte">
          Une question, une envie d’aider, un projet à nous proposer ? Écrivez-nous : une personne de l’équipe vous
          répond.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------- Le merci ------------------------------- */

function Merci({ prenom, courriel, onRecommencer }) {
  return (
    <div className="contact-merci" role="status" aria-live="polite">
      <svg className="contact-merci__coche" viewBox="0 0 64 64" aria-hidden="true">
        <circle className="contact-merci__cercle" cx="32" cy="32" r="28" pathLength="100" />
        <path className="contact-merci__trait" d="M20 33.5 28.5 42 45 24" pathLength="100" />
      </svg>
      <h2 className="contact-merci__titre">Merci{prenom ? ` ${prenom}` : ''}, c’est envoyé.</h2>
      <p className="contact-merci__texte">
        Votre message est bien arrivé. L’équipe HOPE vous répond à <strong>{courriel}</strong> sous 48 h ouvrées.
      </p>
      <div className="contact-merci__actions">
        <button type="button" className="v-bouton-contour" onClick={onRecommencer}>
          Envoyer un autre message
        </button>
        <Link to="/" className="accueil-bouton accueil-bouton--orange">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------ Le formulaire ------------------------------ */

function Formulaire({ sujets }) {
  const [champs, setChamps] = useState(VIDE);
  const [touches, setTouches] = useState({});
  const [erreursServeur, setErreursServeur] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [envoye, setEnvoye] = useState(null);
  const formulaire = useRef(null);

  const erreursLocales = verifier(champs);
  const erreurDe = (champ) => erreursServeur[champ] ?? ((touches[champ] || soumis) ? erreursLocales[champ] : undefined);

  function modifier(champ) {
    return (evenement) => {
      const valeur = evenement.target.value;
      setChamps((precedents) => ({ ...precedents, [champ]: valeur }));
      setErreursServeur((precedentes) => ({ ...precedentes, [champ]: undefined }));
    };
  }

  const quitter = (champ) => () => setTouches((precedents) => ({ ...precedents, [champ]: true }));

  function focaliserPremiereErreur(erreurs) {
    const premier = ORDRE.find((champ) => erreurs[champ]);
    if (!premier) return;
    const cible =
      premier === 'sujet'
        ? formulaire.current?.querySelector('input[name="sujet"]')
        : formulaire.current?.querySelector(`#contact-${premier}`);
    cible?.focus();
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');
    const erreurs = verifier(champs);
    if (Object.keys(erreurs).length > 0) {
      focaliserPremiereErreur(erreurs);
      return;
    }
    setEnvoi(true);
    try {
      const reponse = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: champs.nom.trim(),
          courriel: champs.courriel.trim(),
          telephone: champs.telephone.trim(),
          sujet: champs.sujet,
          message: champs.message.trim(),
          siteWeb: champs.siteWeb,
        }),
      });
      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        setErreursServeur(corps.details ?? {});
        focaliserPremiereErreur(corps.details ?? {});
        setRefus(corps.message ?? 'Votre message n’a pas pu partir. Réessayez dans un instant.');
        return;
      }
      setEnvoye({ prenom: champs.nom.trim().split(/\s+/)[0], courriel: champs.courriel.trim() });
    } catch {
      setRefus('Votre message n’a pas pu partir. Vérifiez votre connexion, puis réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  function recommencer() {
    setEnvoye(null);
    setChamps(VIDE);
    setTouches({});
    setSoumis(false);
    setErreursServeur({});
  }

  if (envoye) return <Merci prenom={envoye.prenom} courriel={envoye.courriel} onRecommencer={recommencer} />;

  const nbErreurs = soumis ? ORDRE.filter((champ) => erreurDe(champ)).length : 0;
  const restant = MESSAGE_MAX - champs.message.length;

  return (
    <form ref={formulaire} className="contact-formulaire" onSubmit={soumettre} noValidate aria-labelledby="contact-formulaire-titre">
      <h2 className="contact-formulaire__titre" id="contact-formulaire-titre">
        Écrivez-nous
      </h2>
      <p className="contact-formulaire__accroche">Quelques lignes suffisent, nous faisons le reste.</p>

      <div className="parcours__paire">
        <Champ id="nom" prefixeId="contact" libelle="Nom" erreur={erreurDe('nom')} Icone={IconeUtilisateur}>
          <input
            type="text"
            value={champs.nom}
            onChange={modifier('nom')}
            onBlur={quitter('nom')}
            placeholder="Votre nom"
            autoComplete="name"
            maxLength={120}
            disabled={envoi}
          />
        </Champ>
        <Champ id="courriel" prefixeId="contact" libelle="Courriel" erreur={erreurDe('courriel')} Icone={IconeEnveloppe}>
          <input
            type="email"
            inputMode="email"
            value={champs.courriel}
            onChange={modifier('courriel')}
            onBlur={quitter('courriel')}
            placeholder="vous@exemple.mg"
            autoComplete="email"
            maxLength={255}
            disabled={envoi}
          />
        </Champ>
      </div>

      <Champ
        id="telephone"
        prefixeId="contact"
        libelle="Téléphone"
        facultatif
        erreur={erreurDe('telephone')}
        Icone={IconeTelephone}
        aide="Si vous préférez qu’on vous rappelle."
      >
        <input
          type="tel"
          inputMode="tel"
          value={champs.telephone}
          onChange={modifier('telephone')}
          onBlur={quitter('telephone')}
          placeholder="+261 34 12 345 67"
          autoComplete="tel"
          maxLength={24}
          disabled={envoi}
        />
      </Champ>

      {/* Le sujet : des pastilles, un vrai groupe de boutons radio. */}
      <fieldset className={`contact-sujets${erreurDe('sujet') ? ' contact-sujets--erreur' : ''}`}>
        <legend className="parcours__libelle">Sujet</legend>
        <div className="contact-sujets__liste" role="radiogroup" aria-label="Sujet du message">
          {sujets.map((sujet, rang) => {
            const actif = champs.sujet === sujet.cle;
            return (
              <label
                key={sujet.cle}
                className={`contact-sujet${actif ? ' contact-sujet--actif' : ''}`}
                style={{ '--rang': rang }}
              >
                <input
                  type="radio"
                  name="sujet"
                  value={sujet.cle}
                  checked={actif}
                  onChange={modifier('sujet')}
                  disabled={envoi}
                  className="contact-sujet__radio"
                />
                {sujet.libelle}
              </label>
            );
          })}
        </div>
        {erreurDe('sujet') && <p className="parcours__erreur">{erreurDe('sujet')}</p>}
      </fieldset>

      <div className="contact-formulaire__message">
        <Champ
          id="message"
          prefixeId="contact"
          libelle="Message"
          erreur={erreurDe('message')}
          Icone={IconeEnveloppe}
          aide={restant < 200 ? `${restant} caractère${restant > 1 ? 's' : ''} restant${restant > 1 ? 's' : ''}` : undefined}
        >
          <textarea
            value={champs.message}
            onChange={modifier('message')}
            onBlur={quitter('message')}
            placeholder="Dites-nous ce qui vous amène…"
            rows={6}
            maxLength={MESSAGE_MAX}
            disabled={envoi}
          />
        </Champ>
      </div>

      {/* Le piege a robots : hors de l'ecran, hors du clavier, hors des lecteurs d'ecran. */}
      <div className="contact-formulaire__piege" aria-hidden="true">
        <label htmlFor="contact-site-web">Site web</label>
        <input
          id="contact-site-web"
          type="text"
          name="siteWeb"
          tabIndex={-1}
          autoComplete="off"
          value={champs.siteWeb}
          onChange={modifier('siteWeb')}
        />
      </div>

      <button type="submit" className="parcours__continuer contact-formulaire__envoyer" disabled={envoi} aria-busy={envoi}>
        {envoi ? (
          <>
            <span className="parcours__rotation" aria-hidden="true" />
            Envoi…
          </>
        ) : (
          <>
            Envoyer mon message
            <IconeFleche className="parcours__fleche" />
          </>
        )}
      </button>

      <p className="parcours__recap" role="alert">
        {refus ||
          (nbErreurs > 0 ? `${nbErreurs} champ${nbErreurs > 1 ? 's demandent' : ' demande'} votre attention.` : '')}
      </p>

      <p className="contact-formulaire__note">
        Vos coordonnées ne servent qu’à vous répondre. <Link to="/confidentialite">Politique de confidentialité</Link>
      </p>
    </form>
  );
}

/* --------------------------------- La page --------------------------------- */

export default function Contact() {
  const [ref, vu] = useApparition({ seuil: 0.05 });
  const [courrielEquipe, setCourrielEquipe] = useState(null);
  const [sujets, setSujets] = useState(SUJETS_PAR_DEFAUT);

  // L'adresse de l'equipe, et les sujets tels que le serveur les connait.
  useEffect(() => {
    const controle = new AbortController();
    fetch('/api/public/contact', { signal: controle.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setCourrielEquipe(d.email ?? null))
      .catch(() => {});
    fetch('/api/public/contact/sujets', { signal: controle.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        if (Array.isArray(d.sujets) && d.sujets.length) setSujets(d.sujets);
      })
      .catch(() => {});
    return () => controle.abort();
  }, []);

  return (
    <>
      <Couverture />
      <section ref={ref} className={`contact${vu ? ' v-apparu' : ''}`} aria-label="Nous écrire">
        <div className="v-conteneur contact__grille">
          <aside className="contact__cote">
            <div className="contact-carte v-entree" style={{ '--rang': 0 }}>
              <span className="contact-carte__icone">
                <IconeEnveloppe />
              </span>
              <h2 className="contact-carte__titre">Par courriel</h2>
              {courrielEquipe ? (
                <a className="contact-carte__lien" href={`mailto:${courrielEquipe}`}>
                  {courrielEquipe}
                </a>
              ) : (
                <p className="contact-carte__texte">Le formulaire ci-contre nous parvient directement.</p>
              )}
              <p className="contact-carte__texte">Réponse sous 48 h ouvrées.</p>
            </div>

            <div className="contact-carte v-entree" style={{ '--rang': 1 }}>
              <span className="contact-carte__icone contact-carte__icone--terrain">
                <IconeRepere />
              </span>
              <h2 className="contact-carte__titre">Sur le terrain</h2>
              <p className="contact-carte__texte">
                HOPE agit à Madagascar, auprès des enfants orphelins et des mères célibataires.
              </p>
            </div>

            <div className="contact-carte contact-carte--agir v-entree" style={{ '--rang': 2 }}>
              <h2 className="contact-carte__titre">Vous préférez agir tout de suite ?</h2>
              <div className="contact-carte__actions">
                <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--orange">
                  Faire un don
                </Link>
                <Link to="/s-engager" className="v-bouton-contour">
                  S’engager
                </Link>
              </div>
            </div>
          </aside>

          <div className="contact__carte v-entree" style={{ '--rang': 1 }}>
            <Formulaire sujets={sujets} />
          </div>
        </div>
      </section>
    </>
  );
}
