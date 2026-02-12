import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookOpen, Upload, TrendingUp, Shield, BarChart3, Lightbulb } from "lucide-react";
import hawkinsLogo from "@assets/Hawkins-Digital_1770883345237.jpg";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight" data-testid="text-app-name">LessonKeeper</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild data-testid="button-login-nav">
              <a href="/api/login">Sign In</a>
            </Button>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium">
              <Lightbulb className="w-3.5 h-3.5" />
              Knowledge Management
            </div>
            <h1 className="text-4xl lg:text-5xl font-serif font-bold tracking-tight leading-tight" data-testid="text-hero-heading">
              Capture &amp; Learn from Every Project
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              A centralized knowledge base for lessons learned across all your projects. Track what went well, identify areas for improvement, and make smarter decisions.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="/api/login">Get Started</a>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-learn-more">
                <a href="#features">Learn More</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> SSO Secured
              </span>
              <span className="flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Excel Import
              </span>
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Risk Scoring
              </span>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/15 rounded-md" />
            <div className="relative p-8 space-y-4">
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">Requirements Clarity</span>
                  <span className="text-xs font-mono text-muted-foreground">Score: 1,180</span>
                </div>
                <div className="h-2 rounded-sm bg-muted overflow-hidden">
                  <div className="h-full w-[85%] rounded-sm bg-destructive/70 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground">5 lessons across 3 projects</p>
              </Card>
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">Stakeholder Engagement</span>
                  <span className="text-xs font-mono text-muted-foreground">Score: 940</span>
                </div>
                <div className="h-2 rounded-sm bg-muted overflow-hidden">
                  <div className="h-full w-[65%] rounded-sm bg-chart-4/70 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground">3 lessons across 2 projects</p>
              </Card>
              <Card className="p-4 space-y-2 opacity-70">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">Resource Planning</span>
                  <span className="text-xs font-mono text-muted-foreground">Score: 620</span>
                </div>
                <div className="h-2 rounded-sm bg-muted overflow-hidden">
                  <div className="h-full w-[40%] rounded-sm bg-chart-2/70 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground">2 lessons across 1 project</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-serif font-bold">Everything You Need</h2>
          <p className="text-muted-foreground mt-2">Powerful tools to capture, organize, and learn from project experiences.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-md bg-chart-2/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
            <h3 className="font-semibold">Risk Scoring</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Automatic scoring highlights the riskiest subcategories so you can focus improvement efforts where they matter most.
            </p>
          </Card>
          <Card className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold">Excel Import</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload lessons in bulk from Excel spreadsheets. Download a template, fill it in, and import with validation feedback.
            </p>
          </Card>
          <Card className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-md bg-chart-3/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-chart-3" />
            </div>
            <h3 className="font-semibold">Smart Filtering</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Filter by project type, phase, category, and subcategory. Drill down into any lesson for full context and actions.
            </p>
          </Card>
        </div>
      </section>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <span className="block">LessonKeeper &copy; {new Date().getFullYear()}</span>
            <span className="block text-xs">a Hawkins-Digital product</span>
          </div>
          <img src={hawkinsLogo} alt="Hawkins-Digital" className="h-10 w-10 rounded-md object-cover" data-testid="img-hawkins-logo" />
        </div>
      </footer>
    </div>
  );
}
