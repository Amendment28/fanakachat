import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// ============================================
// APPOINTMENT REMINDER CRON JOB
// ============================================
// Run this every 15-30 minutes to send reminders
// Sends reminders 24-48 hours before appointment

export async function sendAppointmentReminders() {
  const now = new Date();
  
  // Find appointments that need reminders based on each shop's settings
  // We check a wide window (1-168 hours / 1-7 days) and filter by shop settings
  
  const appointments = await prisma.appointment.findMany({
    where: {
      appointmentTime: {
        gte: new Date(now.getTime() + 1 * 60 * 60 * 1000),   // At least 1 hour away
        lte: new Date(now.getTime() + 168 * 60 * 60 * 1000), // Up to 7 days away
      },
      status: "CONFIRMED",
      reminderSent: false,
      customerPhone: { not: "" }, // Only remind if we have phone
    },
    include: {
      shop: true,
    },
  });

  // Filter by each shop's reminder settings
  const appointmentsToRemind = appointments.filter((apt) => {
    const hoursUntil = (apt.appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const shopReminderHours = apt.shop.reminderHours || 24;
    
    // Send reminder when we're within the shop's reminder window
    // Allow 1 hour grace period (e.g., if set to 24h, send between 23-25h before)
    return hoursUntil >= (shopReminderHours - 1) && hoursUntil <= (shopReminderHours + 1);
  });

  console.log(`[Reminders] Found ${appointmentsToRemind.length} appointments needing reminders (${appointments.length} total in window)`);

  for (const apt of appointmentsToRemind) {
    try {
      const formattedTime = apt.appointmentTime.toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const hoursUntil = Math.round(
        (apt.appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      );

      // Send reminder to customer
      await sendWhatsAppMessage({
        to: apt.customerPhone,
        message:
          `⏰ Appointment Reminder\n\n` +
          `You have an appointment at ${apt.shop.name}\n\n` +
          `📅 ${formattedTime}\n` +
          `⌛ In ${hoursUntil} hours\n\n` +
          `See you soon! 👋\n\n` +
          `To cancel, reply: cancel ${apt.customerName}`,
      });

      // Mark reminder sent
      await prisma.appointment.update({
        where: { id: apt.id },
        data: { reminderSent: true },
      });

      console.log(`[Reminders] Sent reminder for appointment ${apt.id}`);
    } catch (error) {
      console.error(`[Reminders] Failed to send reminder for ${apt.id}:`, error);
    }
  }

  return { sent: appointmentsToRemind.length };
}

// ============================================
// NO-SHOW CHECK (Optional - run after appointment time)
// ============================================
// Run this every 15-30 minutes to check for completed/missed appointments

export async function checkNoShows() {
  const now = new Date();
  
  // Find appointments that:
  // 1. Were 15-60 minutes ago (grace period)
  // 2. Status still CONFIRMED (not marked completed/no-show yet)
  
  const checkWindowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
  const checkWindowEnd = new Date(now.getTime() - 15 * 60 * 1000);   // 15 min ago

  const appointments = await prisma.appointment.findMany({
    where: {
      appointmentTime: {
        gte: checkWindowStart,
        lte: checkWindowEnd,
      },
      status: "CONFIRMED",
    },
    include: {
      shop: true,
    },
  });

  console.log(`[No-Show Check] Found ${appointments.length} appointments to verify`);

  for (const apt of appointments) {
    try {
      const formattedTime = apt.appointmentTime.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      // Ask shop owner
      await sendWhatsAppMessage({
        to: apt.shop.phoneNumber,
        message:
          `📋 Appointment Follow-Up\n\n` +
          `Customer: ${apt.customerName}\n` +
          `Time: ${formattedTime}\n\n` +
          `Did they show up?\n\n` +
          `Reply "completed" if they came ✅\n` +
          `Reply "no-show" if they didn't ❌`,
      });

      // Don't ask again - shop owner will respond
      // We'll handle the response in bot.ts
      
      console.log(`[No-Show Check] Asked shop owner about appointment ${apt.id}`);
    } catch (error) {
      console.error(`[No-Show Check] Failed to check appointment ${apt.id}:`, error);
    }
  }

  return { checked: appointments.length };
}
