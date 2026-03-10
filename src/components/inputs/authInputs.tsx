import { FC } from "react";
import { ErrorMessage, Field } from "formik";
import { Input } from "@/components/ui/input";

type AuthInputsProps = {
  name: string;
  type: string;
  placeholder: string;
};

export const AuthInputs: FC<AuthInputsProps> = ({
  name,
  type,
  placeholder,
}) => {
  return (
    <div className="w-full">
      <Field name={name}>
        {({ field }: { field: { name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onBlur: (e: React.FocusEvent<HTMLInputElement>) => void } }) => (
          <Input
            {...field}
            type={type}
            placeholder={placeholder}
            className="w-full"
          />
        )}
      </Field>
      <ErrorMessage
        name={name}
        component="div"
        className="text-destructive text-sm mt-1 font-medium"
      />
    </div>
  );
};
