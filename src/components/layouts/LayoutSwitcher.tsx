import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, Columns3 } from "lucide-react";
import type { LayoutMode } from "./types";

const VALID_LAYOUTS = new Set<string>(["card", "list", "board"]);

function isValidLayout(value: string): value is LayoutMode {
  return VALID_LAYOUTS.has(value);
}

interface LayoutSwitcherProps {
  value: LayoutMode;
  onChange: (value: LayoutMode) => void;
}

export const LayoutSwitcher: React.FC<LayoutSwitcherProps> = ({
  value,
  onChange,
}) => {
  const handleValueChange = (newValue: string) => {
    if (newValue && isValidLayout(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <ToggleGroup type="single" value={value} onValueChange={handleValueChange} size="sm">
      <ToggleGroupItem value="card" aria-label="Card view" title="Card view">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view" title="List view">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="board" aria-label="Board view" title="Board view">
        <Columns3 className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
