// frontend/src/components/language-switcher.tsx

const LANGS = [
  "English",
  "中文 (简体)",
  "Español",
  "日本語",
  "한국어",
  "Português",
  "Français",
  "Русский",
  "Deutsch",
  "العربية",
];

export default function LanguageSwitcher() {
  const id = "language-switcher";

  return (
    <div className="mt-3">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-400"
      >
        Language
      </label>
      <select
        id={id}
        name="language"
        className="mt-1 block w-full rounded-md border border-slate-700 bg-black/40 px-2 py-1 text-xs text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        defaultValue={LANGS[0]}
      >
        {LANGS.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
}
