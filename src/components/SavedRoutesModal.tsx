import { useState, useEffect } from 'react';
import { listSavedRoutes, getSavedRoute, deleteSavedRoute } from '../lib/savedRoutes';
import type { SavedRouteDB } from '../types/route.types';
import type { SavedRouteListItem } from '../lib/savedRoutes';

interface SavedRoutesModalProps {
  onLoad: (route: SavedRouteDB) => void;
  onClose: () => void;
}

export default function SavedRoutesModal({ onLoad, onClose }: SavedRoutesModalProps) {
  const [routes, setRoutes] = useState<SavedRouteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    listSavedRoutes().then(data => {
      setRoutes(data);
      setLoading(false);
    });
  }, []);

  const filtered = routes
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.name === 'BROUILLON') return -1;
      if (b.name === 'BROUILLON') return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const handleLoad = async (id: string) => {
    const data = await getSavedRoute(id);
    if (data) { onLoad(data); onClose(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce parcours définitivement ?')) return;
    const ok = await deleteSavedRoute(id);
    if (ok) setRoutes(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
         onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">Parcours sauvegardés</h2>
          <button onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        {/* Recherche */}
        <div className="px-5 py-2 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom…"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5
                       focus:outline-none focus:ring-2 focus:ring-indigo-300"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <p className="text-xs text-gray-400 animate-pulse">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucun parcours sauvegardé.</p>
          ) : filtered.map(r => (
            <div key={r.id}
                 className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg
                            border border-gray-200 hover:border-indigo-200 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{r.name}</p>
                <p className="text-[10px] text-gray-400">
                  {r.waypoint_count} point{r.waypoint_count > 1 ? 's' : ''}
                  &nbsp;· {new Date(r.updated_at).toLocaleDateString('fr-CH')}
                </p>
              </div>
              <button onClick={() => handleLoad(r.id)}
                      className="text-[11px] font-medium text-white bg-indigo-500
                                 hover:bg-indigo-600 rounded px-2.5 py-1 transition-colors">
                Charger
              </button>
              <button onClick={() => handleDelete(r.id)}
                      className="text-[11px] text-red-400 hover:text-red-600
                                 border border-dashed border-red-200 rounded px-2 py-1
                                 hover:bg-red-50 transition-colors">
                Suppr.
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
