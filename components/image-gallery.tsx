"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, ArrowUpDown, Eye, Loader2 } from "lucide-react"
import { API_CONFIG } from "@/lib/api-config"

interface ImageGalleryProps {
  images: string[]
  loading: boolean
  error: string | null
  onImageSelect: (image: string) => void
}

export default function ImageGallery({ images, loading, error, onImageSelect }: ImageGalleryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const filteredImages = images
    .filter((img) => img.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.localeCompare(b)
      } else {
        return b.localeCompare(a)
      }
    })

  const handleSort = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6">
        <div className="flex items-center space-x-2 text-destructive">
          <span className="text-lg">⚠️</span>
          <span className="font-medium">{error}</span>
        </div>
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📁</div>
        <h3 className="text-lg font-medium mb-2">No images found</h3>
        <p className="text-muted-foreground">Upload some images to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={handleSort} className="shrink-0 bg-transparent">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          Sort {sortOrder === "asc" ? "A-Z" : "Z-A"}
        </Button>
      </div>

      {/* Results Count */}
      {searchTerm && (
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {filteredImages.length} of {images.length} images
          </Badge>
        </div>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredImages.map((image) => (
          <Card key={image} className="group overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="relative aspect-square">
                <img
                  src={`/images/${image}`}
                  alt={image}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Button
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onImageSelect(image)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Label
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium truncate" title={image}>
                  {image}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredImages.length === 0 && searchTerm && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium mb-2">No images found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms</p>
        </div>
      )}
    </div>
  )
}
