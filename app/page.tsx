import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileMusic, ListMusic, Upload } from "lucide-react"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Sheet Music Manager</h1>
        <p className="text-xl text-muted-foreground">Upload, organize, and perform with your sheet music</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <Link href="/sheets" className="block">
          <div className="border rounded-lg p-6 h-full flex flex-col items-center justify-center text-center hover:border-primary transition-colors">
            <FileMusic className="h-12 w-12 mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">My Sheets</h2>
            <p className="text-muted-foreground">Browse and manage your uploaded sheet music</p>
          </div>
        </Link>

        <Link href="/setlists" className="block">
          <div className="border rounded-lg p-6 h-full flex flex-col items-center justify-center text-center hover:border-primary transition-colors">
            <ListMusic className="h-12 w-12 mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">Setlists</h2>
            <p className="text-muted-foreground">Create and manage setlists for your performances</p>
          </div>
        </Link>

        <Link href="/upload" className="block">
          <div className="border rounded-lg p-6 h-full flex flex-col items-center justify-center text-center hover:border-primary transition-colors">
            <Upload className="h-12 w-12 mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">Upload</h2>
            <p className="text-muted-foreground">Add new sheet music to your collection</p>
          </div>
        </Link>
      </div>

      <div className="mt-12 text-center">
        <Link href="/perform">
          <Button size="lg" className="px-8">
            Enter Performance Mode
          </Button>
        </Link>
      </div>
    </div>
  )
}
