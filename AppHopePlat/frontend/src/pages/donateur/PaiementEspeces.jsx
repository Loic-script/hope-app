import { useEffect, useRef, useState } from 'react';

import HopeLogo from '../../components/HopeLogo.jsx';
import { montantSaisi, usePromesseDon } from '../../hooks/usePromesseDon.js';
import * as fmt from '../../utils/format.js';

const RAPIDES = [10000, 25000, 50000, 100000];
const MINIMUM = 1000;

/** "2026-09-25" pour un decalage de n jours a partir d'aujourd'hui. */
function jourIso(decalage) {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
}

/** "jeudi 25 septembre" */
function jourLisible(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Le don en especes, remis en main propre a l'equipe HOPE.
 *
 * L'objet de reference : le carnet a souches. Le donateur dit combien,
 * ou (au bureau, ou chez lui) et quand ; la page lui remet un bon de
 * remise, a souche perforee, qui porte la reference du don. Le jour
 * venu, il le montre : l'equipe lui donne un recu papier, et confirme
 * le don.
 */
export default function PaiementEspeces() {
  const { profil, coordonnees, erreurChargement, beneficiaire, nom, don, envoi, refus, promettre, quitter } =
    usePromesseDon('especes');

  const [montant, setMontant] = useState('');
  const [lieu, setLieu] = useState('');
  const [date, setDate] = useState(jourIso(1));
  const [moment, setMoment] = useState('matin');
  const [adresse, setAdresse] = useState('');
  const [soumis, setSoumis] = useState(false);
  const titre = useRef(null);

  const bureau = coordonnees?.bureau;

  useEffect(() => {
    if (!profil) return;
    // Sans bureau renseigne, l'equipe se deplace ; l'adresse du profil
    // sert de point de depart.
    setLieu((courant) => courant || (bureau?.disponible ? 'bureau' : 'domicile'));
    const info = profil.informations ?? {};
    setAdresse((a) => a || [info.adresse, info.ville].filter(Boolean).join(', '));
  }, [profil, bureau]);

  useEffect(() => {
    if (don) titre.current?.focus();
  }, [don]);

  const somme = montantSaisi(montant);
  const erreurs = {
    montant: somme === null ? 'Indiquez le montant.' : somme < MINIMUM ? `Au moins ${fmt.montant(MINIMUM)}.` : '',
    date: date >= jourIso(0) && date <= jourIso(90) ? '' : 'Une date dans les trois prochains mois.',
    adresse: lieu === 'domicile' && !adresse.trim() ? 'Indiquez où passer.' : '',
  };

  async function reserver(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurs.montant || erreurs.date || erreurs.adresse) return;
    await promettre({
      montant: somme,
      remise: { lieu, date, moment, adresse: lieu === 'domicile' ? adresse.trim() : undefined },
    });
  }

  const quand = `${jourLisible(date)}, ${moment === 'matin' ? 'le matin' : 'l’après-midi'}`;

  return (
    <div className="esp">
      <header className="esp__tete">
        <button
          type="button"
          className="esp__retour"
          onClick={() => quitter(4)}
          disabled={envoi || Boolean(don)}
          aria-label="Revenir au choix du paiement"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="esp__tete-titre">Don en espèces</span>
        <span className="esp__tete-hope">
          <HopeLogo compact />
        </span>
      </header>

      <main className="esp__page">
        {erreurChargement && (
          <p className="esp__alerte" role="alert">
            {erreurChargement}
          </p>
        )}
        {!profil && !erreurChargement && (
          <p className="esp__attente" role="status">
            Préparation…
          </p>
        )}

        {/* ---------- 1. Combien, ou, quand ---------- */}
        {profil && !don && (
          <form className="esp__temps" onSubmit={reserver} noValidate aria-label="Remise du don en espèces">
            <h1 className="esp__titre">Remettez votre don en main propre</h1>

            <label className="esp__champ" htmlFor="esp-montant">
              <span className="esp__libelle">Montant</span>
              <span className={`esp__montant${soumis && erreurs.montant ? ' esp__montant--erreur' : ''}`}>
                <input
                  id="esp-montant"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value.replace(/[^\d\s]/g, ''))}
                  disabled={envoi}
                  aria-invalid={soumis && Boolean(erreurs.montant)}
                />
                <span aria-hidden="true">Ar</span>
              </span>
            </label>
            <div className="esp__rapides" role="group" aria-label="Montants proposés">
              {RAPIDES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`esp__rapide${somme === v ? ' esp__rapide--choisi' : ''}`}
                  aria-pressed={somme === v}
                  onClick={() => setMontant(fmt.nombre(v))}
                  disabled={envoi}
                >
                  {fmt.nombre(v)}
                </button>
              ))}
            </div>
            {soumis && erreurs.montant && <p className="esp__erreur">{erreurs.montant}</p>}

            <fieldset className="esp__groupe">
              <legend className="esp__libelle">Où ?</legend>
              <div className="esp__lieux">
                <label className={`esp__lieu${lieu === 'bureau' ? ' esp__lieu--choisi' : ''}${bureau?.disponible ? '' : ' esp__lieu--ferme'}`}>
                  <input
                    type="radio"
                    name="lieu"
                    value="bureau"
                    checked={lieu === 'bureau'}
                    onChange={() => setLieu('bureau')}
                    disabled={envoi || !bureau?.disponible}
                  />
                  <span className="esp__lieu-titre">Au bureau de HOPE</span>
                  <span className="esp__lieu-texte">
                    {bureau?.disponible ? bureau.adresse : 'Adresse bientôt communiquée'}
                  </span>
                </label>
                <label className={`esp__lieu${lieu === 'domicile' ? ' esp__lieu--choisi' : ''}`}>
                  <input
                    type="radio"
                    name="lieu"
                    value="domicile"
                    checked={lieu === 'domicile'}
                    onChange={() => setLieu('domicile')}
                    disabled={envoi}
                  />
                  <span className="esp__lieu-titre">L’équipe passe chez vous</span>
                  <span className="esp__lieu-texte">À Antananarivo et alentours</span>
                </label>
              </div>
            </fieldset>

            {lieu === 'domicile' && (
              <label className="esp__champ esp__champ--apparait" htmlFor="esp-adresse">
                <span className="esp__libelle">Adresse</span>
                <input
                  id="esp-adresse"
                  className={`esp__saisie${soumis && erreurs.adresse ? ' esp__saisie--erreur' : ''}`}
                  autoComplete="street-address"
                  value={adresse}
                  maxLength={255}
                  onChange={(e) => setAdresse(e.target.value)}
                  disabled={envoi}
                />
                {soumis && erreurs.adresse && <span className="esp__erreur">{erreurs.adresse}</span>}
              </label>
            )}

            <div className="esp__quand">
              <label className="esp__champ" htmlFor="esp-date">
                <span className="esp__libelle">Quel jour ?</span>
                <input
                  id="esp-date"
                  type="date"
                  className={`esp__saisie${soumis && erreurs.date ? ' esp__saisie--erreur' : ''}`}
                  min={jourIso(0)}
                  max={jourIso(90)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={envoi}
                />
              </label>
              <fieldset className="esp__groupe esp__groupe--moment">
                <legend className="esp__libelle">Quand ?</legend>
                <div className="esp__moments">
                  {[
                    ['matin', 'Matin'],
                    ['apres-midi', 'Après-midi'],
                  ].map(([cle, texte]) => (
                    <label key={cle} className={`esp__moment${moment === cle ? ' esp__moment--choisi' : ''}`}>
                      <input
                        type="radio"
                        name="moment"
                        value={cle}
                        checked={moment === cle}
                        onChange={() => setMoment(cle)}
                        disabled={envoi}
                      />
                      {texte}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            {soumis && erreurs.date && <p className="esp__erreur">{erreurs.date}</p>}

            <button type="submit" className="esp__bouton" disabled={envoi} aria-busy={envoi}>
              {envoi ? 'Enregistrement…' : 'Obtenir mon bon de remise'}
            </button>
            <button type="button" className="esp__lien" onClick={() => quitter()} disabled={envoi}>
              Payer plus tard
            </button>
            <p className="esp__erreur esp__erreur--centre" role="alert">
              {refus}
            </p>
          </form>
        )}

        {/* ---------- 2. Le bon de remise ---------- */}
        {profil && don && (
          <section className="esp__temps esp__temps--bon">
            <h1 className="esp__titre esp__titre--centre" ref={titre} tabIndex={-1}>
              Votre bon de remise
            </h1>

            <article className="bon" aria-label="Bon de remise">
              <div className="bon__corps">
                <header className="bon__tete">
                  <HopeLogo className="bon__hope" />
                  <span className="bon__numero">{don.reference}</span>
                </header>
                <p className="bon__montant">{fmt.montant(don.montant)}</p>
                <dl className="bon__lignes">
                  <div>
                    <dt>Remis par</dt>
                    <dd>{nom || '—'}</dd>
                  </div>
                  <div>
                    <dt>Pour</dt>
                    <dd>{beneficiaire}</dd>
                  </div>
                  <div>
                    <dt>Où</dt>
                    <dd>{lieu === 'bureau' ? bureau.adresse : adresse}</dd>
                  </div>
                  <div>
                    <dt>Quand</dt>
                    <dd>{quand}</dd>
                  </div>
                </dl>
              </div>
              {/* La souche : elle se detache, c'est la part de l'equipe. */}
              <div className="bon__souche" aria-hidden="true">
                <span>Souche</span>
                <strong>{don.reference}</strong>
                <span>{fmt.montant(don.montant)}</span>
              </div>
            </article>

            <p className="esp__texte">
              Montrez ce bon le jour venu : l’équipe vous remettra un reçu papier et confirmera votre don.
              {lieu === 'bureau' && bureau?.horaires ? ` Horaires : ${bureau.horaires}.` : ''}
              {bureau?.telephone ? ` Un empêchement ? ${bureau.telephone}.` : ''}
            </p>
            <button type="button" className="esp__bouton" onClick={() => quitter()}>
              Continuer mon inscription
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
