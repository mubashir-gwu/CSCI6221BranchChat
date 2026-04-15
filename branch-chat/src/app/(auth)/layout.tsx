import BackendStatusGate from "@/components/common/BackendStatusGate";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BackendStatusGate>{children}</BackendStatusGate>;
}
