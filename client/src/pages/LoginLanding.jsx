import React from "react"
import { Link } from "react-router-dom"
import LoginLeftSide from "../components/LoginLeftSide"
import { Shield, User, ArrowRight } from "lucide-react"

const LoginLanding = () => {
  const portalOptions = [
    {
      to: "/login/admin",
      title: "Admin Portal",
      description: "Manage employees, departments, payroll, and system configurations.",
      icon: Shield
    },
    {
      to: "/login/employee",
      title: "Employee Portal",
      description: "View your profile, track attendance, request time off, and access payslips.",
      icon: User
    }
  ]

  return (
    <div className="flex h-screen">
      <LoginLeftSide />

      <div className="w-full md:w-1/2 flex items-center justify-center">
        <div className="w-full max-w-md p-6">
          <h2 className="text-3xl font-medium text-slate-900 tracking-tight mb-3">
            Welcome Back
          </h2>
          <p className="text-slate-500 mb-8">
            Select your portal to securely access the system.
          </p>

          {/* Portal Cards */}
          <div className="space-y-4">
            {portalOptions.map((portal) => (
              <Link
                key={portal.to}
                to={portal.to}
                className="group block bg-slate-50 border border-slate-200 rounded-lg p-5 sm:p-6 transition-all duration-300 hover:border-indigo-400 hover:bg-indigo-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {portal.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {portal.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all duration-300" />
                </div>
              </Link>
            ))}
          </div>

            {/* Footer */}
<div className="mt-12 text-center md:text-left text-sm text-slate-400">
  <p>© {new Date().getFullYear()} TechTitans. All rights reserved.</p>
</div>

        </div>
      </div>
    </div>
  )
}

export default LoginLanding