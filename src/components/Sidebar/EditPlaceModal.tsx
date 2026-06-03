import { useState } from 'react';
import { createPortal } from 'react-dom';
import { nameExists, updatePlaceName, updatePlaceCategory } from '../../services/savedPlaces';
import {
  SAVED_PLACE_CATEGORIES,
  type SavedPlace,
  type SavedPlaceCategory,
} from '../../types/savedPlace.types';

interface Props {
  place:   SavedPlace;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditPlaceModal({ place, onClose, onSaved }: Props) {
  const [name,     setName]     = useState(place.name);
  const [category, setCategory] = useState<SavedPlaceCategory>(place.category);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Le nom ne peut pas être vide.'); return; }

    setLoading(true);
    setError(null);

    try {
      // Vérifie unicité du nom uniquement si le nom a changé
      if (trimmed !== place.name) {
        const exists = await nameExists(trimmed);
        if (exists) {
          setError(`« ${trimmed} » existe déjà.`);
          setLoading(false);
          return;
        }
        await updatePlaceName(place.id, trimmed);
      }

      // Met à jour la catégorie si elle a changé
      if (category !== place.category) {
        await updatePlaceCategory(place.id, category);
      }

      onSaved();
      onClose();
    } catch {
      setError("Erreur lors de la modification.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-[1600]" onClick={onClose} />
      <div className="fixed z-[1700] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      bg-white rounded-2xl shadow-2xl w-80 p-5">

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-800">✏️ Modifier ce lieu</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mb-1">
          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
        </p>

        {/* Nom */}
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          placeholder="Nom du lieu…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-300 mb-3"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />

        {/* Catégorie */}
        <div className="mb-3">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">
            Catégorie
          </p>
          <div className="grid grid-cols-1 gap-1">
            {SAVED_PLACE_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
                            border transition-colors text-left
                            ${category === cat.value
                              ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-xs font-semibold
                       bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="flex-1 py-2 rounded-lg text-xs font-semibold
                       bg-blue-500 text-white hover:bg-blue-600
                       disabled:opacity-40 transition-colors"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
