import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { appliquerTheme, themeEnregistre } from "./theme";
import "./styles.css";

// Avant le premier rendu, pour ne pas montrer le mauvais thème un instant.
appliquerTheme(themeEnregistre());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
