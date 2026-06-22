import { type ButtonProps } from "@/components/ui/button";
import { VideoCallButton } from "@/components/video-call-button";

export function CallButton({ children = "Call us now", asChild: _asChild, ...props }: ButtonProps) {
  return <VideoCallButton {...props}>{children}</VideoCallButton>;
}
