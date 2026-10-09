import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import HopeLogo from '../components/HopeLogo.jsx';

export const VERSION_CONDITIONS = '2026-09-25';
const DATE_VERSION = '25 septembre 2026';

let contactConnu = import.meta.env.VITE_HOPE_CONTACT ?? '';
const abonnes = new Set();
let demande = null;

function chargerContact() {
  demande ??= fetch('/api/public/contact')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d?.email) {
        contactConnu = d.email;
        abonnes.forEach((f) => f(contactConnu));
      }
    })
    .catch(() => {});
}

function useContact() {
  const [contact, setContact] = useState(contactConnu);
  useEffect(() => {
    abonnes.add(setContact);
    chargerContact();
    return () => abonnes.delete(setContact);
  }, []);
  return contact;
}

function Contact() {
  const contact = useContact();
  return contact ? (
    <>
      à l’adresse <a href={`mailto:${contact}`}>{contact}</a>, ou depuis la messagerie de votre espace
    </>
  ) : (
    <>depuis la messagerie de votre espace HOPE, adressée à l’équipe</>
  );
}

const CONFIDENTIALITE = [
  {
    id: 'qui',
    titre: 'Qui est responsable de vos données',
    contenu: (
      <>
        <p>
          HOPE est une association qui finance et suit des projets de développement à Madagascar. Elle est
          responsable des données personnelles traitées sur cette plateforme.
        </p>
        <p>
          Pour toute question sur vos données, écrivez-nous <Contact />.
        </p>
      </>
    ),
  },
  {
    id: 'donnees',
    titre: 'Les données que nous recueillons',
    contenu: (
      <>
        <p>Nous ne demandons que ce qui sert à votre espace :</p>
        <ul>
          <li>
            <strong>Pour tous les comptes</strong> : adresse électronique, type de compte, mot de passe — conservé
            uniquement sous forme chiffrée irréversible, jamais en clair — et la date à laquelle vous avez accepté
            ces textes.
          </li>
          <li>
            <strong>Donateurs</strong> : nom, prénom, téléphone, pays et, si vous la donnez, votre adresse ; vos
            dons (montant, devise, projet soutenu, moyen de paiement, référence de la transaction, numéro payeur
            pour le mobile money).
          </li>
          <li>
            <strong>Bénévoles</strong> : identité, téléphone, photo, compétences, disponibilités, distance de
            déplacement, tâches réalisées et preuves de terrain (photos, vidéos, documents).
          </li>
          <li>
            <strong>Bailleurs</strong> : organisation, personne de contact, financements et documents de
            partenariat.
          </li>
          <li>
            <strong>Messagerie</strong> : les messages et pièces jointes échangés dans les espaces.
          </li>
          <li>
            <strong>Données techniques</strong> : date de dernière connexion, et adresse IP le temps de limiter
            les tentatives de connexion abusives.
          </li>
        </ul>
        <div className="legal__encadre">
          <strong>Carte bancaire.</strong> HOPE ne reçoit ni ne conserve jamais le numéro de votre carte, sa date
          d’expiration ou son cryptogramme : ils sont saisis chez notre prestataire de paiement, Stripe. HOPE ne
          garde que le réseau (Visa, Mastercard…) et les quatre derniers chiffres, pour reconnaître le paiement.
        </div>
      </>
    ),
  },
  {
    id: 'beneficiaires',
    titre: 'Les personnes que nous aidons',
    contenu: (
      <>
        <p>
          Pour suivre les projets, l’équipe HOPE enregistre des informations sur les bénéficiaires : identité, date
          de naissance, situation, photos, notes de suivi. Ces données sont sensibles.
        </p>
        <p>
          Elles restent dans l’espace administrateur, réservé à l’équipe HOPE. Le nom complet, la date de naissance
          et les notes privées d’un bénéficiaire ne sont jamais publiés ni montrés aux donateurs, bénévoles ou
          bailleurs.
        </p>
      </>
    ),
  },
  {
    id: 'finalites',
    titre: 'Pourquoi nous les utilisons',
    contenu: (
      <>
        <ul>
          <li>ouvrir et faire fonctionner votre compte (exécution de nos conditions d’utilisation) ;</li>
          <li>
            recevoir vos dons, vous en confirmer la réception et vous rendre compte de leur usage (exécution du
            don, et obligations comptables de l’association) ;
          </li>
          <li>confier et suivre les tâches des bénévoles ;</li>
          <li>rendre compte aux bailleurs des projets qu’ils financent ;</li>
          <li>
            protéger la plateforme et ses membres contre la fraude et les intrusions (intérêt légitime de HOPE) ;
          </li>
          <li>vous écrire au sujet de votre compte : validation, mot de passe oublié, suivi d’un don.</li>
        </ul>
        <p>
          Pas de publicité, pas de revente, pas de profilage commercial. Vos données ne servent qu’à la mission de
          HOPE.
        </p>
      </>
    ),
  },
  {
    id: 'destinataires',
    titre: 'Qui peut y accéder',
    contenu: (
      <>
        <p>
          Les membres habilités de l’équipe HOPE, chacun pour ce qui relève de son rôle. Et, pour ce qui les
          concerne seulement, nos prestataires techniques :
        </p>
        <ul>
          <li>l’hébergeur de la plateforme et de sa base de données (Railway) ;</li>
          <li>le prestataire de paiement par carte (Stripe) ;</li>
          <li>le service d’envoi des courriels de la plateforme ;</li>
          <li>la banque ou l’opérateur de mobile money par lequel vous choisissez de payer.</li>
        </ul>
        <p>
          Certains de ces prestataires traitent les données hors de Madagascar, notamment dans l’Union européenne
          et aux États-Unis, sous des garanties contractuelles de protection. Nous ne communiquons vos données à une
          autorité que si la loi l’exige.
        </p>
      </>
    ),
  },
  {
    id: 'conservation',
    titre: 'Combien de temps nous les gardons',
    contenu: (
      <ul>
        <li>les données de votre compte : tant qu’il existe, puis elles sont supprimées ou rendues anonymes ;</li>
        <li>
          les données d’un don : pendant la durée légale de conservation des pièces comptables, même après la
          fermeture du compte ;
        </li>
        <li>un lien de réinitialisation du mot de passe : une heure, et il ne sert qu’une fois ;</li>
        <li>les messages : tant que le compte existe.</li>
      </ul>
    ),
  },
  {
    id: 'securite',
    titre: 'Comment nous les protégeons',
    contenu: (
      <p>
        Connexion chiffrée (HTTPS), mots de passe hachés, sessions signées et limitées dans le temps, accès réservé
        selon le rôle de chacun, tentatives de connexion limitées, fichiers renommés et contrôlés à l’envoi.
        Aucune mesure n’est infaillible : si une violation de vos données survenait, nous vous en informerions.
      </p>
    ),
  },
  {
    id: 'droits',
    titre: 'Vos droits',
    contenu: (
      <>
        <p>
          Vous pouvez à tout moment demander à <strong>accéder</strong> à vos données, les{' '}
          <strong>rectifier</strong>, les <strong>effacer</strong>, en <strong>limiter</strong> l’usage, vous{' '}
          <strong>opposer</strong> à un traitement, ou en recevoir une copie dans un format courant. Vous pouvez
          aussi retirer votre consentement ; cela ferme le compte.
        </p>
        <p>
          Adressez votre demande <Contact />. Nous répondons dans un délai d’un mois.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la Commission Malagasy de
          l’Informatique et des Libertés (CMIL), prévue par la loi n° 2014-038 sur la protection des données à
          caractère personnel. Si vous résidez dans l’Union européenne, vous pouvez aussi vous adresser à l’autorité
          de votre pays — la CNIL en France.
        </p>
      </>
    ),
  },
  {
    id: 'traceurs',
    titre: 'Cookies et stockage du navigateur',
    contenu: (
      <p>
        HOPE n’utilise ni cookie publicitaire ni outil de mesure d’audience tiers. Votre navigateur garde seulement
        de quoi vous maintenir connecté (et, si vous le choisissez, vous reconnaître la fois suivante). La page de
        paiement par carte, chez Stripe, dépose ses propres cookies, nécessaires à la sécurité du paiement.
      </p>
    ),
  },
  {
    id: 'modifications',
    titre: 'Évolution de ce texte',
    contenu: (
      <p>
        Si cette politique change, la nouvelle version est publiée ici avec sa date, et vous en êtes informé à
        votre prochaine connexion lorsque le changement est important.
      </p>
    ),
  },
];

