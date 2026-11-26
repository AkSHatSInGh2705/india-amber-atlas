import { createFileRoute } from "@tanstack/react-router";
import { FoodBridgeExperience } from "@/components/foodbridge/experience";
import { InstallButton } from "@/components/pwa/install-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodBridge · Local Food-Surplus Redistribution" },
      {
        name: "description",
        content:
          "Connecting surplus food to people who need it. A web app for donors, a mobile app for NGOs and individuals — Gurugram, Haryana.",
      },
      { property: "og:title", content: "FoodBridge · Local Food-Surplus Redistribution" },
      {
        property: "og:description",
        content: "Connecting surplus food to people who need it — donors, NGOs and individuals in Gurugram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <h1 className="sr-only">FoodBridge</h1>
      <FoodBridgeExperience />
      <InstallButton />
      <ThemeToggle />
    </main>
  );
}
