// Garde de route — redirige vers /login si l'utilisateur n'est pas authentifié
// Affiche un écran d'attente si le compte n'est pas encore approuvé
import { useState, useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading, profileLoading, signOut, refreshProfile } = useAuth();
  const [stuck, setStuck] = useState(false);

  // Si profileLoading dure + de 1 s, on passe en mode "coincé"
  useEffect(() => {
    if (profileLoading) {
      const timer = setTimeout(() => setStuck(true), 1000);
      return () => clearTimeout(timer);
    }
    setStuck(false);
  }, [profileLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="text-sm text-gray-500 animate-pulse">Chargement…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Profil en cours de chargement (max 3 s avant fallback)
  if (profileLoading && !stuck) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="text-sm text-gray-500 animate-pulse">Chargement du profil…</div>
      </div>
    );
  }

  // Profil chargé mais pas encore approuvé
  if (profile && !profile.approved) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Compte en attente</h1>
          <p className="text-sm text-gray-500 mb-2">
            Votre compte est en attente de validation par un administrateur.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Vous recevrez un email dès que votre accès sera activé.
          </p>
          <p className="text-xs text-gray-400">{user.email}</p>
          <button
            onClick={signOut}
            className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition"
          >
            Déconnexion
          </button>
        </div>
      </div>
    );
  }

  // Profil introuvable (cas exceptionnel)
  if (!profileLoading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-4xl mb-3">👤</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Profil introuvable</h1>
          <p className="text-sm text-gray-500 mb-4">
            Aucun profil trouvé pour <strong>{user.email}</strong>.
          </p>
          <div className="flex gap-2">
            <button
              onClick={refreshProfile}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition"
            >
              Réessayer
            </button>
            <button
              onClick={signOut}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
