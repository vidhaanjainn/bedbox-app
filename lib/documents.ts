import { jsPDF } from 'jspdf'

// Admin-only document generation (agreement copy + police tenant-verification form).
// Both produce a PDF Blob the caller uploads to the private-docs bucket - never
// exposed to residents, matching the admin-only storage policy on that bucket.

export type PropertyInfo = {
  name: string
  address: string
  phone: string
  email: string
}

export type ResidentForDoc = {
  name: string
  mobile: string
  email?: string | null
  room_number?: string | null
  rent_amount?: number | null
  security_deposit?: number | null
  hometown?: string | null
  aadhaar_number?: string | null
  date_of_joining?: string | null
  agreement_signed_at?: string | null
  agreement_ip?: string | null
  agreement_version?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}

const money = (n?: number | null) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const date = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

function header(doc: jsPDF, property: PropertyInfo, title: string) {
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(property.name, 20, 20)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(property.address, 20, 26)
  doc.text(`${property.phone}  ·  ${property.email}`, 20, 31)
  doc.setDrawColor(0, 180, 170)
  doc.setLineWidth(0.5)
  doc.line(20, 35, 190, 35)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 20, 44)
}

function row(doc: jsPDF, y: number, label: string, value: string) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(label, 20, y)
  doc.setTextColor(20)
  doc.setFont('helvetica', 'bold')
  doc.text(value || '-', 75, y)
  return y + 7
}

// Copy of the signed tenancy agreement - clause text + signature metadata.
// Not the legal instrument itself (that's the timestamp+IP+checkbox captured at
// signing time), just a durable, readable record of what was agreed and when.
// `signatureDataUrl` - the resident's drawn signature (PNG data URL), fetched
// by the caller and placed here automatically. The landlord/property side is
// left as a blank line deliberately - the owner signs that by hand.
export function generateAgreementPdf(resident: ResidentForDoc, property: PropertyInfo, clauses: string[], signatureDataUrl?: string | null): Blob {
  const doc = new jsPDF()
  header(doc, property, 'Tenancy Agreement - Signed Copy')

  let y = 54
  y = row(doc, y, 'Resident', resident.name)
  y = row(doc, y, 'Mobile', resident.mobile)
  y = row(doc, y, 'Room', resident.room_number || '-')
  y = row(doc, y, 'Monthly Rent', money(resident.rent_amount))
  y = row(doc, y, 'Security Deposit', money(resident.security_deposit))
  y = row(doc, y, 'Date Signed', date(resident.agreement_signed_at))
  y = row(doc, y, 'Signed From IP', resident.agreement_ip || '-')
  y = row(doc, y, 'Agreement Version', resident.agreement_version || '-')
  y += 4

  doc.setDrawColor(220)
  doc.line(20, y, 190, y)
  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Clauses Agreed To', 20, y)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  clauses.forEach((clause, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${clause}`, 165)
    if (y + lines.length * 4.5 > 280) { doc.addPage(); y = 20 }
    doc.text(lines, 20, y)
    y += lines.length * 4.5 + 2
  })

  if (y > 260) { doc.addPage(); y = 20 }
  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('This document records a digital agreement executed with explicit consent, timestamp, and IP address,', 20, y)
  y += 4.5
  doc.text('as permitted under the Information Technology Act, 2000.', 20, y)

  // Signature block - resident's signature auto-placed from what they drew
  // at onboarding; the landlord/property side is left blank on purpose for
  // a manual, physical signature.
  const sigBlockHeight = 42
  if (y + sigBlockHeight > 280) { doc.addPage(); y = 20 } else { y += 16 }

  const leftX = 20, rightX = 115
  const sigLineY = y + 22

  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', leftX, y, 70, 20, undefined, 'FAST')
    } catch {
      // Malformed/unreadable image data - fall back to a blank line rather
      // than fail the whole PDF generation.
    }
  }
  doc.setDrawColor(150)
  doc.setLineWidth(0.3)
  doc.line(leftX, sigLineY, leftX + 70, sigLineY)
  doc.line(rightX, sigLineY, rightX + 70, sigLineY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(20)
  doc.text('Tenant Signature', leftX, sigLineY + 5)
  doc.text(resident.name, leftX, sigLineY + 10)
  doc.setTextColor(100)
  doc.text(date(resident.agreement_signed_at), leftX, sigLineY + 15)

  doc.setTextColor(20)
  doc.text('Landlord / Property Signature', rightX, sigLineY + 5)
  doc.setTextColor(150)
  doc.text('(to be signed manually)', rightX, sigLineY + 10)

  return doc.output('blob')
}

// Standard tenant-verification fields Indian police stations typically require
// for PG/rental tenant registration. This produces a submission-ready document -
// it does not submit anywhere automatically. There is no public API for
// municipal/state police tenant-verification portals to integrate against;
// the owner should confirm the current submission process with their local
// police station (in person, or that station's specific online portal if any).
export function generatePoliceVerificationPdf(resident: ResidentForDoc, property: PropertyInfo): Blob {
  const doc = new jsPDF()
  header(doc, property, 'Tenant Verification Form')

  let y = 54
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Landlord / Property Details', 20, y); y += 8
  y = row(doc, y, 'Property Name', property.name)
  y = row(doc, y, 'Address', property.address)
  y = row(doc, y, 'Owner Contact', property.phone)
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.text('Tenant Details', 20, y); y += 8
  y = row(doc, y, 'Full Name', resident.name)
  y = row(doc, y, 'Mobile Number', resident.mobile)
  y = row(doc, y, 'Email', resident.email || '-')
  y = row(doc, y, 'Permanent Address / Hometown', resident.hometown || '-')
  y = row(doc, y, 'Aadhaar Number', resident.aadhaar_number || '⚠️ NOT ON FILE')
  y = row(doc, y, 'Room / Occupancy', resident.room_number || '-')
  y = row(doc, y, 'Date of Occupancy', date(resident.date_of_joining))
  y = row(doc, y, 'Purpose of Stay', 'Residential (student/working professional accommodation)')
  y = row(doc, y, 'Emergency Contact', [resident.emergency_contact_name, resident.emergency_contact_phone].filter(Boolean).join(' - ') || '-')
  y += 10

  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('Photograph and Aadhaar copy on file with property management (not embedded in this form).', 20, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.line(20, y, 80, y)
  doc.line(120, y, 180, y)
  y += 5
  doc.setFontSize(9)
  doc.text('Landlord Signature', 20, y)
  doc.text('Date', 120, y)

  return doc.output('blob')
}
