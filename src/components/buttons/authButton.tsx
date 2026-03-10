import { FC } from "react";
import { Button } from "@/components/ui/button";

type AuthButtonProps = {
  text: string;
  onClick: () => void;
  type?: "submit" | "button";
};

export const AuthButton: FC<AuthButtonProps> = ({
  text,
  onClick,
  type = "submit",
}) => {
  return (
    <Button
      type={type}
      onClick={onClick}
      variant={type === "submit" ? "default" : "outline"}
      className="w-full"
    >
      {text}
    </Button>
  );
};
