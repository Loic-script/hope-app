import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';

import {
  IconeCalendrierRenouvele,
  IconeCoche,
  IconeCoeur,
  IconeFleche,
  IconeFlecheGauche,
  IconeSoleil,
} from '../../components/HopeIcons.jsx';
import { VisuelPaiement } from '../../components/VisuelsPaiement.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import { FREQUENCES_DON } from './commun.jsx';

/** Les etapes, dans l'ordre ; la cinquieme veut dire "merci". */
const ETAPES = [
  { numero: 1, libelle: 'Destination' },
  { numero: 2, libelle: 'Montant' },
  { numero: 3, libelle: 'Paiement' },
  { numero: 4, libelle: 'Confirmation' },
];

/** Des montants pour commencer, selon la devise ; on peut toujours saisir le sien. */
const MONTANTS_PROPOSES = {
  MGA: [10000, 25000, 50000, 100000, 250000],
  EUR: [10, 25, 50, 100, 250],
  USD: [10, 25, 50, 100, 250],
};

/** Les confettis du merci : place, angle et retard fixes, pour que le dessin soit stable. */
const CONFETTIS = [
  [8, -18, 0], [18, 24, 80], [28, -30, 160], [38, 12, 40], [48, -8, 120], [58, 30, 200],
  [68, -22, 60], [78, 16, 140], [88, -28, 20], [14, 34, 180], [52, -34, 100], [84, 8, 220],
];

