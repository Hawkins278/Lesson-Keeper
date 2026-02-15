/**
 * @file ThemeToggle — A simple icon button that toggles between light and
 * dark colour themes.
 *
 * Uses the `useTheme` hook from the app's ThemeProvider to read the current
 * theme and toggle it on click. The icon displayed reflects the *opposite*
 * theme (Moon when light → click to go dark; Sun when dark → click to go
 * light), acting as a visual hint for the upcoming change.
 */
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {/* Show Moon icon in light mode (hint: "click to switch to dark")
          and Sun icon in dark mode (hint: "click to switch to light"). */}
      {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </Button>
  );
}
