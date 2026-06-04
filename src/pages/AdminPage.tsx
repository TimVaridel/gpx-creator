// Page d'administration — gestion des comptes en attente d'approbation
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPendingProfiles, getAllProfiles, approveProfile, deleteProfile } from '../lib/profiles';
import type { Profile } from '../types/profile.types';

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [pending, setPending] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setError(null);
    const [pendingList, allList] = await Promise.all([
      getPendingProfiles(),
      getAllProfiles(),
    ]);
    setPending(pendingList);
    setAllUsers(allList);
  }

  const handleApprove = async (userId: string) => {
    setMessage(null);
    setError(null);
    const err = await approveProfile(userId);
    if (err) {
      setError(err);
    } else {
      setMessage('Utilisateur approuvé.');
      loadData();
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Supprimer définitivement le compte de ${email} ?`)) return;
    setMessage(null);
    setError(null);
    const err = await deleteProfile(userId);
    if (err) {
      setError(err);
    } else {
      setMessage('Utilisateur supprimé.');
      loadData();
    }
  };

  const isAdmin = profile?.is_admin ?? false;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Accès restreint</h1>
          <p className="text-sm text-gray-500 mb-6">Vous n'avez pas les droits d'administration.</p>
          <Link
            to="/"
            className="inline-block px-6 py-2 rounded-lg text-sm font-semibold text-white
                       bg-indigo-500 hover:bg-indigo-600 transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">Administration</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{user?.email}</span>
            <Link
              to="/"
              className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
            >
              Retour à l'app
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Onglets */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${tab === 'pending'
                ? 'bg-indigo-500 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
          >
            En attente ({pending.length})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${tab === 'all'
                ? 'bg-indigo-500 text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
          >
            Tous les comptes ({allUsers.length})
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs">
            {message}
          </div>
        )}

        {/* Tableau */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Inscrit le</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Admin</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Statut</th>
                <th className="px-4 py-2 w-32" />
              </tr>
            </thead>
            <tbody>
              {(tab === 'pending' ? pending : allUsers).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    {tab === 'pending' ? 'Aucun compte en attente.' : 'Aucun utilisateur.'}
                  </td>
                </tr>
              ) : (
                (tab === 'pending' ? pending : allUsers).map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-700">{p.email}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(p.created_at).toLocaleDateString('fr-CH')}
                    </td>
                    <td className="px-4 py-2 text-center text-xs">
                      {p.is_admin ? (
                        <span className="text-indigo-600 font-medium">Oui</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center text-xs">
                      {p.approved ? (
                        <span className="text-green-600 font-medium">Approuvé</span>
                      ) : (
                        <span className="text-amber-600 font-medium">En attente</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        {!p.approved && (
                          <button
                            onClick={() => handleApprove(p.id)}
                            className="px-2 py-1 rounded text-[10px] font-medium
                                       bg-green-50 text-green-600 hover:bg-green-100
                                       border border-green-200 transition-colors"
                          >
                            Approuver
                          </button>
                        )}
                        {!p.is_admin && (
                          <button
                            onClick={() => handleDelete(p.id, p.email)}
                            className="px-2 py-1 rounded text-[10px] font-medium
                                       bg-red-50 text-red-500 hover:bg-red-100
                                       border border-red-200 transition-colors"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
