import "./globals.css";
import { Providers } from "../components/Providers";

export const metadata = {
  title: "SkillStake",
  description: "1v1 Apex Legends skill staking"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
