import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { Transactions } from './pages/Transactions';
import { Budgets } from './pages/Budgets';
import { Recurring } from './pages/Recurring';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Settings } from './pages/Settings';
import { ThemeProvider } from './contexts/ThemeContext';
import { QuickAddProvider } from './contexts/QuickAddContext';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <QuickAddProvider>
          <Routes>
            <Route element={<Layout />}>
              {/* The app is opened mostly to log, so it lands on Transactions */}
              <Route path="/" element={<Navigate to="/transactions" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/recurring" element={<Recurring />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </QuickAddProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
