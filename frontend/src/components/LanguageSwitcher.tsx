const langs = [
  'English',
  'ä¸­æ–‡(ç®€ä½“)',
  'EspaÃ±ol',
  'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©',
  'à¤¹à¤¿à¤¨à¥à¤¦à¥€',
  'PortuguÃªs',
  'FranÃ§ais',
  'Ð ÑƒÑÑÐºÐ¸Ð¹',
  'Deutsch',
  'æ—¥æœ¬èªž',
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






