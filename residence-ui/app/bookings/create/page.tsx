// src/app/bookings/create/page.tsx
import CreateBookingForm from '../../../components/bookings/CreateBookingForm';

export default function CreateBookingPage() {
  return (
    <main className="container mx-auto py-8 px-4">
      <CreateBookingForm />
    </main>
  );
}