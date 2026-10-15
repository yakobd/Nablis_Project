import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageTransition } from "@/components/public/PageTransition";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#EEF1F8]">
      <PublicNavbar />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <PublicFooter />
    </div>
  );
}
