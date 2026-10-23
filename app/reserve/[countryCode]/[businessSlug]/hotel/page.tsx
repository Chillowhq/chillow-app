import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ countryCode: string; businessSlug: string }>;
}

export default async function HotelReservationRedirect({ params }: Props) {
  const { countryCode, businessSlug } = await params;
  redirect(`/reserve/${countryCode}/${businessSlug}`);
}
