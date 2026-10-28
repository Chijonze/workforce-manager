import type { Metadata } from "next";
import InstallGuide from "@/components/pwa/InstallGuide";

export const metadata: Metadata = {
  title: "Install the app",
  description:
    "Add ShiftSync to your iPhone, iPad, Android or desktop home screen without an app store.",
};

export default function InstallPage() {
  return <InstallGuide />;
}
