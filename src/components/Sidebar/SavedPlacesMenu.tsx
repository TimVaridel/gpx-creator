import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { SavedPlace, SavedPlaceCategory } from '../../types/savedPlace.types';
import { SAVED_PLACE_CATEGORIES } from '../../types/savedPlace.types';
import { getAllPlaces, deletePlace } from '../../services/savedPlaces';
import EditPlaceModal from './EditPlaceModal';

interface Props {
  anchorEl:        HTMLElement | null;
  onSelect:        (lat: number, lng: number, name: string) => void;
  onClose:         () => void;
  /** Si défini, seuls les lieux de cette catégorie sont affichés */
  categoryFilter?: SavedPlaceCategory;
}

export default function SavedPlacesMenu({
  anchorEl,
  onSelect,
  onClose,
  categoryFilter,
}: Props) {
  const [places,      setPlaces]      = useState<SavedPlace[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Position calculée directement depuis anchorEl — pas de useEffect+setState
  const pos = anchorEl
    ? (() => {
        const rect = anchorEl.getBoundingClientRect();
        return { bottom: window.innerHeight - rect.top + 4, left: rect.left };
      })()
    : { bottom: 0, left: 0 };

  const load = useCallback(() => {
    setLoading(true);
    getAllPlaces()
      .then(data => setPlaces(data))
      .catch(() => setPlaces([]))
      .finally(() => setLoading(false));
  }, []);

  // Chargement initial — load est stable (useCallback sans deps),
  // on l'appelle dans un timeout pour sortir du corps synchrone de l'effet
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  // Fermer sur clic extérieur (ne se déclenche pas si le modal d'édition est ouvert)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editingPlace) return; // Le modal d'édition gère ses propres clics
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorEl && !anchorEl.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorEl, editingPlace]);

  // Filtre : d'abord par catégorie si définie, puis par la recherche texte
  const filtered = places.filter(p => {
    if (categoryFilter !== undefined && p.category !== categoryFilter) return false;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.lat.toFixed(5).includes(q) ||
      p.lng.toFixed(5).includes(q)
    );
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer « ${name} » ?`)) return;
    await deletePlace(id);
    load();
  };

  // Libellé du header selon le filtre actif
  const catMeta = categoryFilter !== undefined
    ? SAVED_PLACE_CATEGORIES.find(c => c.value === categoryFilter)
    : undefined;
  const headerLabel = catMeta
    ? `${catMeta.emoji} ${catMeta.label}`
    : '📍 Lieux enregistrés';

  // Nombre de lieux dans cette catégorie (pour affichage vide contextuel)
  const totalInCategory = categoryFilter !== undefined
    ? places.filter(p => p.category === categoryFilter).length
    : places.length;

  return (
    <>
      {createPortal(
        <div
          ref={ref}
          className="fixed z-[1500] bg-white border border-gray-200 rounded-xl shadow-2xl
                     max-w-[80%] flex flex-col max-h-[80%]"
          style={{ bottom: pos.bottom, left: pos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-700">{headerLabel}</span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Recherche */}
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou coordonnées…"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5
                         focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-4">Chargement…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4 italic">
                {totalInCategory === 0
                  ? 'Aucun lieu dans cette catégorie.'
                  : 'Aucun résultat.'}
              </p>
            ) : (
              <ul className="py-1">
                {filtered.map(p => {
                  const cat = SAVED_PLACE_CATEGORIES.find(c => c.value === p.category);
                  return (
                    <li key={p.id} className="group px-2 py-1.5 hover:bg-gray-50">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { onSelect(p.lat, p.lng, p.name); onClose(); }}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {categoryFilter === undefined && cat && cat.value !== ''
                              ? `${cat.emoji} `
                              : ''
                            }{p.name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                          </p>
                        </button>

                        {/* Modifier (nom + catégorie) */}
                        <button
                          onClick={e => { e.stopPropagation(); setEditingPlace(p); }}
                          className="text-gray-300 hover:text-blue-500 transition-colors
                                     flex-shrink-0 opacity-0 group-hover:opacity-100"
                          title="Modifier"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3"
                               fill="none" viewBox="0 0 24 24"
                               stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828
                                     0l.172.172a2 2 0 010 2.828L12 16H9v-3z"/>
                          </svg>
                        </button>

                        {/* Supprimer */}
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                          className="text-gray-300 hover:text-red-500 transition-colors
                                     flex-shrink-0 opacity-0 group-hover:opacity-100
                                     text-base leading-none"
                          title="Supprimer"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Modal d'édition — z-index supérieur au menu (1700 > 1500) */}
      {editingPlace && (
        <EditPlaceModal
          place={editingPlace}
          onClose={() => setEditingPlace(null)}
          onSaved={() => {
            setEditingPlace(null);
            load(); // Rafraîchit la liste après modification
          }}
        />
      )}
    </>
  );
}
