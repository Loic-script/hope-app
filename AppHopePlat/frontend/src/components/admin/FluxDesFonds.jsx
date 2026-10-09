import * as fmt from '../../utils/format.js';

export default function FluxDesFonds({ summary, compact = false }) {
  if (!summary) return null;

  const affecte = Number(summary.designatedTotal ?? 0);
  const hope = Number(summary.hopeTotal ?? 0);
  const investi = Number(summary.investedTotal ?? 0);
  const disponible = Number(summary.availableTotal ?? 0);
  const total = affecte + hope;

  if (total <= 0) {
    return (
      <div className="flux">
        <div className="flux__entete">
          <span className="flux__intitule">Dons reçus</span>
          <span className="flux__total">{fmt.montant(0)}</span>
        </div>
        <div className="flux__barre">
          <div className="flux__segment flux__segment--vide">
            Aucun don enregistré pour le moment
          </div>
        </div>
      </div>
    );
  }

  const partAffecte = Math.max(affecte / total, affecte > 0 ? 0.16 : 0);
  const partHope = Math.max(hope / total, hope > 0 ? 0.16 : 0);

  const partInvesti = hope > 0 ? Math.max(investi / hope, investi > 0 ? 0.2 : 0) : 0;
  const partDisponible = hope > 0 ? Math.max(disponible / hope, disponible > 0 ? 0.2 : 0) : 0;

  return (
    <div className="flux">
      <div className="flux__entete">
        <span className="flux__intitule">Dons reçus</span>
        <span className="flux__total">{fmt.montant(total)}</span>
      </div>

      <div className="flux__barre">
        {affecte > 0 && (
          <div className="flux__segment flux__segment--affecte" style={{ flexGrow: partAffecte }}>
            <span className="flux__etiquette">
              Dons affectés · {fmt.pourcent(summary.designatedShare)}
            </span>
            <span className="flux__montant">{fmt.montant(affecte)}</span>
          </div>
        )}
        {hope > 0 && (
          <div className="flux__segment flux__segment--hope" style={{ flexGrow: partHope }}>
            <span className="flux__etiquette">
              Fonds HOPE · {fmt.pourcent(summary.hopeShare)}
            </span>
            <span className="flux__montant">{fmt.montant(hope)}</span>
          </div>
        )}
      </div>

      {!compact && (
        <>
          <div className="flux__descente">
            {affecte > 0 && (
              <div className="flux__branche" style={{ flexGrow: partAffecte }}>
                <div className="flux__fleche" />
                <p className="flux__destination">
                  Versés directement aux projets choisis par les donateurs.
                </p>
              </div>
            )}
            {hope > 0 && (
              <div className="flux__branche" style={{ flexGrow: partHope }}>
                <div className="flux__fleche" />
                <p className="flux__destination">
                  Répartis par HOPE, projet par projet, avec une justification.
                </p>
              </div>
            )}
          </div>

          {hope > 0 && (
            <div className="flux__descente">
              {affecte > 0 && <div className="flux__branche" style={{ flexGrow: partAffecte }} />}
              <div className="flux__branche" style={{ flexGrow: partHope, padding: 0 }}>
                <div className="flux__sous-barre">
                  {investi > 0 && (
                    <div
                      className="flux__sous-segment flux__sous-segment--investi"
                      style={{ flexGrow: partInvesti }}
                    >
                      <span className="flux__sous-etiquette">Déjà investi</span>
                      <span className="flux__sous-montant">{fmt.montant(investi)}</span>
                    </div>
                  )}
                  {disponible > 0 && (
                    <div
                      className="flux__sous-segment flux__sous-segment--disponible"
                      style={{ flexGrow: partDisponible }}
                    >
                      <span className="flux__sous-etiquette">Disponible</span>
                      <span className="flux__sous-montant">{fmt.montant(disponible)}</span>
                    </div>
                  )}
                  {investi === 0 && disponible === 0 && (
                    <div className="flux__segment flux__segment--vide">Fonds épuisé</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
