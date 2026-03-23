import React from 'react';
import { Sun, Moon, Clock } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTheme } from '../providers/themeProvider';

const VALID_MODES = new Set<string>(['light', 'dark', 'auto']);

export const ThemeSwitcher: React.FC = () => {
  const { themeMode, setThemeMode } = useTheme();

  const handleValueChange = (newValue: string) => {
    if (newValue && VALID_MODES.has(newValue)) {
      setThemeMode(newValue as 'light' | 'dark' | 'auto');
    }
  };

  return (
    <ToggleGroup
      type='single'
      value={themeMode}
      onValueChange={handleValueChange}>
      <ToggleGroupItem value='light' aria-label='Light theme' title='Light'>
        <Sun className='h-4 w-4' />
      </ToggleGroupItem>
      <ToggleGroupItem value='dark' aria-label='Dark theme' title='Dark'>
        <Moon className='h-4 w-4' />
      </ToggleGroupItem>
      <ToggleGroupItem value='auto' aria-label='Auto theme' title='Auto'>
        <Clock className='h-4 w-4' />
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
