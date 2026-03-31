export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string
  owner_name: string
  owner_phone: string
  created_at: string
}

export interface Room {
  id: string
  property_id: string
  room_number: string
  floor: number
  type: 'single' | 'double' | 'dorm'
  total_beds: number
  status: 'available' | 'partial' | 'full' | 'maintenance'
  created_at: string
}

export interface Bed {
  id: string
  room_id: string
  bed_number: string
  rate_monthly: number
  rate_daily: number
  status: 'available' | 'occupied' | 'maintenance' | 'reserved'
  created_at: string
  room?: Room
}

export interface Admin {
  id: string
  user_id: string
  property_id: string
  name: string
  email: string
  phone: string
  role: 'super_admin' | 'staff'
  permissions: {
    view_financials: boolean
    delete_residents: boolean
    manage_rooms: boolean
    log_payments: boolean
    manage_maintenance: boolean
  }
  is_active: boolean
  created_at: string
}

export interface Resident {
  id: string
  user_id: string | null
  property_id: string
  bed_id: string | null
  name: string
  mobile: string
  email: string | null
  emergency_contact_name: string | null
  emergency_contact_number: string | null
  hometown: string | null
  institution: string | null
  occupation: 'student' | 'working' | 'other'
  room_number: string | null
  rent_amount: number
  security_deposit: number
  date_of_joining: string
  expected_duration: string | null
  stay_type: 'long_stay' | 'short_stay'
  aadhaar_front_path: string | null
  aadhaar_back_path: string | null
  tc_agreed_at: string | null
  tc_agreed_ip: string | null
  agreement_path: string | null
  status: 'pending' | 'active' | 'notice' | 'vacated'
  initial_electricity_reading: number
  notes: string | null
  created_at: string
  updated_at: string
  bed?: Bed
}

export interface Booking {
  id: string
  property_id: string
  bed_id: string | null
  resident_id: string | null
  full_name: string
  mobile: string
  email: string | null
  occupation: string | null
  from_date: string | null
  duration: string | null
  price_finalised: number | null
  token_payment_screenshot: string | null
  token_amount: number
  status: 'inquiry' | 'booked' | 'onboarding_sent' | 'onboarded' | 'cancelled'
  onboarding_link_sent_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ShortStay {
  id: string
  property_id: string
  bed_id: string | null
  name: string
  mobile: string
  email: string | null
  aadhaar_front_path: string | null
  aadhaar_back_path: string | null
  tc_agreed_at: string | null
  checkin_date: string
  checkout_date: string
  daily_rate: number
  total_amount: number | null
  payment_mode: 'upi' | 'bank_transfer' | 'cash' | null
  payment_status: 'pending' | 'partial' | 'paid'
  amount_paid: number
  status: 'active' | 'checked_out' | 'cancelled'
  notes: string | null
  created_at: string
}

export interface RentPayment {
  id: string
  resident_id: string
  month: number
  year: number
  rent_amount: number
  late_fee: number
  electricity_amount: number
  total_amount: number
  amount_paid: number
  payment_mode: 'upi' | 'bank_transfer' | 'cash' | null
  payment_screenshot_path: string | null
  paid_at: string | null
  status: 'pending' | 'partial' | 'paid'
  receipt_requested_at: string | null
  receipt_sent_at: string | null
  notes: string | null
  created_at: string
  resident?: Resident
}

export interface ElectricityReading {
  id: string
  bed_id: string
  resident_id: string
  month: number
  year: number
  previous_reading: number
  current_reading: number
  units_consumed: number
  rate_per_unit: number
  bill_amount: number
  reading_date: string
  added_to_rent: boolean
  created_at: string
  resident?: Resident
}

export interface NoticePeriod {
  id: string
  resident_id: string
  notice_date: string
  last_day_per_agreement: string
  last_day_of_stay: string | null
  reason: string | null
  status: 'active' | 'completed' | 'cancelled'
  submitted_via: 'app' | 'form' | 'manual'
  created_at: string
  resident?: Resident
}

export interface MaintenanceRequest {
  id: string
  property_id: string
  resident_id: string | null
  title: string
  description: string | null
  category: 'plumbing' | 'electrical' | 'carpentry' | 'cleaning' | 'appliance' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled'
  assigned_to: string | null
  resolution_notes: string | null
  submitted_by: 'resident' | 'admin'
  image_path: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  resident?: Resident
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'rent_reminder' | 'late_fee' | 'maintenance' | 'notice' | 'receipt' | 'general'
  is_read: boolean
  action_url: string | null
  created_at: string
}

export interface DashboardStats {
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
  occupancyRate: number
  monthlyIncome: number
  pendingRent: number
  activeNotices: number
  openMaintenance: number
  shortStayGuests: number
}
