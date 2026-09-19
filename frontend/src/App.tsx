import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AppFiltersProvider } from "./context/AppFilters";
import { ThemeProvider } from "./context/ThemeContext";
import { Overview } from "./pages/Overview";
import { Agent } from "./pages/Agent";
import { Inspection } from "./pages/Inspection";
import { Defects } from "./pages/Defects";
import { RootCause } from "./pages/RootCause";
import { ProductionFlow } from "./pages/ProductionFlow";
import { Economics } from "./pages/Economics";
import { Recommendations } from "./pages/Recommendations";
import { DataPage } from "./pages/Data";
import { Methodology } from "./pages/Methodology";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppFiltersProvider>
          <Shell>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/agent" element={<Agent />} />
              <Route path="/inspection" element={<Inspection />} />
              <Route path="/defects" element={<Defects />} />
              <Route path="/root-cause" element={<RootCause />} />
              <Route path="/production-flow" element={<ProductionFlow />} />
              <Route path="/economics" element={<Economics />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/methodology" element={<Methodology />} />
            </Routes>
          </Shell>
        </AppFiltersProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
