import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { Channel } from '../hooks/use-query/useChannelQuery';
import type { Platform } from '../hooks/use-query/usePlatformQuery';
import type { Architecture } from '../hooks/use-query/useArchitectureQuery';

interface AppListFiltersState {
  channel: string;
  platform: string;
  arch: string;
}

interface AppListFiltersProps {
  filters: AppListFiltersState;
  onFiltersChange: (filters: AppListFiltersState) => void;
  channels: Channel[];
  platforms: Platform[];
  architectures: Architecture[];
  isFiltering: boolean;
}

export const AppListFilters: React.FC<AppListFiltersProps> = ({
  filters,
  onFiltersChange,
  channels,
  platforms,
  architectures,
  isFiltering,
}) => {
  const hasActiveFilters = !!(
    filters.channel ||
    filters.platform ||
    filters.arch
  );

  const handleReset = () => {
    onFiltersChange({ channel: '', platform: '', arch: '' });
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <Select
        value={filters.channel || undefined}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, channel: value })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Channel" />
        </SelectTrigger>
        <SelectContent>
          {channels.map((ch) => (
            <SelectItem key={ch.ID} value={ch.ChannelName}>
              {ch.ChannelName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.platform || undefined}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, platform: value })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          {platforms.map((pl) => (
            <SelectItem key={pl.ID} value={pl.PlatformName}>
              {pl.PlatformName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.arch || undefined}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, arch: value })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Architecture" />
        </SelectTrigger>
        <SelectContent>
          {architectures.map((ar) => (
            <SelectItem key={ar.ID} value={ar.ArchID}>
              {ar.ArchID}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          重置
        </Button>
      )}

      {isFiltering && (
        <span className="text-sm text-muted-foreground">筛选中...</span>
      )}
    </div>
  );
};
