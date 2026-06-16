import { Label as RadixLabel } from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<typeof RadixLabel>) {
  return <RadixLabel className={cn("text-sm font-medium leading-none", className)} {...props} />;
}
