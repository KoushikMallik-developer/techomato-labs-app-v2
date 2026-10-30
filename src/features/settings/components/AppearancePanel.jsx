import { useDispatch, useSelector } from 'react-redux';
import { selectThemeMode, setTheme } from '@/features/theme/themeSlice';

const OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export default function AppearancePanel() {
  const mode = useSelector(selectThemeMode);
  const dispatch = useDispatch();

  return (
    <section className="panel glass">
      <h2>Appearance</h2>
      <p>Follow your system, or pin the app to dark or light.</p>
      <div className="seg" role="group" aria-label="Theme">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={mode === o.value ? 'on' : ''}
            onClick={() => dispatch(setTheme(o.value))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
