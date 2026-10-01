import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/poppins/900.css";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/400-italic.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/roboto/900.css";
import SettingsDialog from "@/components/SettingsDialog";
import "./globals.css";

export const metadata: Metadata = {
  title: "SWS Report Builder",
  description: "Build SWS social media performance reports from screenshots",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {children}
        <SettingsDialog />
      </body>
    </html>
  );
}
