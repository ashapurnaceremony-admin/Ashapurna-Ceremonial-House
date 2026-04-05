import * as XLSX from 'xlsx';
import { Booking, Query, Expense } from '../types';
import { format } from 'date-fns';

export const exportToExcel = (bookings: Booking[], queries: Query[], expenses: Expense[]) => {
  const wb = XLSX.utils.book_new();

  // Bookings Sheet
  const bookingData = bookings.map(b => ({
    "Customer Name": b.customerName,
    "Address": b.address,
    "Contact Number": b.phoneNumber,
    "Occasion": b.occasion,
    "Date of Occasion": format(new Date(b.eventDate), "dd-MM-yyyy"),
    "Approx No of Guests": b.noOfGuests,
    "Floors Rented": b.floorsRented,
    "Total Rent": b.totalAmount,
    "Advance Paid": b.advancePaid,
    "Payment Mode": b.paymentMethod,
    "Balance Due": b.balanceDue,
    "Status": b.status,
    "Notes": b.notes || "",
    "Created At": format(new Date(b.createdAt), "dd-MM-yyyy HH:mm")
  }));
  const wsBookings = XLSX.utils.json_to_sheet(bookingData);
  XLSX.utils.book_append_sheet(wb, wsBookings, "Bookings");

  // Queries Sheet
  const queryData = queries.map(q => ({
    "Customer Name": q.customerName,
    "Contact Number": q.phoneNumber,
    "Event Date": format(new Date(q.eventDate), "dd-MM-yyyy"),
    "Occasion": q.occasion,
    "Approx Guests": q.approxGuests,
    "Quoted Price": q.quotedPrice,
    "Created At": format(new Date(q.createdAt), "dd-MM-yyyy HH:mm")
  }));
  const wsQueries = XLSX.utils.json_to_sheet(queryData);
  XLSX.utils.book_append_sheet(wb, wsQueries, "Queries");

  // Expenses Sheet
  const expenseData = expenses.map(e => ({
    "Date": format(new Date(e.date), "dd-MM-yyyy"),
    "Category": e.category,
    "Description": e.description,
    "Amount": e.amount,
    "Payment Mode": e.paymentMethod,
    "Created At": format(new Date(e.createdAt), "dd-MM-yyyy HH:mm")
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(expenseData);
  XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");

  XLSX.writeFile(wb, `Ashapurna_Report_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
};
