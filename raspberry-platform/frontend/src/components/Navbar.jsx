import React from "react";

function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "registration", label: "Registration" },
    { id: "wristband", label: "Wristband Distribution" },
    { id: "prediction", label: "AI Predictions" },
    { id: "network", label: "Network QoS" },
  ];

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">SmartCamp</span>
          </div>

          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200
                  ${activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
