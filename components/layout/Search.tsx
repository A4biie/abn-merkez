import { createContext, useContext, useState, type ReactNode } from 'react';

// Bilgisayar başlık şeridindeki "Görev ya da fikir ara…" kutusu. Görevler ve Fikir Defteri
// listeleri bu metne göre süzülür.

const SearchContext = createContext<{ query: string; setQuery: (q: string) => void }>({
  query: '',
  setQuery: () => {},
});

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  return useContext(SearchContext);
}

/** Türkçe büyük/küçük harf duyarsız arama. */
export function matches(text: string, query: string) {
  const q = query.trim().toLocaleLowerCase('tr');
  return !q || text.toLocaleLowerCase('tr').includes(q);
}
