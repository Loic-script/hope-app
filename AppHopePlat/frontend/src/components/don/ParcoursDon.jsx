import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pageDePaiement } from '../../utils/pagesPaiement.js';

import {
  IconeCalendrierRenouvele,
  IconeCoche,
  IconeCoeur,
  IconeFleche,
  IconeFlecheGauche,
  IconeSoleil,
} from '../HopeIcons.jsx';
import { VisuelPaiement } from '../VisuelsPaiement.jsx';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as fmt from '../../utils/format.js';

const TOUTES_LES_ETAPES = [
  { cle: 'destination', libelle: 'Destination' },
  { cle: 'montant', libelle: 'Montant' },
  { cle: 'paiement', libelle: 'Paiement' },
  { cle: 'confirmation', libelle: 'Confirmation' },
];

const ETAPES_AVEC_PAGES = [
  { cle: 'paiement', libelle: 'Paiement' },
  { cle: 'destination', libelle: 'Destination' },
];

const MONTANTS_PROPOSES = {
  MGA: [10000, 25000, 50000, 100000, 250000],
  EUR: [10, 25, 50, 100, 250],
  USD: [10, 25, 50, 100, 250],
};

const CONFETTIS = [
  [8, -18, 0], [18, 24, 80], [28, -30, 160], [38, 12, 40], [48, -8, 120], [58, 30, 200],
  [68, -22, 60], [78, 16, 140], [88, -28, 20], [14, 34, 180], [52, -34, 100], [84, 8, 220],
];

