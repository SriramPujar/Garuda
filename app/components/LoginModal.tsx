import { useState } from 'react';
import { signIn } from 'next-auth/react';

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
        // Will trigger a reactive re-render through SessionProvider
        window.location.reload();
      }
    } else {
      // Registration
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

        // Auto-login after registration
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
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid rgba(212, 175, 55, 0.3)',
        borderRadius: '12px', padding: '2rem', maxWidth: '400px', width: '100%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', gap: '1.5rem',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ॐ</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-saffron-500)' }}>
            {isLogin ? 'Enter the Sanctuary' : 'Begin Your Journey'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            {isLogin ? 'Sign in to access your spiritual chats.' : 'Create an account to save your divine wisdom.'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(255, 80, 80, 0.1)', color: '#ff6b6b', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', border: '1px solid rgba(255, 80, 80, 0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)', outline: 'none',
                fontFamily: 'var(--font-sans)'
              }}
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
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)', outline: 'none',
                fontFamily: 'var(--font-sans)'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem', background: 'linear-gradient(135deg, var(--color-saffron-500), var(--color-saffron-700))',
              color: 'var(--bg-primary)', border: 'none', borderRadius: '6px', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '0.5rem',
              transition: 'opacity 0.2s', fontFamily: 'var(--font-serif)', letterSpacing: '1px'
            }}
          >
            {loading ? 'Communing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-secondary)',
              cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'
            }}
          >
            {isLogin ? "New seeker? Sign up here" : "Already a devotee? Sign in here"}
          </button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}} />
    </div>
  );
}
