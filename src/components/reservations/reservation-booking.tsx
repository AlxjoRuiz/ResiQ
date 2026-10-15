"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AvailabilityCalendar, type AvailabilityZone } from "./availability-calendar";
import { CreateReservationForm, type ReservationAmenity, type ReservationUnit } from "./reservation-forms";

export function ReservationBooking({ propertyId, amenities, units, zones, timeZone, today }: {
  propertyId: string;
  amenities: ReservationAmenity[];
  units: ReservationUnit[];
  zones: AvailabilityZone[];
  timeZone: string;
  today: string;
}) {
  const [amenityId, setAmenityId] = useState(amenities[0]?.id ?? "");
  return <>
    <AvailabilityCalendar zones={zones} timeZone={timeZone} today={today} zoneId={amenityId} onZoneChange={setAmenityId} />
    <section className="mt-7"><Card><CardContent>
      <CreateReservationForm propertyId={propertyId} amenities={amenities} units={units} amenityId={amenityId} onAmenityChange={setAmenityId} />
    </CardContent></Card></section>
  </>;
}
