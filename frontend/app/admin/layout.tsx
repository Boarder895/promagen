export const metadata = {
  title: "Admin | Promagen",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
