import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Funding Rate Monitor",
  description: "Compare public perpetual-futures funding rates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
