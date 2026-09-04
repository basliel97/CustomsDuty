import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CustomsDuty Pro - Ethiopian Customs Tax Calculator",
  description: "Official Ethiopian customs duty calculation and assessment system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
