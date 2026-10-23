import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SIGED-INEDUC · Sistema de Gestión y Seguimiento Documental",
    template: "%s · SIGED-INEDUC",
  },
  description:
    "Sistema de Gestión y Seguimiento Documental del Instituto de Investigación e Innovación Educativa (INEDUC), Facultad de Ciencias de la Educación, UASD.",
  robots: { index: false, follow: false },
  applicationName: "SIGED-INEDUC",
};

export const viewport: Viewport = {
  themeColor: "#5e171b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-DO">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 5000 }} />
      </body>
    </html>
  );
}
