import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBar({ placeholder = "Search", name = "q", defaultValue }: { placeholder?: string; name?: string; defaultValue?: string }) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} className="pl-9" />
    </div>
  );
}
