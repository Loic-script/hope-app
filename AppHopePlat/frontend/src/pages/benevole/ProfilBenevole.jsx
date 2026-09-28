import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';

import BoutonMessage from '../../components/messagerie/BoutonMessage.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { nomDuPays } from '../../utils/pays.js';
import { Avatar, IconeEnveloppe } from './Benevoles.jsx';

/**
 * Le profil public d'un benevole, lu par un autre.
 *
 * Ce qui aide a travailler ensemble : metier, competences, langues,
 * disponibilites, projets suivis et taches livrees. Ni courriel, ni
 * telephone : le bouton ouvre une conversation dans la messagerie.
 */
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOMENTS = { matin: 'Matin', 'apres-midi': 'Après-midi', soir: 'Soir', journee: 'Journée' };

export default function ProfilBenevole() {
  const { id } = useParams();
  const { api, racineConversations, cheminMessages } = useOutletContext();
  const { donnees: b, chargement, erreur } = useChargement(() => service.profilBenevole(id), [id]);
  const [refus, setRefus] = useState('');

  const retour = (
    <Link to="/benevole/benevoles" className="profil-public__retour">
      <span aria-hidden="true">←</span> Tous les bénévoles
    </Link>
  );

  if (erreur) {
    return (
      <div className="accueil-benevole">
        {retour}
        <p className="alerte-benevole">{erreur}</p>
      </div>
    );
  }
  if (chargement || !b) {
    return (
      <div className="accueil-benevole">
        {retour}
        <p className="bloc__vide">Chargement du profil…</p>
      </div>
    );
  }

  const jours = JOURS.filter((jour) => (b.disponibilites?.[jour] ?? []).length > 0);
  const facons = [b.accepteTerrain && 'Sur le terrain', b.accepteDistance && 'À distance'].filter(Boolean);

  return (
    <div className="accueil-benevole profil-public">
      {retour}

      <section className="profil-public__entete">
        <span className="profil-public__halo" aria-hidden="true" />
        <Avatar personne={b} taille="grand" />
        <div className="profil-public__identite">
          <p className="profil-public__role">Bénévole HOPE</p>
          <h1 className="profil-public__nom">
            {b.prenom} {b.nom}
          </h1>
          <p className="profil-public__metier">
            {b.profession || 'Bénévole'}
            {b.pays && <> · {nomDuPays(b.pays)}</>}
          </p>
          {b.membreDepuis && (
            <p className="profil-public__depuis">Membre depuis {fmt.date(b.membreDepuis)}</p>
          )}
        </div>
        <div className="profil-public__action">
          {b.moi ? (
            <Link to="/benevole/profil" className="annuaire-carte__ecrire profil-public__ecrire">
              Modifier mon profil
            </Link>
          ) : (
            <BoutonMessage
              api={api}
              racine={racineConversations}
              cheminMessages={cheminMessages}
              cible={{ personne: { type: 'utilisateur', id: b.id } }}
              libelle={`Écrire à ${b.prenom || 'ce bénévole'}`}
              className="annuaire-carte__ecrire profil-public__ecrire"
              onErreur={setRefus}
            >
              <IconeEnveloppe />
            </BoutonMessage>
          )}
        </div>
      </section>

      {refus && (
        <p className="alerte-benevole" role="alert">
          {refus}
        </p>
      )}

      <div className="profil-public__chiffres">
        <div className="profil-public__chiffre" style={{ '--rang': 0 }}>
          <strong>{b.tachesLivrees}</strong>
          <span>tâche{b.tachesLivrees > 1 ? 's' : ''} livrée{b.tachesLivrees > 1 ? 's' : ''}</span>
        </div>
        <div className="profil-public__chiffre" style={{ '--rang': 1 }}>
          <strong>{b.projets}</strong>
          <span>projet{b.projets > 1 ? 's' : ''} suivi{b.projets > 1 ? 's' : ''}</span>
        </div>
        <div className="profil-public__chiffre" style={{ '--rang': 2 }}>
          <strong>{b.badges.length}</strong>
          <span>badge{b.badges.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="profil-public__grille">
        <section className="profil-public__bloc">
          <h2>Compétences</h2>
          {b.competences.length ? (
            <ul className="annuaire-carte__puces">
              {b.competences.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="profil-public__vide">Pas encore renseignées.</p>
          )}
          <h2>Langues</h2>
          {b.langues.length ? (
            <ul className="annuaire-carte__puces annuaire-carte__puces--langues">
              {b.langues.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="profil-public__vide">Pas encore renseignées.</p>
          )}
        </section>

        <section className="profil-public__bloc">
          <h2>Disponibilités</h2>
          {facons.length > 0 && <p className="profil-public__facons">{facons.join(' · ')}</p>}
          {jours.length ? (
            <ul className="profil-public__jours">
              {jours.map((jour) => (
                <li key={jour}>
                  <span className="profil-public__jour">{jour}</span>
                  <span>{b.disponibilites[jour].map((m) => MOMENTS[m] ?? m).join(', ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profil-public__vide">Pas de créneau indiqué.</p>
          )}
        </section>

        <section className="profil-public__bloc">
          <h2>Projets suivis</h2>
          {b.projetsSuivis.length ? (
            <ul className="profil-public__projets">
              {b.projetsSuivis.map((p) => (
                <li key={p.id}>
                  <Link to={`/benevole/projets/${p.id}`}>{p.nom}</Link>
                  <span>
                    {p.tachesLivrees} livrée{p.tachesLivrees > 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profil-public__vide">Aucun projet pour l’instant.</p>
          )}
          {b.badges.length > 0 && (
            <>
              <h2>Badges</h2>
              <ul className="profil-public__badges">
                {b.badges.map((badge) => (
                  <li key={badge.cle}>{badge.libelle}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
