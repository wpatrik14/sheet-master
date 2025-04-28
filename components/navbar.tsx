"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FileMusic, Home, ListMusic, Upload } from "lucide-react"

export default function Navbar() {
  const pathname = usePathname()

  // Don't show navbar in performance mode
  if (pathname.startsWith("/perform")) {
    return null
  }

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl flex items-center">
          <FileMusic className="mr-2 h-5 w-5" />
          SheetMaster
        </Link>

        <div className="flex items-center space-x-1">
          <Link href="/">
            <Button variant={pathname === "/" ? "default" : "ghost"} size="sm">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
          <Link href="/sheets">
            <Button variant={pathname === "/sheets" ? "default" : "ghost"} size="sm">
              <FileMusic className="h-4 w-4 mr-2" />
              Sheets
            </Button>
          </Link>
          <Link href="/setlists">
            <Button variant={pathname === "/setlists" ? "default" : "ghost"} size="sm">
              <ListMusic className="h-4 w-4 mr-2" />
              Setlists
            </Button>
          </Link>
          <Link href="/upload">
            <Button variant={pathname === "/upload" ? "default" : "ghost"} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
