"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { FileMusic, Home, ListMusic, Menu, Upload } from "lucide-react"

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/sheets", label: "Kották", icon: FileMusic },
  { href: "/setlists", label: "Dal-listák", icon: ListMusic },
  { href: "/upload", label: "Feltöltés", icon: Upload },
]

export default function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

        <div className="hidden md:flex items-center space-x-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button variant={pathname === href ? "default" : "ghost"} size="sm">
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </Button>
            </Link>
          ))}
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menü megnyitása">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Menü</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 py-4">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant={pathname === href ? "default" : "ghost"} className="w-full justify-start">
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </Button>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
