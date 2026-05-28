export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
