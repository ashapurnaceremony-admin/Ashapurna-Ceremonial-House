import { jsPDF, GState } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Booking } from "../types";

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return "";
  }
};

export const generateReceiptPDF = async (booking: Booking, isFinal: boolean = false, finalPaymentAmount?: number, isPartPayment: boolean = false) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
  const pageWidthA5 = doc.internal.pageSize.getWidth();
  const pageHeightA5 = doc.internal.pageSize.getHeight();

  let watermarkImgData: string | null = null;
  try {
    watermarkImgData = await getBase64ImageFromUrl("https://i.postimg.cc/Z0Z5kqHx/logo.png");
  } catch (e) { console.warn(e); }

  // Watermark (Subtle, in the middle)
  doc.setGState(new GState({ opacity: 0.3 })); 
  if (watermarkImgData) {
    doc.addImage(watermarkImgData, 'PNG', pageWidthA5 / 2 - 15, pageHeightA5 / 2 - 15, 30, 30);
  } else {
    doc.setFontSize(30);
    doc.setTextColor(150, 150, 150);
    doc.text("ASHAPURNA", pageWidthA5 / 2, pageHeightA5 / 2, { align: "center", angle: -30 });
  }
  doc.setGState(new GState({ opacity: 1.0 }));

  // Header
  doc.setFontSize(24);
  doc.setTextColor(120, 80, 20); // Amber color
  doc.text("ASHAPURNA", pageWidthA5 / 2, 15, { align: "center" });
  doc.setFontSize(14);
  doc.text("CEREMONIAL HALL", pageWidthA5 / 2, 22, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Booking Receipt & Confirmation", pageWidthA5 / 2, 28, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Serial Number & Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Receipt No: ${booking.receiptNo || "N/A"}`, 15, 35);
  doc.text(`Date: ${format(new Date(), "dd-MM-yyyy")}`, pageWidthA5 - 15, 35, { align: "right" });

  const startY = 42;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  let title = isFinal ? (isPartPayment ? "Part Payment Receipt" : "Final Money Receipt") : "Money Receipt & Booking Confirmation";
  doc.text(title, pageWidthA5 / 2, startY, { align: "center" });
  doc.line(pageWidthA5 / 2 - 40, startY + 2, pageWidthA5 / 2 + 40, startY + 2);

  const details = [
    ["Customer Name:", booking.customerName || "N/A", "Occasion:", booking.occasion || "N/A"],
    ["Address:", booking.address || "N/A", "Date of Occasion:", booking.eventDate ? format(new Date(booking.eventDate), "dd-MM-yyyy") : "N/A"],
    ["Contact Number:", booking.phoneNumber || "N/A", "Approx No of Guests:", (booking.noOfGuests || 0).toString()],
    ["Floors Rented:", booking.floorsRented || "N/A", "Total Rent:", `Rs. ${booking.totalAmount || 0}`],
  ];

  if (isFinal && finalPaymentAmount !== undefined) {
    const totalPaidSoFar = booking.advancePaid + finalPaymentAmount;
    details.push(["Initial Advance Paid:", `Rs. ${booking.advancePaid}`, isPartPayment ? "Part Payment Received:" : "Final Payment Received:", `Rs. ${finalPaymentAmount}`]);
    details.push(["Total Amount Paid:", `Rs. ${totalPaidSoFar}`, "Balance Due:", isPartPayment ? `Rs. ${booking.totalAmount - totalPaidSoFar}` : "Rs. 0 (Full & Final)"]);
  } else {
    details.push(["Advance Paid:", `Rs. ${booking.advancePaid || 0}`, "Payment Mode:", booking.paymentMethod || "N/A"]);
    details.push(["Balance Due:", `Rs. ${booking.balanceDue || 0}`, "", ""]);
  }

  if (booking.notes) {
    // @ts-ignore - autoTable supports colSpan but types might be strict
    details.push([{ content: "Notes:", styles: { fontStyle: 'bold' } }, { content: booking.notes, colSpan: 3 }]);
  }

  autoTable(doc, {
    startY: startY + 8,
    body: details,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, font: "helvetica" },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 2: { fontStyle: 'bold', cellWidth: 35 } }
  });

  const finalY = (doc as any).lastAutoTable.finalY || startY + 60;
  if (isFinal) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(isPartPayment ? 0 : 0, isPartPayment ? 0 : 128, isPartPayment ? 255 : 0);
    doc.text(isPartPayment ? "PART PAYMENT RECEIVED" : "FULL AND FINAL PAYMENT RECEIVED", pageWidthA5 / 2, finalY + 10, { align: "center" });
  }

  doc.setTextColor(0, 0, 0);
  doc.line(15, pageHeightA5 - 25, pageWidthA5 - 15, pageHeightA5 - 25);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("This is a computer generated receipt.", 15, pageHeightA5 - 15);
  doc.setFont("helvetica", "bold");
  doc.text("Authorized Signatory", pageWidthA5 - 15, pageHeightA5 - 15, { align: "right" });

  if (!isFinal) {
    doc.addPage("a4", "portrait");
    const pageWidthA4 = doc.internal.pageSize.getWidth();
    const pageHeightA4 = doc.internal.pageSize.getHeight();
    doc.setGState(new GState({ opacity: 0.2 })); // Slightly higher opacity for a smaller watermark
    if (watermarkImgData) doc.addImage(watermarkImgData, 'PNG', pageWidthA4 / 2 - 30, pageHeightA4 / 2 - 30, 60, 60);
    doc.setGState(new GState({ opacity: 1.0 }));
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ASHAPURNA CEREMONIAL HOUSE", pageWidthA4 / 2, 20, { align: "center" });
    doc.line(pageWidthA4 / 2 - 45, 21, pageWidthA4 / 2 + 45, 21); // Underline
    doc.text("RULES AND REGULATIONS", pageWidthA4 / 2, 28, { align: "center" });
    doc.line(pageWidthA4 / 2 - 35, 29, pageWidthA4 / 2 + 35, 29); // Underline
    
    const rules = [
      "• Booking must be confirmed by paying a 25% advance of the total rent for the 'Ashapurna' premises.",
      "• The remaining balance must be paid in full at least two (2) days before the event. The booking amount is non-refundable, though dates may be rescheduled subject to availability.",
      "• Subletting or transferring the booking without prior written consent is not permitted.",
      "• The hall's usage time is strictly limited from 7:00 AM to 12:00 AM (Midnight).",
      "• The generator and AC will only be operated from evening until 12:00 AM (Midnight).",
      "• For optimal comfort and energy efficiency, the AC temperature will be maintained between 25°C and 27°C; no requests for adjustments outside this range will be accepted.",
      "• Using nails, staples, tape, or any items that may damage the walls or property is strictly prohibited. Additionally, lighting fireworks or using flammable decorations inside the premises is not allowed.",
      "• Loudspeakers and music must comply with the local 10-decibel limit and, per government regulations, must be turned off by 10:00 PM. Obscene or objectionable songs are not permitted.",
      "• Setting up DJ is not allowed.",
      "• Guests are responsible for their own belongings; the management is not liable for any theft or loss.",
      "• Any costs for repairs or replacements due to property damage must be borne by the user.",
      "• The management will not be held responsible for any damage or theft in the car parking area.",
      "• Illegal activities, weapons, drugs, or any objectionable items are strictly prohibited on the premises.",
      "• Organizers are requested not to waste electricity (lights, fans, AC) unnecessarily.",
      "• All guests and organizers must follow local municipal laws, police regulations, and health-related advice.",
      "• While generator arrangements are in place during power outages, your cooperation is requested if any technical difficulties arise.",
      "• The use of the \"residential lift\" in the 'Ashapurna' premises for commercial/business purposes is strictly prohibited."
    ];

    let y = 45;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    rules.forEach(rule => {
      const splitText = doc.splitTextToSize(rule, pageWidthA4 - 40);
      doc.text(splitText, 20, y);
      y += splitText.length * 5 + 3;
    });

    // Signature Section
    const sigY = pageHeightA4 - 40;
    doc.setFont("helvetica", "bold");
    doc.text("Management Signature: _________________", 20, sigY);
    
    const rightSigX = pageWidthA4 - 20;
    doc.text("Organizer Name: _____________________", rightSigX, sigY, { align: "right" });
    doc.text("Date of Event: ________________", rightSigX, sigY + 10, { align: "right" });
    doc.text("Organizer Signature: ___________________", rightSigX, sigY + 20, { align: "right" });
  }

  return doc;
};
