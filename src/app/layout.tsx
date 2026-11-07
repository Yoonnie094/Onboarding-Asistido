import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CER Analytics",
    template: "%s · CER Analytics",
  },
  description: "Acceso y configuración de fundos en CER Analytics.",
};

export const viewport: Viewport = {
  themeColor: "#173c2b",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
