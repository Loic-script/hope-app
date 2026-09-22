import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { IconeCoche, IconeMainsCoeur, IconeSoleil } from '../../components/HopeIcons.jsx';
import { VisuelPaiement } from '../../components/VisuelsPaiement.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import { tousLesFuseaux } from '../../utils/fuseaux.js';
import { PAYS } from '../../utils/pays.js';

/** Au-dela, la photo est refusee avant meme l'envoi. */
const TAILLE_MAX = 8 * 1024 * 1024;

/**
 * Un bloc du profil : son titre, ses champs, son bouton, et ce qui s'est
 * passe au dernier enregistrement -- l'erreur, ou la coche qui confirme.
 */
function Bloc({ titre, accroche, rang, envoi, succes, refus, onEnregistrer, children }) {
  return (
    <form
      className="don-carte don-profil__bloc"
      style={{ '--rang': rang }}
      onSubmit={(e) => {
        e.preventDefault();
        onEnregistrer();
      }}
      noValidate
    >
      <div className="don-carte__entete">
        <div>
          <h2 className="don-carte__titre">{titre}</h2>
          {accroche && <p className="don-carte__accroche">{accroche}</p>}
        </div>
      </div>
      <div className="don-profil__champs">{children}</div>
      {refus && (
        <p className="don-refus" role="alert">
          {refus}
        </p>
      )}
      <div className="don-profil__pied">
        {succes && (
          <span className="don-profil__succes" role="status">
            <IconeCoche />
            {succes}
          </span>
        )}
        <button type="submit" className="don-cta don-cta--plein don-cta--petit" disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

/** Un champ de saisie, son libelle au-dessus, son erreur dessous. */
function Champ({ id, libelle, erreur, large = false, children }) {
  return (
    <label className={`don-champ${large ? ' don-champ--large' : ''}${erreur ? ' don-champ--erreur' : ''}`} htmlFor={id}>
      <span className="don-champ__libelle">{libelle}</span>
      {children}
      {erreur && <span className="don-champ__erreur">{erreur}</span>}
    </label>
  );
}

/** L'etat d'un bloc : envoi, succes, refus et erreurs par champ. */
function useEnvoi() {
  const [etat, setEtat] = useState({ envoi: false, succes: '', refus: '', details: {} });
  async function envoyer(action, succes) {
    setEtat({ envoi: true, succes: '', refus: '', details: {} });
    try {
      await action();
      setEtat({ envoi: false, succes, refus: '', details: {} });
    } catch (echec) {
      setEtat({
        envoi: false,
        succes: '',
        refus: messageErreur(echec, 'L’enregistrement a échoué.'),
        details: echec?.response?.data?.details ?? echec?.response?.data?.errors ?? {},
      });
    }
  }
  return [etat, envoyer];
}

/**
 * Mon profil : la photo, les informations, le profil de donateur et les
 * preferences de don.
 *
 * Les trois blocs reprennent le parcours d'accueil : memes champs, memes
 * controles cote serveur (etapes 1 a 5). Chaque bloc s'enregistre seul,
 * et confirme d'une coche.
 *
 * La photo se televerse d'un clic sur l'avatar ; elle apparait aussitot
 * dans le bandeau de l'espace et dans la messagerie.
 */
export default function Profil() {
  const { donateur, rafraichirDonateur } = useOutletContext();
  const { donnees: profil, recharger } = useChargement(() => service.recupererProfil(), []);
  const { donnees: projetsBruts } = useChargement(() => service.listerProjets(), []);
  const { donnees: dons } = useChargement(() => service.mesDons(), []);
  const fuseaux = useMemo(() => tousLesFuseaux(), []);

  const [info, setInfo] = useState(null);
  const [pro, setPro] = useState(null);
  const [pref, setPref] = useState(null);
  const [etatInfo, envoyerInfo] = useEnvoi();
  const [etatPro, envoyerPro] = useEnvoi();
  const [etatPref, envoyerPref] = useEnvoi();

  const fichier = useRef(null);
  const [photo, setPhoto] = useState({ envoi: false, refus: '' });

  // Les champs partent de la fiche, une fois arrivee.
  useEffect(() => {
    if (!profil || info) return;
    setInfo({ ...profil.informations });
    setPro({ ...profil.profil });
    setPref({
      affectation: profil.don?.affectation || 'HOPE',
      projetId: profil.don?.projetId ?? '',
      mode: profil.paiement?.mode || '',
      frequence: profil.frequence?.valeur || 'ONE_TIME',
    });
  }, [profil, info]);

  if (!profil || !info) return <p className="don-vide">Chargement de votre profil…</p>;

  const options = profil.options ?? {};
  const typeChoisi = (options.types ?? []).find((t) => t.cle === pro.type);
  const ouverts = (projetsBruts?.items ?? []).filter((p) => !p.atteint);
  const photoUrl = donateur?.photoUrl ?? profil.compte?.photoUrl;
  const nom = `${donateur?.prenom ?? ''} ${donateur?.nom ?? ''}`.trim() || 'Donateur';

  async function choisirPhoto(e) {
    const choisi = e.target.files?.[0];
    e.target.value = '';
    if (!choisi) return;
    if (!/^image\/(jpeg|png|webp)$/.test(choisi.type)) {
      setPhoto({ envoi: false, refus: 'Choisissez une image JPG, PNG ou WebP.' });
      return;
    }
    if (choisi.size > TAILLE_MAX) {
      setPhoto({ envoi: false, refus: 'Cette image dépasse 8 Mo.' });
      return;
    }
    setPhoto({ envoi: true, refus: '' });
    try {
      const { url } = await service.televerserPhoto(choisi);
      await service.changerPhoto(url);
      await rafraichirDonateur?.();
      setPhoto({ envoi: false, refus: '' });
    } catch (echec) {
      setPhoto({ envoi: false, refus: messageErreur(echec, 'La photo n’a pas pu être enregistrée.') });
    }
  }

  async function retirerPhoto() {
    setPhoto({ envoi: true, refus: '' });
    try {
      await service.changerPhoto(null);
      await rafraichirDonateur?.();
      setPhoto({ envoi: false, refus: '' });
    } catch (echec) {
      setPhoto({ envoi: false, refus: messageErreur(echec, 'La photo n’a pas pu être retirée.') });
    }
  }

  const champInfo = (cle) => (e) => setInfo((v) => ({ ...v, [cle]: e.target.value }));
  const champPro = (cle) => (e) => setPro((v) => ({ ...v, [cle]: e.target.value }));

  return (
    <div className="espace-donateur don-profil">
      {/* ---------- La carte d'identite ---------- */}
      <section className="don-identite">
        <span className="don-identite__halo" aria-hidden="true" />
        <div className="don-identite__avatar-zone">
          <button
            type="button"
            className={`don-avatar${photo.envoi ? ' don-avatar--envoi' : ''}`}
            onClick={() => fichier.current?.click()}
            disabled={photo.envoi}
            aria-label={photoUrl ? 'Changer ma photo' : 'Ajouter une photo'}
          >
            {photoUrl ? (
              <img src={urlMedia(photoUrl)} alt="" />
            ) : (
              <span className="don-avatar__initiales">{fmt.initiales(nom)}</span>
            )}
            <span className="don-avatar__voile" aria-hidden="true">
              {photo.envoi ? 'Envoi…' : photoUrl ? 'Changer' : 'Ajouter'}
            </span>
          </button>
          <input
            ref={fichier}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={choisirPhoto}
            tabIndex={-1}
          />
          {photoUrl && !photo.envoi && (
            <button type="button" className="don-lien don-identite__retirer" onClick={retirerPhoto}>
              Retirer la photo
            </button>
          )}
        </div>

        <div className="don-identite__texte">
          <p className="surtitre surtitre--clair">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            Mon profil
          </p>
          <h1 className="don-identite__nom">{nom}</h1>
          <p className="don-identite__email">{profil.compte?.email}</p>
          <p className="don-identite__depuis">
            Donateur depuis le {fmt.date(profil.compte?.membreDepuis ?? donateur?.creeLe)}
          </p>
          {photo.refus && (
            <p className="don-identite__refus" role="alert">
              {photo.refus}
            </p>
          )}
        </div>

        <ul className="don-identite__chiffres">
          <li>
            <IconeMainsCoeur />
            <strong>{fmt.nombre(dons?.synthese.nombreRecus ?? 0)}</strong>
            <span>dons reçus</span>
          </li>
          <li>
            <IconeSoleil />
            <strong>{fmt.nombre(dons?.synthese.projetsSoutenus ?? 0)}</strong>
            <span>projets soutenus</span>
          </li>
        </ul>
      </section>

      <div className="don-profil__blocs">
        {/* ---------- Informations ---------- */}
        <Bloc
          titre="Mes informations"
          accroche="Pour vous écrire, et pour vos reçus."
          rang={0}
          {...etatInfo}
          onEnregistrer={() =>
            envoyerInfo(async () => {
              await service.enregistrerEtape1({ ...info, telephone: String(info.telephone).replace(/\s/g, '') });
              await rafraichirDonateur?.();
            }, 'Informations enregistrées')
          }
        >
          <Champ id="don-prenom" libelle="Prénom" erreur={etatInfo.details.prenom}>
            <input id="don-prenom" value={info.prenom} onChange={champInfo('prenom')} autoComplete="given-name" />
          </Champ>
          <Champ id="don-nom" libelle="Nom" erreur={etatInfo.details.nom}>
            <input id="don-nom" value={info.nom} onChange={champInfo('nom')} autoComplete="family-name" />
          </Champ>
          <Champ id="don-telephone" libelle="Téléphone (format international)" erreur={etatInfo.details.telephone}>
            <input
              id="don-telephone"
              value={info.telephone}
              onChange={champInfo('telephone')}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+261 34 00 000 00"
            />
          </Champ>
          <Champ id="don-profession" libelle="Profession (facultatif)" erreur={etatInfo.details.profession}>
            <input id="don-profession" value={info.profession} onChange={champInfo('profession')} />
          </Champ>
          <Champ id="don-adresse" libelle="Adresse" erreur={etatInfo.details.adresse} large>
            <input id="don-adresse" value={info.adresse} onChange={champInfo('adresse')} autoComplete="street-address" />
          </Champ>
          <Champ id="don-ville" libelle="Ville" erreur={etatInfo.details.ville}>
            <input id="don-ville" value={info.ville} onChange={champInfo('ville')} autoComplete="address-level2" />
          </Champ>
          <Champ id="don-pays" libelle="Pays" erreur={etatInfo.details.pays}>
            <select id="don-pays" value={info.pays} onChange={champInfo('pays')}>
              {PAYS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nom}
                </option>
              ))}
            </select>
          </Champ>
        </Bloc>

        {/* ---------- Profil de donateur ---------- */}
        <Bloc
          titre="Mon profil de donateur"
          accroche="Qui donne, et comment HOPE vous écrit."
          rang={1}
          {...etatPro}
          onEnregistrer={() => envoyerPro(() => service.enregistrerEtape2(pro), 'Profil enregistré')}
        >
          <div className="don-champ don-champ--large" role="group" aria-label="Vous donnez en tant que">
            <span className="don-champ__libelle">Vous donnez en tant que</span>
            <div className="don-pastilles">
              {(options.types ?? []).map((t) => (
                <button
                  key={t.cle}
                  type="button"
                  aria-pressed={pro.type === t.cle}
                  className={`don-pastille${pro.type === t.cle ? ' don-pastille--actif' : ''}`}
                  onClick={() => setPro((v) => ({ ...v, type: t.cle }))}
                >
                  {t.libelle}
                </button>
              ))}
            </div>
            {etatPro.details.type && <span className="don-champ__erreur">{etatPro.details.type}</span>}
          </div>
          {typeChoisi?.structure && (
            <>
              <Champ id="don-structure" libelle="Nom de la structure" erreur={etatPro.details.nomStructure}>
                <input id="don-structure" value={pro.nomStructure} onChange={champPro('nomStructure')} />
              </Champ>
              <Champ id="don-site" libelle="Site web (facultatif)" erreur={etatPro.details.siteWeb}>
                <input id="don-site" value={pro.siteWeb} onChange={champPro('siteWeb')} inputMode="url" />
              </Champ>
            </>
          )}
          <Champ id="don-devise" libelle="Devise de vos dons" erreur={etatPro.details.devise}>
            <select id="don-devise" value={pro.devise} onChange={champPro('devise')}>
              {(options.devises ?? []).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.libelle}
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="don-langue" libelle="Langue" erreur={etatPro.details.langue}>
            <select id="don-langue" value={pro.langue} onChange={champPro('langue')}>
              {(options.langues ?? []).map((l) => (
                <option key={l.cle} value={l.cle}>
                  {l.libelle}
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="don-fuseau" libelle="Fuseau horaire" erreur={etatPro.details.fuseau} large>
            <select id="don-fuseau" value={pro.fuseau} onChange={champPro('fuseau')}>
              {fuseaux.map((f) => (
                <option key={f.nom} value={f.nom}>
                  {f.libelle}
                </option>
              ))}
            </select>
          </Champ>
        </Bloc>

        {/* ---------- Preferences de don ---------- */}
        <Bloc
          titre="Mes préférences de don"
          accroche="Elles pré-remplissent « Faire un don » ; vous pouvez toujours les changer au moment de donner."
          rang={2}
          {...etatPref}
          onEnregistrer={() =>
            envoyerPref(async () => {
              await service.enregistrerEtape3({
                affectation: pref.affectation,
                projetId: pref.affectation === 'PROJECT' ? Number(pref.projetId) || null : null,
              });
              await service.enregistrerEtape4({ mode: pref.mode });
              await service.enregistrerEtape5({ frequence: pref.frequence });
              recharger();
            }, 'Préférences enregistrées')
          }
        >
          <div className="don-champ don-champ--large" role="group" aria-label="Destination préférée">
            <span className="don-champ__libelle">Destination préférée</span>
            <div className="don-pastilles">
              <button
                type="button"
                aria-pressed={pref.affectation === 'HOPE'}
                className={`don-pastille${pref.affectation === 'HOPE' ? ' don-pastille--actif' : ''}`}
                onClick={() => setPref((v) => ({ ...v, affectation: 'HOPE', projetId: '' }))}
              >
                Le besoin le plus urgent
              </button>
              <button
                type="button"
                aria-pressed={pref.affectation === 'PROJECT'}
                className={`don-pastille${pref.affectation === 'PROJECT' ? ' don-pastille--actif' : ''}`}
                onClick={() => setPref((v) => ({ ...v, affectation: 'PROJECT' }))}
              >
                Un projet précis
              </button>
            </div>
          </div>
          {pref.affectation === 'PROJECT' && (
            <Champ id="don-projet-pref" libelle="Projet" erreur={etatPref.details.projetId} large>
              <select
                id="don-projet-pref"
                value={pref.projetId ?? ''}
                onChange={(e) => setPref((v) => ({ ...v, projetId: e.target.value }))}
              >
                <option value="">Choisir un projet…</option>
                {ouverts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </Champ>
          )}
          <div className="don-champ don-champ--large" role="group" aria-label="Moyen de paiement préféré">
            <span className="don-champ__libelle">Moyen de paiement préféré</span>
            <div className="don-modes don-modes--compact">
              {(options.modesPaiement ?? []).map((m) => (
                <button
                  key={m.cle}
                  type="button"
                  aria-pressed={pref.mode === m.cle}
                  className={`don-mode${pref.mode === m.cle ? ' don-mode--actif' : ''}`}
                  onClick={() => setPref((v) => ({ ...v, mode: m.cle }))}
                >
                  <span className="don-mode__visuel" aria-hidden="true">
                    <VisuelPaiement cle={m.cle} />
                  </span>
                  <span className="don-mode__nom">{m.libelle}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="don-champ don-champ--large" role="group" aria-label="Rythme préféré">
            <span className="don-champ__libelle">Rythme préféré</span>
            <div className="don-pastilles">
              {(options.frequences ?? []).map((f) => (
                <button
                  key={f.cle}
                  type="button"
                  aria-pressed={pref.frequence === f.cle}
                  className={`don-pastille${pref.frequence === f.cle ? ' don-pastille--actif' : ''}`}
                  onClick={() => setPref((v) => ({ ...v, frequence: f.cle }))}
                >
                  {f.libelle}
                </button>
              ))}
            </div>
          </div>
        </Bloc>
      </div>
    </div>
  );
}
