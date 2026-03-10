import { FC, PropsWithChildren } from "react";

export const AuthWrapper: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="flex h-screen max-h-full font-sans bg-background">
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <main className="flex-1 flex items-center justify-center">
          {children}
        </main>
      </div>
    </div>
  );
};
