import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { FactoryOverview } from "@/pages/FactoryOverview";
import { ProcessRiskAnalysis } from "@/pages/ProcessRiskAnalysis";
import { MachineIncidents } from "@/pages/MachineIncidents";
import { ProductDefects } from "@/pages/ProductDefects";
import { ModelPerformance } from "@/pages/ModelPerformance";
import { InspectionIntelligence } from "@/pages/InspectionIntelligence";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<FactoryOverview />} />
        <Route path="/process-risk-analysis" element={<ProcessRiskAnalysis />} />
        <Route path="/machine-incidents" element={<MachineIncidents />} />
        <Route path="/product-defects" element={<ProductDefects />} />
        <Route path="/model-performance" element={<ModelPerformance />} />
        <Route path="/inspection-intelligence" element={<InspectionIntelligence />} />
        {/* old route name, kept as a redirect so existing tabs/bookmarks/history don't 404 to a blank page */}
        <Route path="/standard-values" element={<Navigate to="/process-risk-analysis" replace />} />
        {/* catch-all: any unknown path lands on the home page instead of a blank screen */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
