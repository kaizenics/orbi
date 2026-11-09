"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * shadcn Select for a list of options. With `name` it also submits inside plain forms
 * (Radix renders a hidden native select).
 */
export function FormSelect<T extends string>({
  options,
  className,
  ...props
}: {
  options: readonly { value: T; label: React.ReactNode }[];
  name?: string;
  id?: string;
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select
      name={props.name}
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange as ((value: string) => void) | undefined}
      disabled={props.disabled}
    >
      <SelectTrigger id={props.id} aria-label={props["aria-label"]} className={className ?? "w-full"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
