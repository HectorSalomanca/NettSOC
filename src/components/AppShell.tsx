"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  showAction?: boolean;
  children: React.ReactNode;
}

export default function AppShell({
  title,
  subtitle,
  actionLabel,
  actionHref,
  showAction = false,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-20">
        <TopBar
          title={title}
          subtitle={subtitle}
          actionLabel={actionLabel}
          actionHref={actionHref}
          showAction={showAction}
        />
        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
