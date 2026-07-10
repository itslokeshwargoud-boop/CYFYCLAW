"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWorkspace from "@/components/ChatWorkspace";

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <ChatWorkspace />
    </main>
  );
}
