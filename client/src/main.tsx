/**
 * @file main.tsx — React application entry point.
 *
 * This file bootstraps the React application by:
 * 1. Importing the root App component which contains all providers and routing.
 * 2. Importing the global stylesheet (index.css) which defines CSS custom properties
 *    for theming (colors, spacing), Tailwind directives, and utility classes.
 * 3. Mounting the React tree into the #root DOM element defined in client/index.html.
 *
 * Uses React 18's createRoot API for concurrent rendering support.
 * The non-null assertion (!) on getElementById is safe because the #root element
 * is guaranteed to exist in the static HTML template.
 */
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
