import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { parseAppointmentTime, formatAppointmentTime, isToday, isTomorrow } from "@/lib/date-utils";

// ============================================
// APPOINTMENT SCHEDULING MODULE
// ============================================

// Book a new appointment
export async function handleBookCommand(
  shopId: string,
  customerPhone: string,
  customerName: string,
  text: string
) {
  // Parse: book [name] [time]
  // Examples:
  //   "book John 2pm"
  //   "book Mary tomorrow 10am"
  //   "book 3:30pm"
  
  const bookPattern = /^book\s+(.+)$/i;
  const match = text.match(bookPattern);
  
  if (!match) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message: 
        "📅 *Book an Appointment*\n\n" +
        "Format: book [name] [time]\n\n" +
        "Examples:\n" +
        "• book John 2pm\n" +
        "• book Mary tomorrow 10am\n" +
        "• book 3:30pm today\n\n" +
        "Times can be:\n" +
        "• 2pm, 14:00, 2:30pm\n" +
        "• today 3pm, tomorrow 9am\n" +
        "• Aug 20 2pm, 20/8 14:00",
    });
  }

  const args = match[1].trim();
  
  // Try to parse time from the end of the string
  const timeResult = parseAppointmentTime(args);
  
  if (!timeResult.success) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message: 
        "❌ Could not understand the time.\n\n" +
        "Please use:\n" +
        "• 2pm, 14:00, 2:30pm\n" +
        "• today 3pm, tomorrow 9am\n" +
        "• Aug 20 2pm, 20/8 14:00\n\n" +
        "Try again: book [name] [time]",
    });
  }

  const { time: appointmentTime, nameFromInput } = timeResult;
  const finalName = nameFromInput || customerName;

  // Check if time is in the past
  if (appointmentTime < new Date()) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message: "❌ Cannot book appointments in the past. Please choose a future time.",
    });
  }

  // Check for conflicts (within 15 minutes)
  const conflictStart = new Date(appointmentTime.getTime() - 15 * 60 * 1000);
  const conflictEnd = new Date(appointmentTime.getTime() + 15 * 60 * 1000);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      shopId,
      status: "CONFIRMED",
      appointmentTime: {
        gte: conflictStart,
        lte: conflictEnd,
      },
    },
  });

  if (existingAppointments.length > 0) {
    const conflictTimes = existingAppointments
      .map(a => formatAppointmentTime(a.appointmentTime))
      .join(", ");
    
    return sendWhatsAppMessage({
      to: customerPhone,
      message: 
        `⚠️ Time slot conflict!\n\n` +
        `There's already an appointment at ${conflictTimes}.\n\n` +
        `Please choose a different time.`,
    });
  }

  // Create appointment
  const appointment = await prisma.appointment.create({
    data: {
      shopId,
      customerName: finalName,
      customerPhone,
      appointmentTime,
      status: "CONFIRMED",
      reminderSent: false,
    },
  });

  // Get shop details for notification
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
  });

  // Notify customer
  await sendWhatsAppMessage({
    to: customerPhone,
    message:
      `✅ *Appointment Confirmed!*\n\n` +
      `📅 ${formatAppointmentTime(appointmentTime)}\n` +
      `👤 ${finalName}\n\n` +
      `You'll receive a reminder 1 hour before.\n\n` +
      `To cancel: reply "cancel ${finalName}"`,
  });

  // Notify shop owner
  if (shop) {
    await sendWhatsAppMessage({
      to: shop.phoneNumber,
      message:
        `📅 *New Appointment*\n\n` +
        `👤 ${finalName}\n` +
        `📞 ${customerPhone}\n` +
        `🕐 ${formatAppointmentTime(appointmentTime)}\n\n` +
        `ID: ${appointment.id.slice(-8)}`,
    });
  }

  return appointment;
}

