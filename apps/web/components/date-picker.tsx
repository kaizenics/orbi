"use client";

import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** YYYY-MM-DD ⇄ Date at local midnight, so the picked day never shifts with the time zone. */
const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * shadcn date picker (calendar in a popover) that works inside plain forms: the chosen day is
 * submitted as `name` = "YYYY-MM-DD", or "" when cleared.
 */
export function DatePicker({
  name,
  defaultValue,
  id,
  placeholder = "Pick a date",
}: {
  name: string;
  defaultValue?: string | null;
  id?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn("w-full justify-start font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon aria-hidden />
            {value ? formatDate(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? toDate(value) : undefined}
            defaultMonth={value ? toDate(value) : undefined}
            onSelect={(date) => {
              setValue(date ? toIso(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
