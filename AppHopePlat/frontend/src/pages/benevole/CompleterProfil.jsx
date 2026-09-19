import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import HopeLogo from '../../components/HopeLogo.jsx';
import { messageErreur } from '../../services/api.js';
import { apiBenevole } from '../../services/apiBenevole.js';
import { focusAutomatique } from '../../utils/ecran.js';

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
 * L'inscription commune aux trois types ne demande que l'adresse, le
 * type et le mot de passe. Le nom est donc demande ici, avec ce qui sert
 * a confier les bonnes taches -- ce qu'on sait faire, quand on est
 * libre, jusqu'ou on se deplace. Une fois, et modifiable ensuite depuis
 * "Mon profil".
 */
export default function CompleterProfil() {
  // La garde nous a laisses passer : c'est elle qui nous renverra vers
  // l'espace des qu'elle aura relu le profil.
  const { benevole, rafraichir } = useOutletContext();

  // Un compte ouvert avant que l'inscription ne cesse de demander le nom
  // l'a deja : on le reprend plutot que de le redemander.
  const [champs, setChamps] = useState({
    prenom: benevole?.prenom ?? '',
    nom: benevole?.nom ?? '',
    telephone: benevole?.telephone ?? '',
    profession: '',
    competences: '',
    langues: '',
    disponibilites: {},
    rayonKm: '',
    adresse: '',
    dateDeNaissance: '',
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
            Ces informations aident l’équipe à vous proposer les tâches qui vous
            correspondent. Vous pourrez les modifier à tout moment.
          </p>
        </header>

        <form className="completion__formulaire" onSubmit={soumettre}>
          <fieldset className="completion__groupe">
            <legend>Vous</legend>

            <div className="completion__paire">
              <Champ
                id="prenom"
                libelle="Prénom"
                valeur={champs.prenom}
                onChange={(v) => modifier('prenom', v)}
                disabled={envoi}
                autoComplete="given-name"
                required
                autoFocus={focusAutomatique()}
              />
              <Champ
                id="nom"
                libelle="Nom"
                valeur={champs.nom}
                onChange={(v) => modifier('nom', v)}
                disabled={envoi}
                autoComplete="family-name"
                required
              />
            </div>

            <Champ
              id="telephone"
              libelle="Téléphone"
              type="tel"
              valeur={champs.telephone}
              onChange={(v) => modifier('telephone', v)}
              disabled={envoi}
              autoComplete="tel"
              placeholder="+261 34 12 345 67"
              aide="Facultatif. L’équipe vous joint plus vite par téléphone."
            />

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
