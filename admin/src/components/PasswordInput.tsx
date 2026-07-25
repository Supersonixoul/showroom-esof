import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';

/// Champ mot de passe avec bouton oeil pour basculer entre masqué/visible.
/// Utilisé partout où l'admin saisit un mot de passe (connexion, comptes
/// Pro, comptes commerciaux).
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        tabIndex={-1}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.88 5.09A10.9 10.9 0 0112 5c5.5 0 9.5 4 11 7-.6 1.3-1.6 2.8-2.9 4.09M6.2 6.2C3.9 7.7 2.2 9.9 1 12c1.5 3 5.5 7 11 7 1.3 0 2.5-.2 3.6-.6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </button>
    </div>
  );
}
