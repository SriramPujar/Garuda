import { useState } from 'react';
import { signIn } from 'next-auth/react';
import styles from '../page.module.css';

const SECURITY_QUESTIONS = [
  { value: 'school', label: 'What was the name of your primary school?' },
  { value: 'thing', label: 'What is your favorite thing?' },
  { value: 'mother', label: "What is your mother's maiden name?" }
];

export default function LoginModal() {
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('school');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (view === 'login') {
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
    } else if (view === 'signup') {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            securityQuestion,
            securityAnswer
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Registration failed');
        }

        // Auto sign-in after sign up
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
    } else if (view === 'forgot') {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            securityAnswer,
            newPassword
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Password reset failed');
        }

        alert('Password reset successfully! You can now sign in with your new password.');
        setView('login');
        setPassword('');
        setError('');
        setLoading(false);
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
            {view === 'login' ? 'Enter the Sanctuary' : view === 'signup' ? 'Begin Your Journey' : 'Reset Password'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: '1.4' }}>
            {view === 'login' 
              ? 'Sign in to access your spiritual chats.' 
              : view === 'signup' 
                ? 'Create an account to save your divine wisdom.' 
                : 'Verify your security question to change your password.'}
          </p>
        </div>

        {error && (
          <div className={styles.modalError}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
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

          {view !== 'forgot' && (
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
          )}

          {view === 'signup' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Security Question:</label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className={styles.modalInput}
                  style={{ background: 'rgba(0,0,0,0.3)', outline: 'none' }}
                >
                  {SECURITY_QUESTIONS.map(q => (
                    <option key={q.value} value={q.value} style={{ background: '#0d162a' }}>{q.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Your Answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  required
                  className={styles.modalInput}
                />
              </div>
            </>
          )}

          {view === 'forgot' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Your Security Question:</label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className={styles.modalInput}
                  style={{ background: 'rgba(0,0,0,0.3)', outline: 'none' }}
                >
                  {SECURITY_QUESTIONS.map(q => (
                    <option key={q.value} value={q.value} style={{ background: '#0d162a' }}>{q.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Answer to Question"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  required
                  className={styles.modalInput}
                />
              </div>

              <div>
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className={styles.modalInput}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={styles.modalSubmitBtn}
          >
            {loading ? 'Communing...' : (view === 'login' ? 'Sign In' : view === 'signup' ? 'Sign Up' : 'Update Password')}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={() => { 
              setView(view === 'login' ? 'signup' : 'login'); 
              setError(''); 
            }}
            className={styles.modalLinkBtn}
          >
            {view === 'login' ? "New seeker? Sign up here" : "Already a devotee? Sign in here"}
          </button>

          {view === 'login' && (
            <button
              type="button"
              onClick={() => { setView('forgot'); setError(''); }}
              className={styles.modalLinkBtn}
              style={{ fontSize: '0.8rem', opacity: 0.8 }}
            >
              Forgot password?
            </button>
          )}

          {view === 'forgot' && (
            <button
              type="button"
              onClick={() => { setView('login'); setError(''); }}
              className={styles.modalLinkBtn}
              style={{ fontSize: '0.8rem', opacity: 0.8 }}
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
