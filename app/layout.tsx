import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tartan Tickets — Campus events, together",
  description: "Find your people at Carnegie Mellon. Discover and book campus events.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