function lireMontant(texte) {
  const propre = String(texte ?? '').replace(/[\s\u202f\u00a0]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return Number.NaN;
  return Number(propre);
}

export default function ParcoursDon({
  prenom,
  chargerOptions,
  chargerProjets,
  envoyer,
  projetImpose = null,
  projetPropose = null,
  avecRythme = true,
  avecFinances = true,
  etiquettesDestination = null,
  destinationDabord = false,
  lienSuivi = null,
  lienRetour,
  titre,
  accroche,
  onEnvoye,
  payer = null,
}) {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [projets, setProjets] = useState(null);
  const [erreurChargement, setErreurChargement] = useState('');

  const etapes = useMemo(() => {
    const sansDestination = (e) => !(projetImpose && e.cle === 'destination');
    if (payer) {
      const ordre = destinationDabord ? [...ETAPES_AVEC_PAGES].reverse() : ETAPES_AVEC_PAGES;
      return ordre.filter(sansDestination);
    }
    return TOUTES_LES_ETAPES.filter(sansDestination);
  }, [projetImpose, payer, destinationDabord]);
  const [rang, setRang] = useState(0);
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

  useEffect(() => {
    let annule = false;
    Promise.all([chargerOptions(), chargerProjets()])
      .then(([o, p]) => {
        if (annule) return;
        setOptions(o);
        setProjets(p);
      })
      .catch((echec) => !annule && setErreurChargement(messageErreur(echec, 'Le formulaire n’a pas pu se charger.')));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pret || !options || !projets) return;
    const ouverts = projets.filter((p) => !p.atteint);
    const prefs = options.preferences ?? {};
    const voulu = Number(projetImpose || projetPropose) || null;
    if (voulu && (projetImpose || ouverts.some((p) => p.id === voulu))) {
      setAffectation('PROJECT');
      setProjetId(voulu);
    } else if (prefs.affectation === 'PROJECT' && ouverts.some((p) => p.id === prefs.projetId)) {
      setAffectation('PROJECT');
      setProjetId(prefs.projetId);
    } else if (prefs.affectation === 'HOPE') {
      setAffectation('HOPE');
    }
    setDevise(prefs.devise || 'MGA');
    setMode(prefs.mode || '');
    setFrequence(avecRythme ? prefs.frequence || 'ONE_TIME' : 'ONE_TIME');
    setPret(true);
  }, [pret, options, projets, projetImpose, projetPropose, avecRythme]);

  const modes = options?.modes ?? [];
  const devises = options?.devises?.length ? options.devises : [{ code: 'MGA', libelle: 'Ariary' }];
  const projetChoisi = (projets ?? []).find((p) => p.id === projetId) ?? null;
  const modeChoisi = modes.find((m) => m.cle === mode) ?? null;
  const valeur = lireMontant(montant);
  const etape = etapes[rang]?.cle;
  const derniere = rang === etapes.length - 1;
  const mensuel = avecRythme && frequence === 'MONTHLY';

  function aller(vers) {
    setRefus('');
    setSens(vers > rang ? 'avance' : 'recule');
    setRang(vers);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function suivante() {
    if (etape === 'destination') {
      if (!affectation) return setRefus('Choisissez à quoi servira votre don.');
      if (affectation === 'PROJECT' && !projetChoisi) return setRefus('Choisissez le projet à soutenir.');
    }
    if (etape === 'montant' && !(valeur >= 1)) {
      return setRefus('Indiquez un montant : choisissez-en un, ou saisissez le vôtre.');
    }
    if (etape === 'paiement' && !mode) return setRefus('Choisissez votre mode de paiement.');
    return aller(rang + 1);
  }

  function versLaPage() {
    if (!mode) return setRefus('Choisissez votre mode de paiement.');
    if (!affectation) return setRefus('Choisissez à quoi servira votre don.');
    if (affectation === 'PROJECT' && !projetChoisi) return setRefus('Choisissez le projet à soutenir.');
    const page = pageDePaiement(payer, mode);
    if (!page) return setRefus('Ce moyen de paiement n’a pas encore sa page.');
    return navigate(page, {
      state: {
        brouillon: {
          mode,
          affectation,
          projetId: affectation === 'PROJECT' ? projetId : undefined,
          projetNom: affectation === 'PROJECT' ? projetChoisi?.nom : undefined,
          montant: null,
          devise,
          frequence: mensuel ? 'MONTHLY' : 'ONE_TIME',
          message: message.trim() || undefined,
        },
      },
    });
  }

  async function confirmer() {
    setEnvoi(true);
    setRefus('');
    try {
      const reponse = await envoyer({
        affectation,
        projetId: affectation === 'PROJECT' ? projetId : undefined,
        montant: String(valeur),
        devise,
        mode,
        frequence: mensuel ? 'MONTHLY' : 'ONE_TIME',
        message: message.trim() || undefined,
      });
      setResultat(reponse);
      onEnvoye?.();
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
    aller(0);
  }

  if (erreurChargement) return <p className="don-refus">{erreurChargement}</p>;
  if (!pret) return <p className="don-vide">Préparation de votre don…</p>;

  if (resultat) {
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
          <h1 className="don-merci__titre">Merci{prenom ? `, ${prenom}` : ''} !</h1>
          <p className="don-merci__texte">
            Votre promesse de don de <strong>{fmt.montant(don.montant, don.devise)}</strong>
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
              <span>3</span>L’équipe confirme la réception de votre don, qui commence à agir.
            </li>
          </ol>

          <div className="don-merci__actions">
            {lienSuivi ? (
              <Link className="don-cta don-cta--plein" to={lienSuivi.to}>
                {lienSuivi.libelle}
                <IconeFleche />
              </Link>
            ) : (
              <Link className="don-cta don-cta--plein" to={lienRetour.to}>
                {lienRetour.libelle}
                <IconeFleche />
              </Link>
            )}
            <button type="button" className="don-bouton-secondaire" onClick={recommencer}>
              Faire un autre don
            </button>
          </div>
        </section>
      </div>
    );
  }

  const projetEnTete = projetImpose ? projetChoisi : null;

  return (
    <div className="espace-donateur don-formulaire">
      <header className="don-entete">
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Faire un don
        </p>
        <h1 className="don-entete__titre">{titre}</h1>
        <p className="don-entete__accroche">
          {accroche ??
            'Aucun paiement en ligne : vous faites une promesse de don, et l’équipe HOPE vous accompagne pour le paiement.'}
        </p>
      </header>

      {projetEnTete && (
        <section className="don-projet-tete">
          <span className="don-projet-tete__image" aria-hidden="true">
            {projetEnTete.image ? <img src={urlMedia(projetEnTete.image)} alt="" /> : <IconeSoleil />}
          </span>
          <div className="don-projet-tete__texte">
            <span className="don-projet-tete__surtitre">Vous soutenez</span>
            <strong className="don-projet-tete__nom">{projetEnTete.nom}</strong>
            {(projetEnTete.lieu || projetEnTete.categorie) && (
              <span className="don-projet-tete__lieu">
                {[projetEnTete.categorie, projetEnTete.lieu].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          {avecFinances && projetEnTete.restant !== undefined && !projetEnTete.atteint && (
            <span className="don-projet-tete__reste">
              Il manque <strong>{fmt.montant(projetEnTete.restant, projetEnTete.devise)}</strong>
            </span>
          )}
        </section>
      )}

      {etapes.length > 1 && (
      <ol
        className="don-pas"
        style={{
          '--avance': `${(rang / Math.max(1, etapes.length - 1)) * 100}%`,
          '--pas': etapes.length,
        }}
      >
        {etapes.map((e, i) => (
          <li
            key={e.cle}
            className={`don-pas__pas${rang === i ? ' don-pas__pas--actif' : ''}${rang > i ? ' don-pas__pas--fait' : ''}`}
            aria-current={rang === i ? 'step' : undefined}
          >
            <span className="don-pas__rond">{rang > i ? <IconeCoche /> : i + 1}</span>
            <span className="don-pas__libelle">{e.libelle}</span>
          </li>
        ))}
      </ol>
      )}

      <div className="don-disposition">
        <div key={etape} className={`don-etape don-etape--${sens}`}>
          {etape === 'destination' && (
            <section aria-labelledby="don-etape-destination">
              <h2 className="don-etape__titre" id="don-etape-destination">
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
                  {etiquettesDestination?.HOPE && (
                    <span className="don-choix__etiquette">{etiquettesDestination.HOPE}</span>
                  )}
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
                  {etiquettesDestination?.PROJECT && (
                    <span className="don-choix__etiquette">{etiquettesDestination.PROJECT}</span>
                  )}
                  <span className="don-choix__icone" aria-hidden="true">
                    <IconeCoeur />
                  </span>
                  <strong>Un projet que je choisis</strong>
                  <span>Votre don va tout entier au projet choisi, et vous suivez son avancée.</span>
                </button>
              </div>

              {affectation === 'PROJECT' && (
                <div className="don-projets" role="group" aria-label="Projets à soutenir">
                  {projets.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={p.atteint}
                      aria-pressed={projetId === p.id}
                      className={`don-projet${projetId === p.id ? ' don-projet--actif' : ''}`}
                      style={{ '--rang': i }}
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
                        {avecFinances && p.taux !== undefined && (
                          <>
                            <span className="don-projet__rail" aria-hidden="true">
                              <span style={{ width: `${Math.min(100, Number(p.taux) || 0)}%` }} />
                            </span>
                            <span className="don-projet__reste">
                              {p.atteint
                                ? 'Objectif atteint, merci !'
                                : `Il manque ${fmt.montant(p.restant, p.devise)} · ${fmt.pourcent(p.taux)}`}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {payer && avecRythme && (
                <>
                  <h3 className="don-etape__sous-titre">À quel rythme ?</h3>
                  <div className="don-rythmes" role="group" aria-label="Fréquence">
                    {['ONE_TIME', 'MONTHLY'].map((cle) => (
                      <button
                        key={cle}
                        type="button"
                        aria-pressed={frequence === cle}
                        className={`don-rythme${frequence === cle ? ' don-rythme--actif' : ''}`}
                        onClick={() => setFrequence(cle)}
                      >
                        {cle === 'MONTHLY' ? <IconeCalendrierRenouvele /> : <IconeCoeur />}
                        <strong>{cle === 'MONTHLY' ? 'Chaque mois' : 'Une fois'}</strong>
                        <span>
                          {cle === 'MONTHLY'
                            ? 'Un soutien régulier, qui permet de prévoir.'
                            : 'Un don payé en une seule fois.'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {etape === 'montant' && (
            <section aria-labelledby="don-etape-montant">
              <h2 className="don-etape__titre" id="don-etape-montant">
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
                {(MONTANTS_PROPOSES[devise] ?? MONTANTS_PROPOSES.MGA).map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={valeur === m}
                    className={`don-montant${valeur === m ? ' don-montant--actif' : ''}`}
                    style={{ '--rang': i }}
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
                {avecFinances && projetChoisi && !projetChoisi.atteint && projetChoisi.restant !== undefined && projetChoisi.devise === devise
                  ? `Il manque encore ${fmt.montant(projetChoisi.restant, devise)} à « ${projetChoisi.nom} ».`
                  : 'Chaque montant compte : l’équipe HOPE vous dira comment il a été employé.'}
              </p>

              {avecRythme && (
                <>
                  <h3 className="don-etape__sous-titre">À quel rythme ?</h3>
                  <div className="don-rythmes" role="group" aria-label="Fréquence">
                    {['ONE_TIME', 'MONTHLY'].map((cle) => (
                      <button
                        key={cle}
                        type="button"
                        aria-pressed={frequence === cle}
                        className={`don-rythme${frequence === cle ? ' don-rythme--actif' : ''}`}
                        onClick={() => setFrequence(cle)}
                      >
                        {cle === 'MONTHLY' ? <IconeCalendrierRenouvele /> : <IconeCoeur />}
                        <strong>{cle === 'MONTHLY' ? 'Chaque mois' : 'Une fois'}</strong>
                        <span>
                          {cle === 'MONTHLY'
                            ? 'Un soutien régulier, qui permet de prévoir.'
                            : 'Un don payé en une seule fois.'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {etape === 'paiement' && (
            <section aria-labelledby="don-etape-paiement">
              <h2 className="don-etape__titre" id="don-etape-paiement">
                Comment paierez-vous ?
              </h2>
              <div className="don-modes" role="group" aria-label="Mode de paiement">
                {modes.map((m, i) => (
                  <button
                    key={m.cle}
                    type="button"
                    aria-pressed={mode === m.cle}
                    className={`don-mode${mode === m.cle ? ' don-mode--actif' : ''}`}
                    style={{ '--rang': i }}
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
                {modeChoisi ? modeChoisi.description : 'Choisissez le moyen qui vous convient : l’équipe s’y adapte.'}
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

          {etape === 'confirmation' && (
            <section aria-labelledby="don-etape-confirmation">
              <h2 className="don-etape__titre" id="don-etape-confirmation">
                Vérifiez, puis confirmez
              </h2>
              <div className="don-recap">
                <p className="don-recap__montant">
                  {fmt.montant(valeur, devise)}
                  {mensuel && <span> / mois</span>}
                </p>
                <dl className="don-recap__lignes">
                  <div>
                    <dt>Pour</dt>
                    <dd>{projetChoisi ? projetChoisi.nom : 'Là où le besoin est le plus grand'}</dd>
                  </div>
                  <div>
                    <dt>Rythme</dt>
                    <dd>{mensuel ? 'Chaque mois' : 'Une fois'}</dd>
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
            {rang > 0 ? (
              <button type="button" className="don-bouton-secondaire" onClick={() => aller(rang - 1)} disabled={envoi}>
                <IconeFlecheGauche />
                Retour
              </button>
            ) : (
              <Link className="don-bouton-secondaire" to={lienRetour.to}>
                <IconeFlecheGauche />
                Annuler
              </Link>
            )}
            {payer && derniere ? (
              <button type="button" className="don-cta don-cta--plein" onClick={versLaPage}>
                Continuer vers le paiement
                <IconeFleche />
              </button>
            ) : etape !== 'confirmation' ? (
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

        <aside className="don-resume" aria-label="Votre don">
          <p className="don-resume__titre">Votre don</p>
          {payer ? (
            <p className="don-resume__montant don-resume__montant--suite">Le montant, à l’étape suivante</p>
          ) : (
            <p className="don-resume__montant">
              {valeur >= 1 ? fmt.montant(valeur, devise) : '—'}
              {valeur >= 1 && mensuel && <span> / mois</span>}
            </p>
          )}
          <ul className="don-resume__lignes">
            <li>
              <span>Pour</span>
              <strong>
                {affectation === 'HOPE' ? 'Le besoin le plus urgent' : projetChoisi?.nom ?? 'À choisir'}
              </strong>
            </li>
            <li>
              <span>Rythme</span>
              <strong>{mensuel ? 'Chaque mois' : 'Une fois'}</strong>
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
