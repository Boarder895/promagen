const langs = [
  'English',
  '??(??)',
  'Español',
  '???????',
  '??????',
  'Português',
  'Français',
  '???????',
  'Deutsch',
  '???',
];

export default function LanguageSwitcher() {
  return (
    <div style={{ margin: '12px 0' }}>
      <label style={{ marginRight: 8 }}>Language:</label>
      <select>
        {langs.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </select>
    </div>
  );
}









