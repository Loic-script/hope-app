import { InvalidStatusTransitionError } from './errors.js';

/**
 * Petite machine a etats generique.
 *
 * Elle sert a interdire les transitions de statut incoherentes (regle metier
 * n.7 : une transaction conserve son historique logique). Exemple concret :
 * FAILED -> SUCCESS est interdit, car une transaction echouee ne peut pas
 * "devenir" reussie ; il faut creer une nouvelle tentative de paiement.
 */
export interface StateMachine<TStatus extends string> {
  readonly entity: string;
  /** Statuts atteignables depuis `from`. */
  allowedFrom(from: TStatus): readonly TStatus[];
  /** true si la transition est autorisee. */
  can(from: TStatus, to: TStatus): boolean;
  /** true si aucune transition n'est possible depuis ce statut. */
  isFinal(status: TStatus): boolean;
  /** Leve InvalidStatusTransitionError si la transition est interdite. */
  assert(from: TStatus, to: TStatus): void;
}

export function createStateMachine<TStatus extends string>(
  entity: string,
  transitions: Readonly<Record<TStatus, readonly TStatus[]>>,
): StateMachine<TStatus> {
  const allowedFrom = (from: TStatus): readonly TStatus[] => transitions[from] ?? [];

  const can = (from: TStatus, to: TStatus): boolean => allowedFrom(from).includes(to);

  return {
    entity,
    allowedFrom,
    can,
    isFinal: (status: TStatus) => allowedFrom(status).length === 0,
    assert(from: TStatus, to: TStatus): void {
      if (!can(from, to)) {
        throw new InvalidStatusTransitionError(entity, from, to, allowedFrom(from));
      }
    },
  };
}
