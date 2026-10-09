import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { BeneficiaireModale, DepenseModale } from '../../components/admin/modales.jsx';
import Visage from '../../components/admin/Visage.jsx';
import { Alerte, Badge, Chargement, EntetePage, EtatVide, Panneau, Tableau } from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as beneficiaryService from '../../services/beneficiary.service.js';
import * as catalogService from '../../services/catalog.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

const STATUTS_RATTACHEMENT = { ACTIVE: 'En cours', COMPLETED: 'Terminé', WITHDRAWN: 'Sorti' };

const enCentimes = (valeur) => Math.round(Number(valeur ?? 0) * 100);

export default function BeneficiairePage() {
  const { id } = useParams();
  const [edition, setEdition] = useState(false);
  const [depense, setDepense] = useState(false);

  const { donnees: personne, chargement, erreur, recharger } = useChargement(() => beneficiaryService.recuperer(id), [id]);
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const { donnees: enCours } = useChargement(() => projectService.lister({ status: 'IN_PROGRESS', pageSize: 200 }), []);

  const depenses = useMemo(() => personne?.expenses ?? [], [personne]);
  const valides = depenses.filter((d) => d.status !== 'CANCELLED');
  const devises = [...new Set(valides.map((d) => d.currency ?? 'MGA'))];
  const total = valides.reduce((s, d) => s + enCentimes(d.amount), 0) / 100;
  const sesProjets = new Set((personne?.projects ?? []).map((p) => p.projectId));
  const projetsPourDepense = (enCours?.items ?? []).filter((p) => sesProjets.has(p.id));

  const parProjet = useMemo(() => {
    const cumul = new Map();
    for (const d of valides) cumul.set(d.projectName, (cumul.get(d.projectName) ?? 0) + enCentimes(d.amount));
    return [...cumul.entries()].sort((a, b) => b[1] - a[1]);
  }, [valides]);

  if (chargement && !personne) return <Chargement texte="Chargement du profil…" />;
  if (erreur && !personne) return <Alerte>{erreur}</Alerte>;
  if (!personne) return null;

  const libelles = catalogue?.labels ?? {};
  const derniere = valides[0];

  return (
    <>
      <EntetePage
        fil={[{ label: 'Bénéficiaires', to: '/admin/beneficiaries' }, { label: personne.fullName }]}
        titre={personne.fullName}
        accroche="Profil confidentiel : il reste interne à l’espace administrateur."
        actions={
          <>
            <button type="button" className="btn btn--neutre" onClick={() => setEdition(true)}>
              Modifier
            </button>
            <button
              type="button"
              className="btn btn--principal"
              onClick={() => setDepense(true)}
              disabled={projetsPourDepense.length === 0}
              title={projetsPourDepense.length === 0 ? 'Rattachez d’abord la personne à un projet en cours' : undefined}
            >
              <IconePlus />
              Ajouter une dépense
            </button>
          </>
        }
      />

      <section className="profil-benef">
        <div className="profil-benef__identite">
          <Visage src={personne.photoUrl} nom={personne.fullName} taille="grand" />
          <div className="profil-benef__texte">
            <div className="profil-benef__pastilles">
              <Badge valeur={personne.beneficiaryType} libelles={libelles.beneficiaryType} />
              <Badge valeur={personne.status} libelles={libelles.beneficiaryStatus} />
            </div>
            <dl className="profil-benef__faits">
              <div>
                <dt>Âge</dt>
                <dd>{personne.age === null ? '—' : `${personne.age} ans`}</dd>
              </div>
              <div>
                <dt>Genre</dt>
                <dd>{personne.gender ? (libelles.gender?.[personne.gender] ?? personne.gender) : '—'}</dd>
              </div>
              <div>
                <dt>Lieu</dt>
                <dd>{[personne.city, personne.country].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Suivi depuis</dt>
                <dd>{fmt.date(personne.createdAt)}</dd>
              </div>
            </dl>
            {personne.notes && <p className="profil-benef__notes">{personne.notes}</p>}
          </div>
        </div>

        <div className="profil-benef__chiffres">
          <div className="profil-benef__chiffre profil-benef__chiffre--violet" style={{ '--rang': 0 }}>
            <span>Dépensé pour {personne.firstName}</span>
            <strong>{devises.length > 1 ? 'Plusieurs devises' : fmt.montant(total, devises[0] ?? 'MGA')}</strong>
          </div>
          <div className="profil-benef__chiffre profil-benef__chiffre--bleu" style={{ '--rang': 1 }}>
            <span>Dépenses</span>
            <strong>{fmt.nombre(valides.length)}</strong>
          </div>
          <div className="profil-benef__chiffre profil-benef__chiffre--vert" style={{ '--rang': 2 }}>
            <span>Projets</span>
            <strong>{fmt.nombre(personne.projects?.length ?? 0)}</strong>
          </div>
          <div className="profil-benef__chiffre profil-benef__chiffre--orange" style={{ '--rang': 3 }}>
            <span>Dernière dépense</span>
            <strong>{derniere ? fmt.date(derniere.expenseDate) : '—'}</strong>
          </div>
        </div>
      </section>

      <div className="profil-benef__colonnes">
        <Panneau titre={`Dépenses pour ${personne.firstName}`} sousTitre="L’argent des projets dépensé au nom de cette personne." serre>
          {parProjet.length > 1 && (
            <ul className="profil-benef__repartition" aria-label="Répartition par projet">
              {parProjet.map(([nom, centimes]) => (
                <li key={nom}>
                  <span>{nom}</span>
                  <span className="profil-benef__barre" aria-hidden="true">
                    <span style={{ width: `${(centimes / parProjet[0][1]) * 100}%` }} />
                  </span>
                  <strong>{fmt.montant(centimes / 100)}</strong>
                </li>
              ))}
            </ul>
          )}
          <Tableau
            empilable
            lignes={depenses}
            cleLigne={(d) => d.id}
            classeLigne={(d) => (d.status === 'CANCELLED' ? 'ligne--annulee' : '')}
            colonnes={[
              { cle: 'date', titre: 'Date', rendu: (d) => fmt.date(d.expenseDate) },
              {
                cle: 'projet',
                titre: 'Projet',
                rendu: (d) => (
                  <Link className="table__lien" to={`/admin/projects/${d.projectId}?onglet=depenses`}>
                    {d.projectName}
                  </Link>
                ),
              },
              {
                cle: 'description',
                titre: 'Dépense',
                rendu: (d) => (
                  <div>
                    <div>{d.description}</div>
                    <div className="table__secondaire">
                      {[d.category, d.supplier].filter(Boolean).join(' · ') || 'Non classée'}
                      {d.status === 'CANCELLED' && ' · annulée'}
                    </div>
                  </div>
                ),
              },
              {
                cle: 'justificatifs',
                titre: 'Justificatifs',
                aligne: 'centre',
                rendu: (d) =>
                  Number(d.documentsCount) > 0 ? (
                    <span className="depenses-budget__justifie">{d.documentsCount}</span>
                  ) : (
                    <span className="depenses-budget__manquant">À joindre</span>
                  ),
              },
              { cle: 'montant', titre: 'Montant', aligne: 'droite', rendu: (d) => <strong>{fmt.montant(d.amount, d.currency)}</strong> },
            ]}
            vide={
              <EtatVide
                titre="Aucune dépense pour l’instant"
                texte={
                  projetsPourDepense.length > 0
                    ? 'Enregistrez l’argent dépensé pour cette personne : écolage, soins, matériel remis…'
                    : 'Rattachez la personne à un projet en cours pour enregistrer une dépense à son nom.'
                }
                action={
                  projetsPourDepense.length > 0 && (
                    <button type="button" className="btn btn--principal" onClick={() => setDepense(true)}>
                      <IconePlus />
                      Ajouter une dépense
                    </button>
                  )
                }
              />
            }
          />
        </Panneau>

        <Panneau titre="Projets" sousTitre="Ce qui accompagne la personne." serre>
          {(personne.projects ?? []).length === 0 ? (
            <p className="profil-benef__vide">
              Aucun projet. Rattachez la personne depuis la fiche d’un projet, onglet Bénéficiaires.
            </p>
          ) : (
            <ul className="profil-benef__projets">
              {personne.projects.map((p) => (
                <li key={p.id}>
                  <Link className="table__lien" to={`/admin/projects/${p.projectId}`}>
                    {p.projectName}
                  </Link>
                  <span className="table__secondaire">
                    {STATUTS_RATTACHEMENT[p.status] ?? p.status} · depuis le {fmt.date(p.joinedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      </div>

      <BeneficiaireModale
        ouverte={edition}
        beneficiaire={personne}
        libelles={libelles}
        onFermer={() => setEdition(false)}
        onEnregistre={() => {
          setEdition(false);
          recharger();
        }}
      />
      <DepenseModale
        ouverte={depense}
        projets={projetsPourDepense}
        categories={catalogue?.expenseCategories ?? []}
        beneficiaire={personne}
        onFermer={() => setDepense(false)}
        onEnregistre={() => {
          setDepense(false);
          recharger();
        }}
      />
    </>
  );
}
