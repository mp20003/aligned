import LegalPage from '../components/LegalPage'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="September 8, 2026">
      <p>
        Triova is a small, independently-run app. This policy explains what data it collects,
        why, and how you can get it back or have it removed.
      </p>

      <h2>What we collect</h2>
      <p>When you sign in with Google, we receive your name, email address, and profile picture from Google — nothing else from your Google account.</p>
      <p>Everything you enter into the app itself — your category definitions, your daily wins, and any reflections you write — is stored so it can sync across your devices.</p>
      <p>We do not collect analytics, don't use tracking pixels or third-party ad/analytics scripts, and don't know how you use the app beyond what's needed to run it.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To authenticate you and keep your data private to your account.</li>
        <li>To sync your wins and settings across your devices.</li>
        <li>To operate and improve the app itself.</li>
      </ul>
      <p>We never sell your data, and we never share it with advertisers or data brokers.</p>

      <h2>Who has access</h2>
      <p>
        Your data is stored in a Postgres database hosted by <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a>,
        with row-level security enabled so only you can read or write your own row. Authentication is handled by{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a>. We don't use any other third-party processors.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Access &amp; export</strong> — Settings has an "Export backup" option that downloads everything you've logged as a JSON file.</li>
        <li><strong>Deletion</strong> — Settings has a "Delete account" option that permanently deletes your account and all associated data. You can also request this by emailing us.</li>
        <li><strong>Correction</strong> — you can edit or delete any win, category, or your name directly in the app at any time.</li>
      </ul>

      <h2>Cookies &amp; local storage</h2>
      <p>
        Triova doesn't use tracking cookies. It uses your browser's local storage to keep your session signed in and to cache
        your data for offline use — this stays on your device and isn't a third-party tracker.
      </p>

      <h2>Children's privacy</h2>
      <p>Triova isn't directed at children under 13, and we don't knowingly collect data from them.</p>

      <h2>Changes to this policy</h2>
      <p>If this policy changes, we'll update the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>Questions or deletion requests: <a href="mailto:m4nn.p4tel@gmail.com">m4nn.p4tel@gmail.com</a></p>
    </LegalPage>
  )
}
