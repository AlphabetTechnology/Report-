/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";

export default function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar no-print">
      <Link href="/">
        <img className="logo" src="/template/sws-logo.png" alt="SWS" />
      </Link>
      <h1>Report Builder</h1>
      {children}
    </header>
  );
}
