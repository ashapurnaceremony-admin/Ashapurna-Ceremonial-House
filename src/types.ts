export type FloorOption = 
  | "Ground Floor & Lawn Area"
  | "Ground, 1st Floor & Lawn Area"
  | "Ground, 1st, 2nd Floor & Lawn Area";

export type PaymentMethod = "Cash" | "UPI" | "Transfer";
export type BookingStatus = "Pending" | "Completed";
export type ExpenseCategory = 
  | "Maintenance & Repairs"
  | "Electricity & Utilities"
  | "Staff Salary & Wages"
  | "Marketing & Advertising"
  | "Cleaning & Supplies"
  | "Refund / Cancellation"
  | "Cash Deposited to Bank"
  | "Miscellaneous / Others";

export interface Payment {
  amount: number;
  date: string;
  method: PaymentMethod;
  type: 'Advance' | 'Part' | 'Final';
}

export interface Booking {
  id?: string;
  customerName: string;
  address: string;
  phoneNumber: string;
  eventDate: string;
  occasion: string;
  noOfGuests: number;
  floorsRented: FloorOption;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  paymentMethod: PaymentMethod;
  status: BookingStatus;
  receiptNo?: string;
  notes?: string;
  createdAt: any;
  payments?: Payment[];
}

export type QueryStatus = 
  | "General Enquiry" 
  | "Criteria did not matched" 
  | "Keep the date on hold" 
  | "Converted to booking";

export interface Query {
  id?: string;
  customerName: string;
  phoneNumber: string;
  eventDate: string;
  occasion: string;
  approxGuests: number;
  quotedPrice: number;
  status: QueryStatus;
  createdAt: any;
}

export interface Expense {
  id?: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  paymentMethod: PaymentMethod;
  createdAt: any;
}

export interface OpeningBalance {
  id?: string;
  bankBalance: number;
  cashInHand: number;
  year: number;
  createdAt: any;
}
