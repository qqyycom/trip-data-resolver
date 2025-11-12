import { queryTripsByDevice } from "@/lib/trips";
import TripsListClient from "./trips-list-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DeviceTripsPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;

  if (!deviceId) {
    notFound();
  }

  const initialResult = await queryTripsByDevice({ deviceId, pageSize: 10 });

  return (
    <TripsListClient
      deviceId={deviceId}
      initialTrips={initialResult.trips}
      initialCursor={initialResult.nextCursor}
    />
  );
}