const CONDITIONS = [
  {
    id: 'objet',
    titre: 'Objet',
    contenu: (
      <p>
        Ces conditions encadrent l’usage de la plateforme HOPE : les espaces des donateurs, des bénévoles et des
        bailleurs, et les services qui s’y trouvent. Créer un compte vaut acceptation de ces conditions et de la{' '}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>
    ),
  },
  {
    id: 'comptes',
    titre: 'Votre compte',
    contenu: (
      <>
        <ul>
          <li>La plateforme s’adresse aux personnes majeures.</li>
          <li>Les informations données doivent être exactes et tenues à jour.</li>
          <li>
            Votre mot de passe est personnel : gardez-le secret. Toute action faite depuis votre compte est réputée
            faite par vous.
          </li>
          <li>
            Un compte donateur s’ouvre aussitôt. Un compte bénévole ou bailleur attend la validation de l’équipe
            HOPE, qui peut la refuser.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'dons',
    titre: 'Les dons',
    contenu: (
      <>
        <p>
          Vous choisissez un montant, un moyen de paiement et, si vous le souhaitez, un projet. Le don est confirmé
          lorsque HOPE a reçu les fonds ; vous le suivez dans votre espace.
        </p>
        <ul>
          <li>
            Un don affecté à un projet sert ce projet. Si le projet ne peut aboutir ou dépasse son objectif, HOPE
            affecte le don à un projet proche ou aux besoins généraux de l’association, et vous en informe.
          </li>
          <li>
            Les frais éventuellement prélevés par votre banque ou votre opérateur de mobile money ne dépendent pas
            de HOPE.
          </li>
          <li>
            Une erreur — montant, don en double ? Signalez-la sans tarder <Contact /> : chaque demande est
            examinée.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'transparence',
    titre: 'Transparence sur l’usage des fonds',
    contenu: (
      <p>
        HOPE rend compte de l’usage des fonds : avancement des projets, dépenses, preuves de terrain et rapports.
        Ces comptes rendus ne révèlent jamais les informations sensibles des bénéficiaires.
      </p>
    ),
  },
  {
    id: 'benevoles',
    titre: 'Engagements des bénévoles',
    contenu: (
      <ul>
        <li>réaliser les tâches acceptées, ou les rendre à temps pour qu’un autre les reprenne ;</li>
        <li>ne déposer que des preuves de terrain authentiques ;</li>
        <li>
          ne photographier une personne qu’avec son accord — celui d’un parent pour un enfant — et ne diffuser
          aucune photo ni information sur les bénéficiaires en dehors de la plateforme.
        </li>
      </ul>
    ),
  },
  {
    id: 'bailleurs',
    titre: 'Bailleurs',
    contenu: (
      <p>
        Un bailleur accède au suivi des projets qu’il finance. La convention signée avec HOPE prévaut sur ces
        conditions pour tout ce qu’elle règle.
      </p>
    ),
  },
  {
    id: 'conduite',
    titre: 'Règles de conduite',
    contenu: (
      <>
        <p>Sur la plateforme, et notamment dans la messagerie, il est interdit :</p>
        <ul>
          <li>de tenir des propos injurieux, discriminatoires ou menaçants ;</li>
          <li>de publier un contenu illicite, ou dont vous n’avez pas les droits ;</li>
          <li>d’envoyer un fichier malveillant, ou de tenter d’accéder à ce qui ne vous est pas ouvert ;</li>
          <li>d’utiliser la plateforme à des fins commerciales ou de démarchage.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'contenus',
    titre: 'Contenus et propriété',
    contenu: (
      <p>
        Les textes, visuels et logos de HOPE lui appartiennent. Les contenus que vous déposez restent les vôtres ;
        vous autorisez HOPE à les utiliser pour rendre compte de ses projets à ses donateurs et bailleurs, dans le
        respect de la vie privée des bénéficiaires.
      </p>
    ),
  },
  {
    id: 'suspension',
    titre: 'Suspension et fermeture',
    contenu: (
      <p>
        HOPE peut suspendre ou fermer un compte qui ne respecte pas ces conditions, après vous en avoir informé
        sauf urgence. Vous pouvez demander la fermeture de votre compte à tout moment ; les données de vos dons
        sont alors conservées le temps que la loi l’impose.
      </p>
    ),
  },
  {
    id: 'responsabilite',
    titre: 'Disponibilité et responsabilité',
    contenu: (
      <p>
        HOPE fait de son mieux pour que la plateforme reste disponible et sûre, sans pouvoir garantir une absence
        totale d’interruption. HOPE ne répond pas des pannes des services de paiement tiers (banques, opérateurs,
        Stripe), ni d’un usage de votre compte dû à la divulgation de votre mot de passe.
      </p>
    ),
  },
  {
    id: 'evolution',
    titre: 'Évolution des conditions',
    contenu: (
      <p>
        Ces conditions peuvent évoluer. La nouvelle version est publiée ici avec sa date ; un changement important
        vous est signalé à votre prochaine connexion.
      </p>
    ),
  },
  {
    id: 'droit',
    titre: 'Droit applicable',
    contenu: (
      <p>
        Ces conditions sont soumises au droit malgache. En cas de désaccord, nous cherchons d’abord une solution
        amiable ; à défaut, les tribunaux compétents d’Antananarivo peuvent être saisis.
      </p>
    ),
  },
];

const DOCUMENTS = {
  confidentialite: {
    chemin: '/confidentialite',
    court: 'Confidentialité',
    tresCourt: 'Confidentialité',
    titre: 'Politique de confidentialité',
    chapeau: 'Ce que HOPE fait de vos données, pourquoi, et comment garder la main dessus.',
    articles: CONFIDENTIALITE,
  },
  conditions: {
    chemin: '/conditions-utilisation',
    court: 'Conditions d’utilisation',
    tresCourt: 'Conditions',
    titre: 'Conditions générales d’utilisation',
    chapeau: 'Les règles communes aux donateurs, bénévoles et bailleurs de la plateforme HOPE.',
    articles: CONDITIONS,
  },
};

function PageLegale({ cle }) {
  const navigate = useNavigate();
  const document_ = DOCUMENTS[cle];
  const [actif, setActif] = useState(document_.articles[0].id);
  const [sommaireOuvert, setSommaireOuvert] = useState(false);
  const corps = useRef(null);

  useEffect(() => {
    const avant = window.document.title;
    window.document.title = `${document_.titre} — HOPE`;
    window.scrollTo(0, 0);
    return () => {
      window.document.title = avant;
    };
  }, [document_.titre]);

  useEffect(() => {
    const articles = [...(corps.current?.querySelectorAll('.legal__article') ?? [])];
    if (articles.length === 0 || typeof IntersectionObserver === 'undefined') return undefined;
    const visibles = new Set();
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (entree.isIntersecting) visibles.add(entree.target.id);
          else visibles.delete(entree.target.id);
        }
        const premier = articles.find((a) => visibles.has(a.id));
        if (premier) setActif(premier.id);
      },
      { rootMargin: '-96px 0px -55% 0px' }
    );
    articles.forEach((a) => observateur.observe(a));
    return () => observateur.disconnect();
  }, [cle]);

  function allerA(evenement, id) {
    evenement.preventDefault();
    setSommaireOuvert(false);
    const cible = window.document.getElementById(id);
    if (!cible) return;
    const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    cible.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' });
    cible.focus({ preventScroll: true });
    setActif(id);
  }

  const autre = cle === 'confidentialite' ? DOCUMENTS.conditions : DOCUMENTS.confidentialite;

  return (
    <div className="legal">
      <header className="legal__barre">
        <Link to="/authentification" className="legal__logo" aria-label="HOPE — revenir à la connexion">
          <HopeLogo compact />
        </Link>
        <nav className="legal__bascule" aria-label="Textes légaux">
          {Object.entries(DOCUMENTS).map(([k, d]) => (
            <Link
              key={k}
              to={d.chemin}
              className={`legal__onglet${k === cle ? ' legal__onglet--actif' : ''}`}
              aria-current={k === cle ? 'page' : undefined}
            >
              <span className="legal__onglet-long">{d.court}</span>
              <span className="legal__onglet-court">
                {d.tresCourt}
              </span>
            </Link>
          ))}
        </nav>
        <button type="button" className="legal__retour" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/authentification'))}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Retour
        </button>
      </header>

      <section className="legal__tete">
        <p className="legal__surtitre">Informations légales</p>
        <h1 className="legal__titre">{document_.titre}</h1>
        <p className="legal__chapeau">{document_.chapeau}</p>
        <p className="legal__version">
          Version du <time dateTime={VERSION_CONDITIONS}>{DATE_VERSION}</time>
        </p>
      </section>

      <div className="legal__cadre">
        <aside className={`legal__sommaire${sommaireOuvert ? ' legal__sommaire--ouvert' : ''}`}>
          <button
            type="button"
            className="legal__sommaire-bouton"
            aria-expanded={sommaireOuvert}
            aria-controls="legal-sommaire"
            onClick={() => setSommaireOuvert((o) => !o)}
          >
            Sommaire
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <ol id="legal-sommaire" className="legal__liste">
            {document_.articles.map((article, rang) => (
              <li key={article.id}>
                <a
                  href={`#${article.id}`}
                  className={article.id === actif ? 'legal__entree legal__entree--active' : 'legal__entree'}
                  aria-current={article.id === actif ? 'location' : undefined}
                  onClick={(e) => allerA(e, article.id)}
                >
                  <span className="legal__rang">{String(rang + 1).padStart(2, '0')}</span>
                  {article.titre}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <main className="legal__corps" ref={corps}>
          {document_.articles.map((article, rang) => (
            <article
              key={article.id}
              id={article.id}
              className="legal__article"
              tabIndex={-1}
              style={{ '--rang': rang }}
            >
              <h2>
                <span className="legal__rang" aria-hidden="true">
                  {String(rang + 1).padStart(2, '0')}
                </span>
                {article.titre}
              </h2>
              {article.contenu}
            </article>
          ))}

          <Link to={autre.chemin} className="legal__suivant">
            <span>À lire aussi</span>
            <strong>{autre.titre}</strong>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </main>
      </div>
    </div>
  );
}

export function PolitiqueConfidentialite() {
  return <PageLegale cle="confidentialite" />;
}

export function ConditionsUtilisation() {
  return <PageLegale cle="conditions" />;
}
