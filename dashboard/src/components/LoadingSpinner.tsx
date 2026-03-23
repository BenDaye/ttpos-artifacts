export const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="w-12 h-12 border-2 border-muted border-t-primary rounded-full animate-spin mb-5" />
      <span className="text-foreground text-base font-medium">Loading...</span>
    </div>
  );
}; 