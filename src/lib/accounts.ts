import { Account } from '../types';

type Tree = Pick<Account, 'id' | 'name' | 'parent_id' | 'is_active'>;

/** Main accounts in their own order, each followed by its sub-accounts. */
export function treeOrder<T extends Tree>(accounts: T[]): T[] {
  const ids = new Set(accounts.map(a => a.id));
  const out: T[] = [];
  for (const a of accounts) {
    if (a.parent_id && ids.has(a.parent_id)) continue;
    out.push(a, ...accounts.filter(c => c.parent_id === a.id));
  }
  return out;
}

/** "Girokonto › Holiday pot" for sub-accounts, the name otherwise. */
export function accountLabel(a: Tree, accounts: Tree[]): string {
  const parent = a.parent_id ? accounts.find(p => p.id === a.parent_id) : undefined;
  return parent ? `${parent.name} › ${a.name}` : a.name;
}

/** Accounts to offer in a picker: active ones, plus any in `keep` (e.g. the one already chosen). */
export function pickable<T extends Tree>(accounts: T[], keep: (string | undefined)[] = []): T[] {
  return treeOrder(accounts).filter(a => a.is_active !== false || keep.includes(a.id));
}
