import React from "react";
import { createRoot } from "react-dom/client";
import { LoginScreen } from "../../src/LoginScreen.jsx";
import "../../src/styles/system.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LoginScreen
      onComplete={(profile) => {
        window.completedFoundationProfile = profile;
      }}
    />
  </React.StrictMode>,
);
