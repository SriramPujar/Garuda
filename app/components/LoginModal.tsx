import { useState } from 'react';
import { signIn } from 'next-auth/react';
import styles from '../page.module.css';

export default function LoginModal() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      const res = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        window.location.reload();
      }
    } else {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Registration failed');
        }

        const loginRes = await signIn('credentials', {
          redirect: false,
          username,
          password,
        });

        if (loginRes?.error) {
          setError(loginRes.error);
          setLoading(false);
        } else {
          window.location.reload();
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--color-saffron-500)', textShadow: '0 0 10px rgba(212, 175, 55, 0.3)' }}>ॐ</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-saffron-500)' }}>
            {isLogin ? 'Enter the Sanctuary' : 'Begin Your Journey'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            {isLogin ? 'Sign in to access your spiritual chats.' : 'Create an account to save your divine wisdom.'}
          </p>
        </div>

        {error && (
          <div className={styles.modalError}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={styles.modalInput}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={styles.modalInput}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={styles.modalSubmitBtn}
          >
            {loading ? 'Communing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className={styles.modalLinkBtn}
          >
            {isLogin ? "New seeker? Sign up here" : "Already a devotee? Sign in here"}
          </button>
        </div>
      </div>
    </div>
  );
}
