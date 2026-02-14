import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrendingDown, LogIn, KeyRound } from "lucide-react";
import hawkinsLogo from "@assets/Hawkins-Digital_1770883345237.jpg";
import citbLogo from "@assets/citb_logo_1770915007635.png";
import hermitIcon from "@assets/Zeppelin_hermit_1_1770990450114.png";

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
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-3 py-1.5 border-b bg-background/80 backdrop-blur-md">
        <div />
        <div className="flex items-center gap-3">
          <span className="text-5xl tracking-tight" style={{ fontFamily: '"Boucherie Block W05 Bold", serif' }} data-testid="text-header-logo">LessonKeeper</span>
          <img src={hermitIcon} alt="LessonKeeper" className="h-[72px] w-[72px] rounded-md object-cover" data-testid="img-hermit-icon" />
        </div>
        <div className="flex items-center gap-2">
          <img src={citbLogo} alt="CITB" className="h-[108px] w-[108px] rounded-md object-contain" data-testid="img-citb-logo" />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        <div className="max-w-5xl mx-auto w-full px-6 py-16 space-y-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-serif font-bold tracking-tight leading-tight" data-testid="text-hero-heading">
                Capture the Learning from All Your Projects
              </h1>
              <p className="text-muted-foreground">
                A centralized knowledge base that turns project experiences into actionable insight. Track what went well, spotlight what needs attention, and build smarter teams.
              </p>
            </div>

            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground" data-testid="text-top-issues-heading">
                Current Top Issues
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-md" />
                  ))}
                </div>
              ) : topSubcategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scored issues yet. Sign in to start recording lessons.</p>
              ) : (
                <div className="space-y-3">
                  {topSubcategories.map((sub, index) => (
                    <div key={sub.id} className="space-y-1.5" data-testid={`card-top-subcategory-${index}`}>
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
                    </div>
                  ))}
                </div>
              )}
            </Card>
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

      <footer className="border-t bg-background">
        <div className="px-4 py-1.5 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src={hawkinsLogo} alt="Hawkins-Digital" className="h-[52px] w-[52px] rounded-md object-cover" data-testid="img-footer-logo" />
            <span className="align-super text-[0.45rem]">TM</span>
            <span className="text-[0.9rem] text-muted-foreground">A Hawkins-Digital<span className="align-super text-[0.5rem]">TM</span> product</span>
          </div>
          <div className="text-[0.9rem]">
            <span style={{ fontFamily: '"Boucherie Block W05 Bold", serif' }}>LessonKeeper</span>
            <span className="align-super text-[0.5rem]">TM</span>
            <span className="mx-1.5">&middot;</span>
            <span>Copyright &copy; 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
