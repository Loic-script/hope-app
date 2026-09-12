import { useEffect, useState } from 'react';

import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOMENTS = [
  { cle: 'matin', label: 'Matin' },
  { cle: 'apres-midi', label: 'Après-midi' },
  { cle: 'soir', label: 'Soir' },
  { cle: 'journee', label: 'Journée' },
];

/**
 * Mon profil de benevole.
 *
 * Ce qui se saisit ici sert a proposer les bonnes missions : ce que
 * l'on sait faire, quand on est libre, jusqu'ou l'on se deplace.
 *
 * Deux informations sont affichees sans etre modifiables : le nom et
 * la validation par HOPE. La premiere identifie, la seconde ouvre les
 * missions de terrain -- si le benevole pouvait la cocher lui-meme,
 * elle ne vaudrait plus rien.
 */
export default function MonProfil() {
  const { donnees, chargement, erreur, recharger } = useChargement(
    () => service.recupererProfil(),
    []
  );

  const [champs, setChamps] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [succes, setSucces] = useState('');

  // Le formulaire part de ce que le serveur a renvoye.
  useEffect(() => {
    if (!donnees) return;
    setChamps({
      profession: donnees.profession ?? '',
      competences: (donnees.competences ?? []).join(', '),
      langues: (donnees.langues ?? []).join(', '),
      disponibilites: donnees.disponibilites ?? {},
      rayonKm: donnees.rayonKm ?? '',
      accepteTerrain: donnees.accepteTerrain ?? true,
      accepteDistance: donnees.accepteDistance ?? true,
      contactUrgenceNom: donnees.contactUrgenceNom ?? '',
      contactUrgenceTel: donnees.contactUrgenceTel ?? '',
      adresse: donnees.adresse ?? '',
      telephone: donnees.telephone ?? '',
      dateDeNaissance: donnees.dateDeNaissance ?? '',
    });
  }, [donnees]);

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
    setRefus('');
    setSucces('');
    try {
      await service.mettreAJourProfil({
        profession: champs.profession,
        competences: champs.competences,
        langues: champs.langues,
        disponibilites: champs.disponibilites,
        rayonKm: champs.rayonKm === '' ? null : champs.rayonKm,
        accepteTerrain: champs.accepteTerrain,
        accepteDistance: champs.accepteDistance,
        contactUrgenceNom: champs.contactUrgenceNom,
        contactUrgenceTel: champs.contactUrgenceTel,
        adresse: champs.adresse,
        telephone: champs.telephone,
        dateDeNaissance: champs.dateDeNaissance || null,
      });
      setSucces('Votre profil est à jour.');
      recharger();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Le profil n’a pas pu être enregistré.'));
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement && !donnees) {
    return <p className="bloc__vide">Chargement de votre profil…</p>;
  }
  if (erreur) return <p className="alerte-benevole">{erreur}</p>;
  if (!champs) return null;

  return (
    <>
      <header className="page-benevole__entete">
        <h1 className="page-benevole__titre">Mon profil</h1>
        <p className="page-benevole__accroche">
          Ces informations aident l’équipe à vous proposer les missions qui vous
          correspondent.
        </p>
      </header>

      <section className={`validation${donnees.valideParHope ? ' validation--ok' : ''}`}>
        {donnees.valideParHope ? (
          <>
            <strong>Profil validé par HOPE</strong>
            <span>
              Vous avez accès aux missions de terrain
              {donnees.valideLe && ` — depuis le ${fmt.date(donnees.valideLe)}`}.
            </span>
          </>
        ) : (
          <>
            <strong>Profil en cours de validation</strong>
            <span>
              Les missions à distance et en présentiel vous sont ouvertes. Les missions de
              terrain attendent la validation de l’équipe.
            </span>
          </>
        )}
      </section>

      <form className="profil-benevole" onSubmit={soumettre}>
        <fieldset className="profil-benevole__groupe">
          <legend>Identité</legend>

          <p className="profil-benevole__fixe">
            <span>Nom</span>
            <strong>{`${donnees.prenom} ${donnees.nom}`}</strong>
          </p>
          <p className="profil-benevole__fixe">
            <span>Adresse électronique</span>
            <strong>{donnees.email}</strong>
          </p>

          <Champ
            id="telephone"
            libelle="Téléphone"
            valeur={champs.telephone}
            onChange={(v) => modifier('telephone', v)}
            placeholder="+261 34 12 345 67"
          />
          <Champ
            id="dateDeNaissance"
            libelle="Date de naissance"
            type="date"
            valeur={champs.dateDeNaissance}
            onChange={(v) => modifier('dateDeNaissance', v)}
            aide={donnees.age !== null ? `${donnees.age} ans` : undefined}
          />
          <Champ
            id="adresse"
            libelle="Adresse"
            valeur={champs.adresse}
            onChange={(v) => modifier('adresse', v)}
            placeholder="Quartier, ville"
          />
          <Champ
            id="profession"
            libelle="Profession"
            valeur={champs.profession}
            onChange={(v) => modifier('profession', v)}
          />
        </fieldset>

        <fieldset className="profil-benevole__groupe">
          <legend>Ce que je sais faire</legend>

          <Champ
            id="competences"
            libelle="Compétences"
            valeur={champs.competences}
            onChange={(v) => modifier('competences', v)}
            placeholder="traduction, informatique, cuisine"
            aide="Séparez par des virgules."
          />
          <Champ
            id="langues"
            libelle="Langues"
            valeur={champs.langues}
            onChange={(v) => modifier('langues', v)}
            placeholder="malgache, français, anglais"
            aide="Séparez par des virgules."
          />
        </fieldset>

        <fieldset className="profil-benevole__groupe">
          <legend>Mes disponibilités</legend>

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

        <fieldset className="profil-benevole__groupe">
          <legend>Mes déplacements</legend>

          <Champ
            id="rayonKm"
            libelle="Distance acceptée depuis mon quartier"
            type="number"
            min="0"
            max="500"
            valeur={champs.rayonKm}
            onChange={(v) => modifier('rayonKm', v)}
            aide="En kilomètres."
          />

          <label className="profil-benevole__case">
            <input
              type="checkbox"
              checked={champs.accepteTerrain}
              onChange={(e) => modifier('accepteTerrain', e.target.checked)}
            />
            J’accepte les missions de terrain
          </label>
          <label className="profil-benevole__case">
            <input
              type="checkbox"
              checked={champs.accepteDistance}
              onChange={(e) => modifier('accepteDistance', e.target.checked)}
            />
            J’accepte les missions à distance
          </label>
        </fieldset>

        <fieldset className="profil-benevole__groupe">
          <legend>En cas d’urgence</legend>

          <Champ
            id="contactUrgenceNom"
            libelle="Personne à prévenir"
            valeur={champs.contactUrgenceNom}
            onChange={(v) => modifier('contactUrgenceNom', v)}
          />
          <Champ
            id="contactUrgenceTel"
            libelle="Son téléphone"
            valeur={champs.contactUrgenceTel}
            onChange={(v) => modifier('contactUrgenceTel', v)}
          />
        </fieldset>

        {refus && <p className="alerte-benevole">{refus}</p>}
        {succes && <p className="succes-benevole">{succes}</p>}

        <div className="profil-benevole__pied">
          <button type="submit" className="btn btn--principal" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer mon profil'}
          </button>
        </div>
      </form>
    </>
  );
}

/** Un champ de saisie du profil. */
function Champ({ id, libelle, valeur, onChange, aide, type = 'text', ...reste }) {
  return (
    <div className="profil-benevole__champ">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        {...reste}
      />
      {aide && <span className="profil-benevole__aide">{aide}</span>}
    </div>
  );
}
