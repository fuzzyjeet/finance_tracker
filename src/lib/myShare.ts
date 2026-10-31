import { Transaction } from '../types';

/** My part of an expense after refunds and the share for others (same rule as budgets). */
export function myShare(txn: Transaction) {
  if (txn.type !== 'expense' || txn.amount <= 0) return txn.amount;
  const refunded = txn.refunded_amount ?? 0;
  const ownRatio = Math.max(0, 1 - (txn.for_others ?? 0) / txn.amount);
  return Math.max(0, txn.amount - refunded) * ownRatio;
}
