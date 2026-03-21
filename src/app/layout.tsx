import type { Metadata } from 'next';
import { DM_Serif_Display, Outfit, DM_Mono, Geist } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const dmSerif = DM_Serif_Display({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
});

export const metadata: Metadata = {
  title: 'DentAI | Inteligência Odontológica',
  description: 'Micro-SaaS odontológico para dentistas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn(dmSerif.variable, outfit.variable, dmMono.variable, "font-sans", geist.variable)} suppressHydrationWarning>
      <body className="bg-bg text-text-primary font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
