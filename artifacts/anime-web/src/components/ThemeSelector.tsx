// components/ThemeSelector.tsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeSelector() {
  const { theme, setTheme, actualTheme } = useTheme();

  const themes = [
    { value: 'light' as const, label: 'Claro', icon: Sun, color: 'text-yellow-500' },
    { value: 'dark' as const, label: 'Oscuro', icon: Moon, color: 'text-blue-500' },
    { value: 'auto' as const, label: 'Auto', icon: Monitor, color: 'text-purple-500' },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
      {themes.map(({ value, label, icon: Icon, color }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            theme === value
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
          title={`${label} (${value === 'auto' ? `Actualmente: ${actualTheme}` : ''})`}
        >
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}