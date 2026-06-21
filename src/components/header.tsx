"use client"

import Link from "next/link"
import { FileSearch, Plus } from "lucide-react"
import { UserSwitcher } from "./user-switcher"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-2 mr-4">
          <Link href="/" className="flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg hidden sm:inline-block">DocSearch</span>
          </Link>
        </div>

        <nav className="flex items-center gap-4 text-sm flex-1">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Groups
          </Link>
          <Link
            href="/groups/new"
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Group</span>
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <UserSwitcher />
        </div>
      </div>
    </header>
  )
}
