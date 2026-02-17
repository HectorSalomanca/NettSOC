"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/services/auth";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  showAction?: boolean;
}

export default function TopBar({
  title,
  subtitle,
  actionLabel,
  actionHref,
  showAction = false,
}: TopBarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/login");
    } catch {
      // ignore
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-white/60 backdrop-blur-sm px-8 py-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {showAction && actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="rounded-xl bg-foreground px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 shadow-sm"
          >
            {actionLabel}
          </Link>
        )}

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent transition hover:bg-accent/20"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-12 z-50 w-44 rounded-xl bg-white shadow-lg border border-border py-1.5">
              <Link
                href="/profile"
                className="block px-4 py-2 text-sm text-foreground hover:bg-background transition"
                onClick={() => setDropdownOpen(false)}
              >
                Profile
              </Link>
              <Link
                href="/org"
                className="block px-4 py-2 text-sm text-foreground hover:bg-background transition"
                onClick={() => setDropdownOpen(false)}
              >
                Organization
              </Link>
              <hr className="my-1.5 border-border" />
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
