import { notFound } from "next/navigation";
import { getTripById } from "@/lib/trips";
import TripDetailClient from "./trip-detail-client";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string; tripId: string }>;
}) {
  const { deviceId, tripId } = await params;

  const trip = await getTripById(deviceId, tripId);

  if (!trip) {
    notFound();
  }

  return <TripDetailClient deviceId={deviceId} trip={trip} />;
}
