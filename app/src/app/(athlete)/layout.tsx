import { Brand } from "@/components/Brand";

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-16">
      <header className="flex items-center justify-between py-4"><Brand href="/" /></header>
      {children}
    </div>
  );
}
