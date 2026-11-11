import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "../app/dashboard";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Dashboard
      userName="Bản xem mẫu"
      signOutPath="https://tuoi-ca-chua-3-hang.promisinghill1.chatgpt.site/"
      staticMode
    />
  </React.StrictMode>,
);