/** "25 000", "25000,50" -> 25000.5 ; NaN si ce n'est pas un montant. */
function lireMontant(texte) {
  const propre = String(texte ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return Number.NaN;
  return Number(propre);
}

/**
 * Faire un don, en quatre etapes : a quoi il servira, combien et a quel
 * rythme, comment il sera paye, puis le recapitulatif.
 *
 * Aucun paiement ne passe par l'ecran : le donateur fait une PROMESSE de
 * don. Elle part en attente, l'equipe HOPE est prevenue, lui communique
 * les coordonnees de paiement et la confirme a reception. La page le dit
 * a chaque etape ou cela compte -- personne ne doit croire avoir paye.
 *
 * Les preferences du parcours d'accueil pre-remplissent le formulaire
 * (devise, mode, frequence, projet), et "?projet=12" arrive d'un bouton
 * "Soutenir ce projet".
 */
export default function FaireUnDon() {
  const { donateur, rafraichirCompteurs } = useOutletContext();
  const [parametres] = useSearchParams();

  const { donnees: profil } = useChargement(() => service.recupererProfil(), []);
  const { donnees: projetsBruts } = useChargement(() => service.listerProjets(), []);
  const projets = useMemo(() => projetsBruts?.items ?? [], [projetsBruts]);

  const [etape, setEtape] = useState(1);
  const [sens, setSens] = useState('avance');
  const [pret, setPret] = useState(false);

  const [affectation, setAffectation] = useState('');
  const [projetId, setProjetId] = useState(null);
  const [devise, setDevise] = useState('MGA');
  const [montant, setMontant] = useState('');
  const [frequence, setFrequence] = useState('ONE_TIME');
  const [mode, setMode] = useState('');
  const [message, setMessage] = useState('');

  const [refus, setRefus] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);

  // Les preferences pre-remplissent le formulaire, une fois tout arrive.
  useEffect(() => {
    if (pret || !profil || !projetsBruts) return;
    const ouverts = projets.filter((p) => !p.atteint);
    const demande = Number(parametres.get('projet'));
    const prefere = profil.don?.projetId;
    if (demande && ouverts.some((p) => p.id === demande)) {
      setAffectation('PROJECT');
      setProjetId(demande);
    } else if (profil.don?.affectation === 'PROJECT' && ouverts.some((p) => p.id === prefere)) {
      setAffectation('PROJECT');
      setProjetId(prefere);
    } else if (profil.don?.affectation === 'HOPE') {
      setAffectation('HOPE');
    }
    setDevise(profil.profil?.devise || 'MGA');
    setMode(profil.paiement?.mode || '');
    setFrequence(profil.frequence?.valeur || 'ONE_TIME');
    setPret(true);
  }, [pret, profil, projetsBruts, projets, parametres]);

  const modes = profil?.options?.modesPaiement ?? [];
  const devises = profil?.options?.devises ?? [{ code: 'MGA', libelle: 'Ariary' }];
  const projetChoisi = projets.find((p) => p.id === projetId) ?? null;
  const modeChoisi = modes.find((m) => m.cle === mode) ?? null;
  const valeur = lireMontant(montant);

  function aller(vers) {
    setRefus('');
    setSens(vers > etape ? 'avance' : 'recule');
    setEtape(vers);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Chaque etape se verifie avant d'avancer : l'erreur se dit la ou elle est. */
  function suivante() {
    if (etape === 1) {
      if (!affectation) return setRefus('Choisissez à quoi servira votre don.');
      if (affectation === 'PROJECT' && !projetChoisi) return setRefus('Choisissez le projet à soutenir.');
    }
    if (etape === 2 && !(valeur >= 1)) {
      return setRefus('Indiquez un montant : choisissez-en un, ou saisissez le vôtre.');
    }
    if (etape === 3 && !mode) return setRefus('Choisissez comment vous paierez.');
    return aller(etape + 1);
  }

  async function confirmer() {
    setEnvoi(true);
    setRefus('');
    try {
      const reponse = await service.faireUnDon({
        affectation,
        projetId: affectation === 'PROJECT' ? projetId : undefined,
        montant: String(valeur),
        devise,
        mode,
        frequence,
        message: message.trim() || undefined,
      });
      setResultat(reponse);
      setSens('avance');
      setEtape(5);
      rafraichirCompteurs?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre promesse de don n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  }

  function recommencer() {
    setResultat(null);
    setMontant('');
    setMessage('');
    aller(1);
  }

  if (!pret) return <p className="don-vide">Préparation de votre don…</p>;

  /* ---------------- Le merci ---------------- */
  if (etape === 5 && resultat) {
    const don = resultat.don;
    return (
      <div className="espace-donateur">
        <section className="don-merci" aria-live="polite">
          <div className="don-merci__confettis" aria-hidden="true">
            {CONFETTIS.map(([x, r, d], i) => (
              <span
                key={i}
                className={`don-merci__confetti don-merci__confetti--${i % 4}`}
                style={{ '--x': `${x}%`, '--r': `${r}deg`, '--dx': `${r * 2}px`, '--d': `${d}ms` }}
              />
            ))}
          </div>
          <svg className="don-merci__coche" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="36" />
            <path d="M24 41.5 35 52l21-24" />
          </svg>
          <h1 className="don-merci__titre">Merci, {donateur?.prenom || 'pour votre générosité'} !</h1>
          <p className="don-merci__texte">
            Votre promesse de don de{' '}
            <strong>{fmt.montant(don.montant, don.devise)}</strong>
            {don.frequence === 'MONTHLY' ? ' par mois' : ''} est enregistrée
            {don.projetNom ? ` pour « ${don.projetNom} »` : ' pour le fonds HOPE'}.
          </p>
          <p className="don-merci__reference">
            Référence <strong>{don.reference}</strong>
          </p>

          <ol className="don-merci__etapes">
            <li>
              <span>1</span>L’équipe HOPE vous contacte pour le paiement par{' '}
              {modeChoisi?.libelle ?? don.modePaiement}.
            </li>
            <li>
              <span>2</span>Vous effectuez le paiement, à votre rythme.
            </li>
            <li>
              <span>3</span>Votre don passe à « Reçu » dans Mes dons, et commence à agir.
            </li>
          </ol>

          <div className="don-merci__actions">
            <Link className="don-cta don-cta--plein" to="/donateur/mes-dons">
              Suivre mes dons
              <IconeFleche />
            </Link>
            <button type="button" className="don-bouton-secondaire" onClick={recommencer}>
              Faire un autre don
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ---------------- Les quatre etapes ---------------- */
  return (
    <div className="espace-donateur don-formulaire">
      <header className="don-entete">
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Faire un don
        </p>
        <h1 className="don-entete__titre">Votre don, en quatre gestes</h1>
        <p className="don-entete__accroche">
          Aucun paiement en ligne : vous faites une promesse de don, et l’équipe HOPE vous
          accompagne pour le paiement.
        </p>
      </header>

      {/* La progression : quatre pas, et la ligne qui se remplit. */}
      <ol className="don-pas" style={{ '--avance': `${((etape - 1) / (ETAPES.length - 1)) * 100}%` }}>
        {ETAPES.map((e) => (
          <li
            key={e.numero}
            className={`don-pas__pas${etape === e.numero ? ' don-pas__pas--actif' : ''}${
              etape > e.numero ? ' don-pas__pas--fait' : ''
            }`}
            aria-current={etape === e.numero ? 'step' : undefined}
          >
            <span className="don-pas__rond">{etape > e.numero ? <IconeCoche /> : e.numero}</span>
            <span className="don-pas__libelle">{e.libelle}</span>
          </li>
        ))}
      </ol>

      <div className="don-disposition">
        <div key={etape} className={`don-etape don-etape--${sens}`}>
          {/* ---------- 1. Destination ---------- */}
          {etape === 1 && (
            <section aria-labelledby="don-etape-1">
              <h2 className="don-etape__titre" id="don-etape-1">
                À quoi servira votre don ?
              </h2>
              <div className="don-choix-duo">
                <button
                  type="button"
                  aria-pressed={affectation === 'HOPE'}
                  className={`don-choix${affectation === 'HOPE' ? ' don-choix--actif' : ''}`}
                  onClick={() => {
                    setAffectation('HOPE');
                    setProjetId(null);
                    setRefus('');
                  }}
                >
                  <span className="don-choix__icone" aria-hidden="true">
                    <IconeSoleil />
                  </span>
                  <strong>Là où le besoin est le plus grand</strong>
                  <span>HOPE l’emploie sur le projet qui en a le plus besoin, au moment où il arrive.</span>
                </button>
                <button
                  type="button"
                  aria-pressed={affectation === 'PROJECT'}
                  className={`don-choix${affectation === 'PROJECT' ? ' don-choix--actif' : ''}`}
                  onClick={() => {
                    setAffectation('PROJECT');
                    setRefus('');
                  }}
                >
                  <span className="don-choix__icone" aria-hidden="true">
                    <IconeCoeur />
                  </span>
                  <strong>Un projet que je choisis</strong>
                  <span>Votre don va tout entier au projet choisi, et vous suivez son avancée.</span>
                </button>
              </div>

              {affectation === 'PROJECT' && (
                <div className="don-projets" role="group" aria-label="Projets à soutenir">
                  {projets.map((p, rang) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={p.atteint}
                      aria-pressed={projetId === p.id}
                      className={`don-projet${projetId === p.id ? ' don-projet--actif' : ''}`}
                      style={{ '--rang': rang }}
                      onClick={() => {
                        setProjetId(p.id);
                        setRefus('');
                      }}
                    >
                      <span className="don-projet__image">
                        {p.image ? <img src={urlMedia(p.image)} alt="" loading="lazy" /> : <IconeSoleil />}
                        {projetId === p.id && (
                          <span className="don-projet__coche" aria-hidden="true">
                            <IconeCoche />
                          </span>
                        )}
                      </span>
                      <span className="don-projet__corps">
                        <span className="don-projet__categorie">{p.categorie}</span>
                        <strong className="don-projet__nom">{p.nom}</strong>
                        {p.lieu && <span className="don-projet__lieu">{p.lieu}</span>}
                        <span className="don-projet__rail" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, Number(p.taux) || 0)}%` }} />
                        </span>
                        <span className="don-projet__reste">
                          {p.atteint
                            ? 'Objectif atteint, merci !'
                            : `Il manque ${fmt.montant(p.restant, p.devise)} · ${fmt.pourcent(p.taux)}`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ---------- 2. Montant et frequence ---------- */}
          {etape === 2 && (
            <section aria-labelledby="don-etape-2">
              <h2 className="don-etape__titre" id="don-etape-2">
                Combien souhaitez-vous donner ?
              </h2>

              <div className="don-devises" role="group" aria-label="Devise">
                {devises.map((d) => (
                  <button
                    key={d.code}
                    type="button"
                    aria-pressed={devise === d.code}
                    className={`don-devise${devise === d.code ? ' don-devise--actif' : ''}`}
                    onClick={() => {
                      setDevise(d.code);
                      setMontant('');
                    }}
                  >
                    {d.code}
                    <span>{d.libelle}</span>
                  </button>
                ))}
              </div>

              <div className="don-montants" role="group" aria-label="Montants proposés">
                {(MONTANTS_PROPOSES[devise] ?? MONTANTS_PROPOSES.MGA).map((m, rang) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={valeur === m}
                    className={`don-montant${valeur === m ? ' don-montant--actif' : ''}`}
                    style={{ '--rang': rang }}
                    onClick={() => {
                      setMontant(String(m));
                      setRefus('');
                    }}
                  >
                    {fmt.montant(m, devise)}
                  </button>
                ))}
              </div>

              <label className="don-saisie">
                <span className="don-saisie__libelle">Ou votre montant</span>
                <span className="don-saisie__boite">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montant}
                    onChange={(e) => {
                      setMontant(e.target.value);
                      setRefus('');
                    }}
                    placeholder={devise === 'MGA' ? '30 000' : '30'}
                    aria-describedby="don-montant-aide"
                  />
                  <span className="don-saisie__devise">{devise}</span>
                </span>
              </label>
              <p className="don-aide" id="don-montant-aide">
                {projetChoisi && !projetChoisi.atteint && projetChoisi.devise === devise
                  ? `Il manque encore ${fmt.montant(projetChoisi.restant, devise)} à « ${projetChoisi.nom} ».`
                  : 'Chaque montant compte : l’équipe HOPE vous dira comment il a été employé.'}
              </p>

              <h3 className="don-etape__sous-titre">À quel rythme ?</h3>
              <div className="don-rythmes" role="group" aria-label="Fréquence">
                {Object.entries(FREQUENCES_DON).map(([cle, libelle]) => (
                  <button
                    key={cle}
                    type="button"
                    aria-pressed={frequence === cle}
                    className={`don-rythme${frequence === cle ? ' don-rythme--actif' : ''}`}
                    onClick={() => setFrequence(cle)}
                  >
                    {cle === 'MONTHLY' ? <IconeCalendrierRenouvele /> : <IconeCoeur />}
                    <strong>{cle === 'MONTHLY' ? 'Chaque mois' : 'Une fois'}</strong>
                    <span>{cle === 'MONTHLY' ? 'Un soutien régulier, qui permet de prévoir.' : libelle}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ---------- 3. Paiement ---------- */}
          {etape === 3 && (
            <section aria-labelledby="don-etape-3">
              <h2 className="don-etape__titre" id="don-etape-3">
                Comment paierez-vous ?
              </h2>
              <div className="don-modes" role="group" aria-label="Mode de paiement">
                {modes.map((m, rang) => (
                  <button
                    key={m.cle}
                    type="button"
                    aria-pressed={mode === m.cle}
                    className={`don-mode${mode === m.cle ? ' don-mode--actif' : ''}`}
                    style={{ '--rang': rang }}
                    onClick={() => {
                      setMode(m.cle);
                      setRefus('');
                    }}
                  >
                    <span className="don-mode__visuel" aria-hidden="true">
                      <VisuelPaiement cle={m.cle} />
                    </span>
                    <span className="don-mode__nom">{m.libelle}</span>
                  </button>
                ))}
              </div>
              <p className="don-aide" aria-live="polite">
                {modeChoisi ? modeChoisi.description : 'Le moyen que vous préférez : l’équipe s’y adapte.'}
              </p>

              <label className="don-saisie don-saisie--texte">
                <span className="don-saisie__libelle">Un mot pour l’équipe ? (facultatif)</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Une dédicace, une précision sur votre don…"
                />
              </label>
            </section>
          )}

          {/* ---------- 4. Confirmation ---------- */}
          {etape === 4 && (
            <section aria-labelledby="don-etape-4">
              <h2 className="don-etape__titre" id="don-etape-4">
                Vérifiez, puis confirmez
              </h2>
              <div className="don-recap">
                <p className="don-recap__montant">
                  {fmt.montant(valeur, devise)}
                  {frequence === 'MONTHLY' && <span> / mois</span>}
                </p>
                <dl className="don-recap__lignes">
                  <div>
                    <dt>Pour</dt>
                    <dd>{projetChoisi ? projetChoisi.nom : 'Là où le besoin est le plus grand'}</dd>
                  </div>
                  <div>
                    <dt>Rythme</dt>
                    <dd>{frequence === 'MONTHLY' ? 'Chaque mois' : 'Une fois'}</dd>
                  </div>
                  <div>
                    <dt>Paiement</dt>
                    <dd>{modeChoisi?.libelle}</dd>
                  </div>
                  {message.trim() && (
                    <div>
                      <dt>Votre mot</dt>
                      <dd>« {message.trim()} »</dd>
                    </div>
                  )}
                </dl>
                <p className="don-recap__note">
                  En confirmant, vous faites une promesse de don : rien n’est prélevé ici. L’équipe
                  HOPE vous contacte pour le paiement, puis confirme votre don à réception.
                </p>
              </div>
            </section>
          )}

          {refus && (
            <p className="don-refus" role="alert">
              {refus}
            </p>
          )}

          <div className="don-navigation">
            {etape > 1 ? (
              <button type="button" className="don-bouton-secondaire" onClick={() => aller(etape - 1)} disabled={envoi}>
                <IconeFlecheGauche />
                Retour
              </button>
            ) : (
              <span />
            )}
            {etape < 4 ? (
              <button type="button" className="don-cta don-cta--plein" onClick={suivante}>
                Continuer
                <IconeFleche />
              </button>
            ) : (
              <button type="button" className="don-cta don-cta--plein don-cta--confirmer" onClick={confirmer} disabled={envoi}>
                <IconeCoeur />
                {envoi ? 'Enregistrement…' : 'Confirmer ma promesse de don'}
              </button>
            )}
          </div>
        </div>

        {/* Le recapitulatif qui suit la saisie, sur grand ecran. */}
        <aside className="don-resume" aria-label="Votre don">
          <p className="don-resume__titre">Votre don</p>
          <p className="don-resume__montant">
            {valeur >= 1 ? fmt.montant(valeur, devise) : '—'}
            {valeur >= 1 && frequence === 'MONTHLY' && <span> / mois</span>}
          </p>
          <ul className="don-resume__lignes">
            <li>
              <span>Pour</span>
              <strong>
                {affectation === 'HOPE'
                  ? 'Le besoin le plus urgent'
                  : projetChoisi?.nom ?? 'À choisir'}
              </strong>
            </li>
            <li>
              <span>Rythme</span>
              <strong>{frequence === 'MONTHLY' ? 'Chaque mois' : 'Une fois'}</strong>
            </li>
            <li>
              <span>Paiement</span>
              <strong>{modeChoisi?.libelle ?? 'À choisir'}</strong>
            </li>
          </ul>
          <p className="don-resume__note">
            <IconeCoche />
            Suivi de bout en bout, projet par projet.
          </p>
        </aside>
      </div>
    </div>
  );
}
