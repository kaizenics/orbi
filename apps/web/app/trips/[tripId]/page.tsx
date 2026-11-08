import { TripView } from "@/components/trip-view";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripView tripId={tripId} />;
}
