import { ActivityProvider } from "@/components/workspace/ActivityContext";

export default function WorkspaceLayout({
  children,
}: LayoutProps<"/workspace">) {
  return <ActivityProvider>{children}</ActivityProvider>;
}
