import { PhoneCall } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { site } from "@/lib/site-content";

export function CallButton({ children = "Call us now", asChild: _asChild, ...props }: ButtonProps) {
  return (
    <Button asChild {...props}>
      <a href={site.phoneHref}>
        <PhoneCall size={18} />
        {children}
      </a>
    </Button>
  );
}
