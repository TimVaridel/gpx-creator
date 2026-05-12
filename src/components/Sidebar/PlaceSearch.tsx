import { useState, useRef, useEffect, useCallback } from 'react';
import { searchPlaces, type PlaceResult } from '../../services/geocoding';

interface PlaceSearchProps {
  placeholder?: string;
  onSelect: (result: PlaceResult) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

const PlaceSearch = ({
  placeholder = 'Rechercher un lieu…',
  onSelect,
  onCancel,
  autoFocus = true,
}: PlaceSearchProps) => {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<PlaceResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const found = await searchPlaces(value);
      setResults(found);
      setLoading(false);
    }, 500);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 border border-blue-400 rounded-lg
                      bg-white px-2 py-1 shadow-sm">
        <span className="text-blue-400 text-xs">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 text-xs outline-none bg-transparent text-gray-700
                     placeholder-gray-400 min-w-0"
        />
        {loading && (
          <span className="text-[10px] text-gray-400 animate-pulse">…</span>
        )}
        <button
          onClick={onCancel}
          className="text-gray-300 hover:text-red-400 text-sm leading-none flex-shrink-0"
          title="Annuler"
        >
          ×
        </button>
      </div>

      {results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200
                       rounded-lg shadow-xl z-[2000] max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => onSelect(r)}
              className="px-3 py-2 text-[11px] text-gray-700 hover:bg-blue-50
                         cursor-pointer border-b border-gray-100 last:border-0 leading-tight"
            >
              {r.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlaceSearch;
