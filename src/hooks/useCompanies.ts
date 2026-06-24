import { useEffect, useState } from 'react';
import { getCompaniesSetting } from '@/lib/db';
import { YL_COMPANIES } from '@/types';

let cache: string[] | null = null;
const subs = new Set<(c: string[]) => void>();

async function loadOnce(): Promise<string[]> {
  if (cache) return cache;
  const saved = await getCompaniesSetting().catch(() => null);
  cache = saved && saved.length > 0 ? saved : [...YL_COMPANIES];
  return cache;
}

export function useCompanies(): string[] {
  const [companies, setCompanies] = useState<string[]>(cache ?? [...YL_COMPANIES]);

  useEffect(() => {
    const sub = (c: string[]) => setCompanies(c);
    subs.add(sub);
    loadOnce().then(c => setCompanies(c));
    return () => { subs.delete(sub); };
  }, []);

  return companies;
}

export function refreshCompaniesCache(list: string[]): void {
  cache = list;
  subs.forEach(s => s(list));
}