// Cancel an appointment
export async function handleCancelCommand(
  shopId: string,
  customerPhone: string,
  text: string
) {
  // Parse: cancel [name]
  const cancelPattern = /^cancel\s+(.+)$/i;
  const match = text.match(cancelPattern);
  
  if (!match) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message:
        "📅 *Cancel Appointment*\n\n" +
        "Format: cancel [name]\n\n" +
        "Example: cancel John",
    });
  }

  const nameQuery = match[1].trim().toLowerCase();

  // Find active appointments for this customer/name
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      customerPhone,
      status: "CONFIRMED",
      appointmentTime: { gte: new Date() }, // Only future appointments
    },
    orderBy: { appointmentTime: "asc" },
  });

  if (appointments.length === 0) {
    return sendWhatsAppMessage({
      to: customerPhone,
      message: "❌ No upcoming appointments found.",
    });
  }

  // Try to match by name
  const matchedAppointment = appointments.find(
    a => a.customerName.toLowerCase().includes(nameQuery) ||
         nameQuery.includes(a.customerName.toLowerCase())
  );

  if (!matchedAppointment) {
    const names = appointments.map(a => a.customerName).join(", ");
    return sendWhatsAppMessage({
      to: customerPhone,
      message: 
        `❌ No appointment found for "${match[1]}".\n\n` +
        `Your upcoming appointments:\n${names}`,
    });
  }

  // Cancel the appointment
  const cancelled = await prisma.appointment.update({
    where: { id: matchedAppointment.id },
    data: { status: "CANCELLED" },
  });

  // Get shop details
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
  });

  // Notify customer
  await sendWhatsAppMessage({
    to: customerPhone,
    message:
      `✅ *Appointment Cancelled*\n\n` +
      `👤 ${cancelled.customerName}\n` +
      `📅 ${formatAppointmentTime(cancelled.appointmentTime)}\n\n` +
      `To book a new appointment: reply "book [name] [time]"`,
  });

  // Notify shop owner
  if (shop) {
    await sendWhatsAppMessage({
      to: shop.phoneNumber,
      message:
        `🔔 *Appointment Cancelled*\n\n` +
        `👤 ${cancelled.customerName}\n` +
        `📞 ${customerPhone}\n` +
        `🕐 ${formatAppointmentTime(cancelled.appointmentTime)}`,
    });
  }

  return cancelled;
}

// Show today's schedule
export async function handleTodayCommand(shopId: string, recipientPhone: string, isShopOwner: boolean) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      appointmentTime: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: "CONFIRMED",
      ...(isShopOwner ? {} : { customerPhone: recipientPhone }),
    },
    orderBy: { appointmentTime: "asc" },
  });

  if (appointments.length === 0) {
    return sendWhatsAppMessage({
      to: recipientPhone,
      message: 
        `📅 *Today's Schedule*\n\n` +
        `No appointments scheduled for today.`,
    });
  }

  const appointmentList = appointments
    .map((a, i) => {
      const time = formatAppointmentTime(a.appointmentTime, true); // Short format
      return `${i + 1}. ${time} - ${a.customerName}` + 
             (isShopOwner ? ` (${a.customerPhone})` : "");
    })
    .join("\n");

  return sendWhatsAppMessage({
    to: recipientPhone,
    message:
      `📅 *Today's Schedule*\n\n` +
      appointmentList +
      `\n\n${appointments.length} appointment${appointments.length > 1 ? "s" : ""} today`,
  });
}

// Show tomorrow's schedule
export async function handleTomorrowCommand(shopId: string, recipientPhone: string, isShopOwner: boolean) {
  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      appointmentTime: {
        gte: tomorrowStart,
        lte: tomorrowEnd,
      },
      status: "CONFIRMED",
      ...(isShopOwner ? {} : { customerPhone: recipientPhone }),
    },
    orderBy: { appointmentTime: "asc" },
  });

  if (appointments.length === 0) {
    return sendWhatsAppMessage({
      to: recipientPhone,
      message:
        `📅 *Tomorrow's Schedule*\n\n` +
        `No appointments scheduled for tomorrow.`,
    });
  }

  const appointmentList = appointments
    .map((a, i) => {
      const time = formatAppointmentTime(a.appointmentTime, true);
      return `${i + 1}. ${time} - ${a.customerName}` +
             (isShopOwner ? ` (${a.customerPhone})` : "");
    })
    .join("\n");

  return sendWhatsAppMessage({
    to: recipientPhone,
    message:
      `📅 *Tomorrow's Schedule*\n\n` +
      appointmentList +
      `\n\n${appointments.length} appointment${appointments.length > 1 ? "s" : ""} tomorrow`,
  });
}

// Send appointment reminders (called by cron job)
export async function sendAppointmentReminders() {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const fiftyMinutesFromNow = new Date(now.getTime() + 50 * 60 * 1000); // 10-minute window

  // Find appointments that need reminders
  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      reminderSent: false,
      appointmentTime: {
        gte: fiftyMinutesFromNow,
        lte: oneHourFromNow,
      },
    },
    include: {
      shop: true,
    },
  });

  console.log(`[Appointment Reminders] Found ${appointments.length} appointments to remind`);

  for (const appointment of appointments) {
    try {
      // Send reminder to customer
      await sendWhatsAppMessage({
        to: appointment.customerPhone,
        message:
          `⏰ *Appointment Reminder*\n\n` +
          `Your appointment is in 1 hour!\n\n` +
          `📅 ${formatAppointmentTime(appointment.appointmentTime)}\n` +
          `📍 ${appointment.shop.name}\n` +
          `👤 ${appointment.customerName}\n\n` +
          `See you soon!`,
      });

      // Mark reminder as sent
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSent: true },
      });

      console.log(`[Appointment Reminders] Sent reminder for appointment ${appointment.id}`);
    } catch (error) {
      console.error(`[Appointment Reminders] Failed to send reminder for ${appointment.id}:`, error);
    }
  }

  return { sent: appointments.length };
}
