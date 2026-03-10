import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ArchitectureCardProps {
  archName: string;
  onClick: () => void;
  onDelete?: () => void;
}

export const ArchitectureCard: React.FC<ArchitectureCardProps> = ({
  archName,
  onClick,
  onDelete,
}) => {
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
    >
      <CardHeader className="p-4">
        <div className="flex items-center min-w-0 w-full">
          <h3 className="text-base font-semibold truncate flex-1" title={archName}>
            {archName}
          </h3>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDeleteClick}
              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
              title="Delete architecture"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
    </Card>
  );
};
