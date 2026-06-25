'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '3rem 1.5rem',
      fontFamily: 'var(--font-sans)',
      lineHeight: '1.7',
      color: 'var(--color-text-primary)',
    }}>
      <header style={{
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        paddingBottom: '1.5rem',
        marginBottom: '2.5rem',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          color: 'var(--color-saffron-500)',
          fontSize: '2.5rem',
          marginBottom: '0.5rem'
        }}>
          Garuda AI
        </h1>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '1.1rem',
          fontStyle: 'italic'
        }}>
          Privacy Policy
        </p>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.9rem',
          marginTop: '0.5rem'
        }}>
          Last Updated: June 17, 2026
        </p>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            1. Introduction
          </h2>
          <p>
            Welcome to <strong>Garuda AI</strong> (referenced as "we", "us", "our", or the "Application"), developed by Sriram Pujar. Garuda AI is designed to serve as your spiritual and intellectual guide, utilizing artificial intelligence to provide insights and wisdom from sacred scriptures, including the <em>Bhagavad Gita</em>, <em>Uddhava Gita</em>, and <em>Śrīmad Bhāgavatam</em>.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            We respect your privacy and are committed to protecting the personal data you share with us. This Privacy Policy describes how we collect, use, and safeguard your information when you use our web, desktop (Electron), or mobile (Capacitor) applications.
          </p>
        </section>

        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            2. Information We Collect
          </h2>
          <p>We collect only the information necessary to provide you with the best experience:</p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', listStyleType: 'disc' }}>
            <li>
              <strong>Account Information:</strong> When you register an account, we collect your self-selected username and a password. Passwords are securely hashed before storing.
            </li>
            <li>
              <strong>Chat History and Queries:</strong> To provide chat continuity and search history, we store your queries and the assistant's responses in our database.
            </li>
            <li>
              <strong>Local Preferences:</strong> We store configurations such as your visual theme selection (e.g., "Dharma" or "Forest") locally on your device using local storage or cookies.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            3. How Your Information Is Used
          </h2>
          <p>We use your information to:</p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', listStyleType: 'disc' }}>
            <li>Maintain, run, and secure your account and session authentication.</li>
            <li>Render your personalized chat logs and save historical sessions.</li>
            <li>Optimize application performance, preferences, and offline capability.</li>
          </ul>
        </section>

        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            4. Third-Party Services and Data Transfer
          </h2>
          <p>
            Garuda AI utilizes third-party artificial intelligence engines (specifically, Google Gemini API and Groq API via Vercel AI SDK) to generate responses to your queries.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            When you type a query, the content of your message (along with recent message context) is sent to these third-party processors. We do not transmit your username, password, or account metadata to these external AI services. Please refrain from typing sensitive personal identification information directly into the chat prompt.
          </p>
        </section>

        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            5. User Control and Data Deletion
          </h2>
          <p>
            You have full control over your chat sessions. You may delete individual chat logs or completely wipe all historical logs at any time using the trash/delete options available directly within the application interface.
          </p>
        </section>

        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            6. Cookies and Local Storage
          </h2>
          <p>
            We use essential cookies and browser local storage to maintain session states (NextAuth) and store display themes. We do not use advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            7. Security
          </h2>
          <p>
            We deploy standard measures to protect user data, including cryptographic password hashing (bcrypt) and transport encryption (HTTPS) for API calls. However, no electronic transmission or storage method is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-saffron-500)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            8. Contact Information
          </h2>
          <p>
            For any questions, concerns, or requests regarding this Privacy Policy, please reach out to us at:
          </p>
          <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
            Developer: Sriram Pujar
          </p>
        </section>
      </main>

      <footer style={{
        marginTop: '3.5rem',
        borderTop: '1px solid rgba(212, 175, 55, 0.2)',
        paddingTop: '1.5rem',
        textAlign: 'center'
      }}>
        <Link href="/" style={{
          color: 'var(--color-saffron-500)',
          textDecoration: 'none',
          fontWeight: 'bold',
          transition: 'opacity 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          ← Return to Garuda AI
        </Link>
      </footer>
    </div>
  );
}
