// import './App.css'

// function App() {
//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-100">
//       <h1 className="text-4xl font-bold text-blue-600">
//         React + TypeScript + Tailwind 🚀
//       </h1>
//     </div>
//   )
// }

// export default App
import { Routes, Route, Link } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import RequireAuth from "@/components/layout/RequireAuth";
import { EmptyState } from "@/components/common/States";
import Landing from "@/pages/Landing";
import HomeDashboard from "@/pages/HomeDashboard";
import Explore from "@/pages/Explore";
import ExpertProfile from "@/pages/ExpertProfile";
import Book from "@/pages/Book";
import { Login, Signup } from "@/pages/Auth";
import BecomeExpert from "@/pages/BecomeExpert";
import Profile from "@/pages/Profile";
import ExpertDashboard from "@/pages/ExpertDashboard";
import AdminDashboard from "@/pages/AdminDashboard";

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <EmptyState title="Page not found" description="The page you're looking for doesn't exist." action={<Link to="/" className="text-sm font-semibold text-sky-700" data-testid="notfound-home-link">Go home</Link>} testId="not-found" />
    </div>
  );
}

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<HomeDashboard />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/experts/:id" element={<ExpertProfile />} />
        <Route path="/book/:id" element={<RequireAuth><Book /></RequireAuth>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/become-expert" element={<BecomeExpert />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/expert/dashboard" element={<RequireAuth roles={["expert"]}><ExpertDashboard /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth roles={["admin"]}><AdminDashboard /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

