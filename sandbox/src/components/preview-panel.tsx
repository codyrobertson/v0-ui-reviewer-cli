"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RefreshCw } from "lucide-react"

interface StyleUpdate {
  timestamp: number
  selector: string
  styles: Record<string, string>
  component?: string
}

export function PreviewPanel() {
  const [styleUpdates, setStyleUpdates] = useState<StyleUpdate[]>([])
  const [activeTab, setActiveTab] = useState("side-by-side")

  useEffect(() => {
    // Apply style updates
    styleUpdates.forEach((update) => {
      const styleId = `preview-style-${update.timestamp}`
      let styleElement = document.getElementById(styleId) as HTMLStyleElement
      
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        document.head.appendChild(styleElement)
      }

      const cssText = Object.entries(update.styles)
        .map(([prop, value]) => `${prop}: ${value};`)
        .join(' ')
      
      styleElement.textContent = `${update.selector} { ${cssText} }`
    })
  }, [styleUpdates])

  const resetStyles = () => {
    // Remove all preview styles
    document.querySelectorAll('[id^="preview-style-"]').forEach(el => el.remove())
    setStyleUpdates([])
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">V0 UI Preview Sandbox</h1>
          <Button onClick={resetStyles} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset Styles
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="modified">Modified</TabsTrigger>
          </TabsList>

          <TabsContent value="side-by-side" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Original Design</h2>
                <div className="original-preview">
                  <ComponentShowcase />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">Modified Design</h2>
                <div className="modified-preview">
                  <ComponentShowcase />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="original" className="mt-6">
            <div className="original-preview">
              <ComponentShowcase />
            </div>
          </TabsContent>

          <TabsContent value="modified" className="mt-6">
            <div className="modified-preview">
              <ComponentShowcase />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ComponentShowcase() {
  return (
    <div className="space-y-6">
      {/* Buttons Section */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Various button styles and states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">📦</Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Section */}
      <Card>
        <CardHeader>
          <CardTitle>Form Elements</CardTitle>
          <CardDescription>Input fields and form controls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Type your message here..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description goes here</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a sample card component with some content inside.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Another Card</CardTitle>
            <CardDescription>With action buttons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cards can contain various elements and actions.
            </p>
            <div className="flex gap-2">
              <Button size="sm">Action</Button>
              <Button size="sm" variant="outline">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}