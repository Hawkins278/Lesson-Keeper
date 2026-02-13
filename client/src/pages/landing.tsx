import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookOpen, TrendingDown, LogIn, KeyRound } from "lucide-react";
import hawkinsLogo from "@assets/Hawkins-Digital_1770883345237.jpg";

interface TopSubcategory {
  id: number;
  name: string;
  categoryName: string;
  effectiveScore: number;
}

function getScoreColor(score: number) {
  if (score >= 750) return "text-cbb";
  if (score >= 500) return "text-cbb/80";
  if (score >= 250) return "text-cbb/60";
  return "text-muted-foreground";
}

function getScoreBarColor(score: number) {
  if (score >= 750) return "bg-cbb";
  if (score >= 500) return "bg-cbb/70";
  if (score >= 250) return "bg-cbb/50";
  return "bg-cbb/30";
}

function getScoreBarWidth(score: number) {
  return Math.min(100, Math.max(3, (score / 1500) * 100));
}

export default function LandingPage() {
  const { data: topSubcategories = [], isLoading } = useQuery<TopSubcategory[]>({
    queryKey: ["/api/public/top-subcategories"],
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-[1.7rem] leading-none tracking-tight" style={{ fontFamily: '"Boucherie Block W05 Bold", serif' }} data-testid="text-app-name">LessonKeeper</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col justify-center">
        <div className="max-w-5xl mx-auto w-full px-6 py-16 space-y-12">
          <div className="space-y-3 text-center">
            <h1 className="text-3xl lg:text-4xl font-serif font-bold tracking-tight leading-tight" data-testid="text-hero-heading">
              Capture the Learning from All Your Projects
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A centralized knowledge base that turns project experiences into actionable insight. Track what went well, spotlight what needs attention, and build smarter teams.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground text-center" data-testid="text-top-issues-heading">
              Current Top Issues
            </h2>
            {isLoading ? (
              <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-md" />
                ))}
              </div>
            ) : topSubcategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">No scored issues yet. Sign in to start recording lessons.</p>
            ) : (
              <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {topSubcategories.map((sub, index) => (
                  <Card key={sub.id} className="p-4 space-y-2" data-testid={`card-top-subcategory-${index}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" data-testid={`text-subcategory-name-${index}`}>{sub.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{sub.categoryName}</p>
                      </div>
                      <div className={`flex items-center gap-1 flex-shrink-0 ${getScoreColor(sub.effectiveScore)}`}>
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span className="text-sm font-mono font-semibold" data-testid={`text-score-${index}`}>
                          {sub.effectiveScore.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-sm bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-sm transition-all ${getScoreBarColor(sub.effectiveScore)}`}
                        style={{ width: `${getScoreBarWidth(sub.effectiveScore)}%` }}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Card className="max-w-sm mx-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-center" data-testid="text-login-heading">Sign In</h2>
            <div className="space-y-3">
              <Button className="w-full" size="lg" asChild data-testid="button-login">
                <a href="/api/login">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign in with Replit
                </a>
              </Button>
              <Button className="w-full" size="lg" variant="outline" disabled data-testid="button-sso">
                <KeyRound className="w-4 h-4 mr-2" />
                Sign in with SSO
              </Button>
              <p className="text-xs text-muted-foreground text-center">SSO login coming soon</p>
            </div>
          </Card>
        </div>
      </div>

      <footer className="border-t">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src={hawkinsLogo} alt="Hawkins-Digital" className="h-10 w-10 rounded-md object-cover" data-testid="img-hawkins-logo" />
            <div>
              <span className="block" style={{ fontFamily: '"Boucherie Block W05 Bold", serif' }}>LessonKeeper &copy; {new Date().getFullYear()}</span>
              <span className="block text-xs">a Hawkins-Digital product</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
