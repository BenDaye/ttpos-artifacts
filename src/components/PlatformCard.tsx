import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Platform } from "../hooks/use-query/usePlatformQuery";
import { Trash2 } from "lucide-react";

interface PlatformCardProps {
  platform: Platform;
  onClick: () => void;
  onDelete?: () => void;
}

export const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  onClick,
  onDelete,
}) => {
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const defaultUpdater = platform.Updaters?.find((u) => u.default);
  const updatersCount = platform.Updaters?.length || 0;

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
    >
      <CardHeader className="p-4">
        <div className="flex items-center min-w-0 w-full">
          <div className="flex-1 min-w-0">
            <h3
              className="text-base font-semibold truncate"
              title={platform.PlatformName}
            >
              {platform.PlatformName}
            </h3>
            {updatersCount > 0 && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {updatersCount} updater{updatersCount !== 1 ? "s" : ""}
                </span>
                {defaultUpdater && (
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                    Default: {defaultUpdater.type}
                  </span>
                )}
              </div>
            )}
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDeleteClick}
              className="h-8 w-8 text-destructive hover:text-destructive shrink-0 ml-2"
              title="Delete platform"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
    </Card>
  );
};
