import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import HopeLogo from '../../components/HopeLogo.jsx';
import { messageErreur } from '../../services/api.js';
import { apiBenevole } from '../../services/apiBenevole.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOMENTS = [
  { cle: 'matin', label: 'Matin' },
  { cle: 'apres-midi', label: 'Après-midi' },
  { cle: 'soir', label: 'Soir' },
  { cle: 'journee', label: 'Journée' },
];

/**
 * Completion du profil, a la premiere connexion d'un benevole.
 *
 * L'inscription commune aux trois types ne recueille que l'etat civil.
 * Ce qui sert a proposer les bonnes missions -- ce qu'on sait faire,
 * quand on est libre, jusqu'ou on se deplace -- est demande ici, une
 * fois, et modifiable ensuite depuis "Mon profil".
 */
export default function CompleterProfil() {
  // La garde nous a laisses passer : c'est elle qui nous renverra vers
  // l'espace des qu'elle aura relu le profil.
  const { rafraichir } = useOutletContext();

  const [champs, setChamps] = useState({
    profession: '',
    competences: '',
    langues: '',
    disponibilites: {},
    rayonKm: '',
    adresse: '',
    dateDeNaissance: '',
    accepteTerrain: true,
    accepteDistance: true,
    contactUrgenceNom: '',
    contactUrgenceTel: '',
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  function modifier(nom, valeur) {
    setChamps((precedents) => ({ ...precedents, [nom]: valeur }));
  }

  /** Coche ou decoche un moment pour un jour donne. */
  function basculerDisponibilite(jour, moment) {
    setChamps((precedents) => {
      const actuels = precedents.disponibilites[jour] ?? [];
      const suivants = actuels.includes(moment)
        ? actuels.filter((m) => m !== moment)
        : [...actuels, moment];

      const disponibilites = { ...precedents.disponibilites };
      if (suivants.length === 0) delete disponibilites[jour];
      else disponibilites[jour] = suivants;

      return { ...precedents, disponibilites };
    });
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    setErreur('');
    try {
      await apiBenevole.post('/benevole/profil/completer', {
        ...champs,
        rayonKm: champs.rayonKm === '' ? null : champs.rayonKm,
        dateDeNaissance: champs.dateDeNaissance || null,
      });
      // La garde relit le profil et route d'elle-meme vers l'espace :
      // naviguer ici la trouverait encore avec l'ancien etat.
      await rafraichir();
    } catch (echec) {
      setErreur(messageErreur(echec, 'Le profil n’a pas pu être enregistré.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="completion">
      <div className="completion__carte">
        <header className="completion__entete">
          <HopeLogo />
          <h1 className="completion__titre">Complétez votre profil</h1>
          <p className="completion__accroche">
            Ces informations aident l’équipe à vous proposer les missions qui vous
            correspondent. Vous pourrez les modifier à tout moment.
          </p>
        </header>

        <form className="completion__formulaire" onSubmit={soumettre}>
          <fieldset className="completion__groupe">
            <legend>Vous</legend>

            <div className="completion__paire">
              <Champ
                id="dateDeNaissance"
                libelle="Date de naissance"
                type="date"
                valeur={champs.dateDeNaissance}
                onChange={(v) => modifier('dateDeNaissance', v)}
                disabled={envoi}
              />
              <Champ
                id="profession"
                libelle="Profession"
                valeur={champs.profession}
                onChange={(v) => modifier('profession', v)}
                disabled={envoi}
                placeholder="Enseignante, développeur…"
              />
            </div>

            <Champ
              id="adresse"
              libelle="Adresse"
              valeur={champs.adresse}
              onChange={(v) => modifier('adresse', v)}
              disabled={envoi}
              placeholder="Quartier, ville"
            />
          </fieldset>

          <fieldset className="completion__groupe">
            <legend>Ce que vous savez faire</legend>

            <Champ
              id="competences"
              libelle="Compétences"
              valeur={champs.competences}
              onChange={(v) => modifier('competences', v)}
              disabled={envoi}
              placeholder="traduction, informatique, cuisine"
              aide="Séparez par des virgules."
            />
            <Champ
              id="langues"
              libelle="Langues"
              valeur={champs.langues}
              onChange={(v) => modifier('langues', v)}
              disabled={envoi}
              placeholder="malgache, français, anglais"
              aide="Séparez par des virgules."
            />
          </fieldset>

          <fieldset className="completion__groupe">
            <legend>Vos disponibilités</legend>

            <div className="dispo">
              {JOURS.map((jour) => (
                <div key={jour} className="dispo__jour">
                  <span className="dispo__nom">{jour}</span>
                  <div className="dispo__moments">
                    {MOMENTS.map((moment) => {
                      const actif = (champs.disponibilites[jour] ?? []).includes(moment.cle);
                      return (
                        <button
                          key={moment.cle}
                          type="button"
                          aria-pressed={actif}
                          className={`dispo__moment${actif ? ' dispo__moment--actif' : ''}`}
                          onClick={() => basculerDisponibilite(jour, moment.cle)}
                        >
                          {moment.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="completion__groupe">
            <legend>Vos déplacements</legend>

            <Champ
              id="rayonKm"
              libelle="Distance acceptée depuis votre quartier"
              type="number"
              min="0"
              max="500"
              valeur={champs.rayonKm}
              onChange={(v) => modifier('rayonKm', v)}
              disabled={envoi}
              aide="En kilomètres."
            />

            <label className="completion__case">
              <input
                type="checkbox"
                checked={champs.accepteTerrain}
                onChange={(e) => modifier('accepteTerrain', e.target.checked)}
                disabled={envoi}
              />
              J’accepte les missions de terrain
            </label>
            <label className="completion__case">
              <input
                type="checkbox"
                checked={champs.accepteDistance}
                onChange={(e) => modifier('accepteDistance', e.target.checked)}
                disabled={envoi}
              />
              J’accepte les missions à distance
            </label>

            <p className="completion__note">
              Les missions de terrain demandent en plus une validation de votre profil par
              l’équipe HOPE.
            </p>
          </fieldset>

          <fieldset className="completion__groupe">
            <legend>En cas d’urgence</legend>

            <div className="completion__paire">
              <Champ
                id="contactUrgenceNom"
                libelle="Personne à prévenir"
                valeur={champs.contactUrgenceNom}
                onChange={(v) => modifier('contactUrgenceNom', v)}
                disabled={envoi}
              />
              <Champ
                id="contactUrgenceTel"
                libelle="Son téléphone"
                valeur={champs.contactUrgenceTel}
                onChange={(v) => modifier('contactUrgenceTel', v)}
                disabled={envoi}
              />
            </div>
          </fieldset>

          {erreur && (
            <p className="completion__erreur" role="alert">
              {erreur}
            </p>
          )}

          <div className="completion__pied">
            <button type="submit" className="completion__bouton" disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Accéder à mon espace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Un champ de saisie du formulaire de completion. */
function Champ({ id, libelle, valeur, onChange, aide, type = 'text', ...reste }) {
  return (
    <div className="completion__champ">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        {...reste}
      />
      {aide && <span className="completion__aide">{aide}</span>}
    </div>
  );
}
