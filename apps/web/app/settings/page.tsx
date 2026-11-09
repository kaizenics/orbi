import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AiSettingsForm } from "@/components/ai-settings-form";
import { MapPlaceholder, PlannerShell } from "@/components/planner-shell";

export default function SettingsPage() {
  const panel = (
    <>
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" /> Trips
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <AiSettingsForm />
    </>
  );
  return (
    <PlannerShell panel={panel} map={<MapPlaceholder label="Your settings apply to all your trips." />} />
  );
}
