import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Olytics — E-Commerce Analytics",
  description: "Olist e-commerce data warehouse dashboard on AWS (Redshift)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
