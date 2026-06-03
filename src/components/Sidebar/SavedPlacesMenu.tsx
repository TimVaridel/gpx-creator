import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { SavedPlace } from '../../types/savedPlace.types';
import { getAllPlaces, deletePlace, updatePlaceName, nameExists } from '../../services/savedPlaces';

interface Props {
  anchorEl: HTMLElement | null;
  onSelect: (lat: number, lng: number, name: string) => void;
  onClose:  () => void;
}

export default function SavedPlacesMenu({ anchorEl, onSelect, onClose }: Props) {
  const [places,   setPlaces]   = useState<SavedPlace[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editErr,  setEditErr]  = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Position calculée directement depuis anchorEl — pas de useEffect+setState
  const pos = anchorEl
    ? (() => {
        const rect = anchorEl.getBoundingClientRect();
        return { bottom: window.innerHeight - rect.top + 4, left: rect.left };
      })()
    : { bottom: 0, left: 0 };

  // load est stable grâce à useCallback
  const load = useCallback(async () => {
    setLoading(true);
    try { setPlaces(await getAllPlaces()); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Fermer sur clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorEl && !anchorEl.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorEl]);

  const filtered = places.filter(p => {
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

  const handleStartEdit = (p: SavedPlace) => {
    setEditId(p.id);
    setEditName(p.name);
    setEditErr(null);
  };

  const handleSaveEdit = async (id: string, originalName: string) => {
    const trimmed = editName.trim();
    if (!trimmed) { setEditErr('Nom vide.'); return; }
    if (trimmed !== originalName) {
      const exists = await nameExists(trimmed);
      if (exists) { setEditErr(`« ${trimmed} » existe déjà.`); return; }
    }
    await updatePlaceName(id, trimmed);
    setEditId(null);
    load();
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[1500] bg-white border border-gray-200 rounded-xl shadow-2xl
                 max-w-[80%] flex flex-col max-h-[70%]"
      style={{ bottom: pos.bottom, left: pos.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-700">📍 Lieux enregistrés</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
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
            {places.length === 0 ? 'Aucun lieu enregistré.' : 'Aucun résultat.'}
          </p>
        ) : (
          <ul className="py-1">
            {filtered.map(p => (
              <li key={p.id} className="group px-2 py-1.5 hover:bg-gray-50">
                {editId === p.id ? (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => { setEditName(e.target.value); setEditErr(null); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit(p.id, p.name);
                        if (e.key === 'Escape') setEditId(null);
                      }}
                      className="text-xs border border-blue-300 rounded px-2 py-1
                                 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      autoFocus
                    />
                    {editErr && <p className="text-[10px] text-red-500">{editErr}</p>}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveEdit(p.id, p.name)}
                        className="flex-1 text-[10px] py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600"
                      >✓ OK</button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex-1 text-[10px] py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >✗ Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { onSelect(p.lat, p.lng, p.name); onClose(); }}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-xs font-medium text-gray-700 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </p>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleStartEdit(p); }}
                      className="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                      title="Renommer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none"
                           viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z"/>
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 text-base leading-none"
                      title="Supprimer"
                    >×</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}
