// ============================================================
// SILOG Driver Control Tower - Type Definitions
// ============================================================

export type UserRole = 'admin' | 'driver' | 'supervisor';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  driverId?: string; // linked driver profile if role is 'driver'
  createdAt: string;
}

export interface GPSPosition {
  lat: number;
  lng: number;
  locationName: string;
  speedKmh: number;
  stoppedMinutes: number;
  lastUpdated: string;
  heading?: string;
}

export interface ArmadaCCTV {
  cameraId: string;
  cabinStatus: 'online' | 'offline';
  dashcamStatus: 'online' | 'offline';
  cargoStatus: 'online' | 'offline';
  lastSnapshotTime: string;
}

export interface Driver {
  id: string;
  name: string;
  photoUrl?: string;
  phone: string;
  licenseNumber: string;
  transporterId: string;
  transporterName: string;
  vehicleId: string;
  vehiclePlate: string;
  status: DriverStatus;
  totalDeliveries: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimePercentage: number;
  totalRewardPoints: number;
  totalPunishmentPoints: number;
  finalScore: number;
  validViolations: number;
  joinDate: string;
  gps?: GPSPosition;
  cctv?: ArmadaCCTV;
}

export type DriverStatus =
  | 'persiapan_pengiriman'
  | 'dalam_perjalanan'
  | 'antre_bbm'
  | 'istirahat'
  | 'menunggu_gudang'
  | 'proses_bongkar_muat'
  | 'rilisan'
  | 'kendala_operasional'
  | 'selesai_pengiriman';

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  persiapan_pengiriman: 'Persiapan Pengiriman',
  dalam_perjalanan: 'Dalam Perjalanan',
  antre_bbm: 'Antre Pengisian BBM',
  istirahat: 'Istirahat',
  menunggu_gudang: 'Menunggu Gudang',
  proses_bongkar_muat: 'Proses Bongkar Muat',
  rilisan: 'Rilisan',
  kendala_operasional: 'Kendala Operasional',
  selesai_pengiriman: 'Selesai Pengiriman',
};

export const DRIVER_STATUS_COLORS: Record<DriverStatus, string> = {
  persiapan_pengiriman: 'bg-yellow-100 text-yellow-800',
  dalam_perjalanan: 'bg-blue-100 text-blue-800',
  antre_bbm: 'bg-orange-100 text-orange-800',
  istirahat: 'bg-gray-100 text-gray-800',
  menunggu_gudang: 'bg-purple-100 text-purple-800',
  proses_bongkar_muat: 'bg-cyan-100 text-cyan-800',
  rilisan: 'bg-amber-100 text-amber-800',
  kendala_operasional: 'bg-red-100 text-red-800',
  selesai_pengiriman: 'bg-green-100 text-green-800',
};

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: string;
  capacity: number;
  transporterId: string;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface Transporter {
  id: string;
  name: string;
  code: string;
  totalDrivers: number;
  totalVehicles: number;
}

export interface Shipment {
  id: string;
  suratJalanNo: string;
  driverId: string;
  driverName: string;
  vehiclePlate: string;
  transporterName: string;
  origin: string;
  destination: string;
  departureTime: string;
  estimatedArrival: string;
  actualArrival?: string;
  status: ShipmentStatus;
  driverStatus: DriverStatus;
  isOnTime: boolean;
  isInFull: boolean;
  isOTIF: boolean;
  quantity: number;
  quantityReceived?: number;
  travelDuration?: string;
  notes?: string;
}

export type ShipmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type RCACategory =
  | 'parkir_lama'
  | 'jadwal_bongkar'
  | 'rilisan'
  | 'ls_level_stock'
  | 'laka_lantas'
  | 'truk_rusak'
  | 'driver_izin'
  | 'aplikasi_tidak_geser'
  | 'kendala_gps'
  | 'antre_solar'
  | 'storing_perbaikan'
  | 'kendala_operasional_lainnya';

export const RCA_CATEGORY_LABELS: Record<RCACategory, string> = {
  parkir_lama: 'Parkir Lama',
  jadwal_bongkar: 'Jadwal Bongkar',
  rilisan: 'Rilisan',
  ls_level_stock: 'LS / Level Stock',
  laka_lantas: 'Laka Lantas',
  truk_rusak: 'Truk Rusak',
  driver_izin: 'Driver Izin',
  aplikasi_tidak_geser: 'Aplikasi Tidak Geser',
  kendala_gps: 'Kendala GPS / Sistem',
  antre_solar: 'Antre Solar',
  storing_perbaikan: 'Storing / Perbaikan',
  kendala_operasional_lainnya: 'Kendala Operasional Lainnya',
};

// Categories that are external/not driver's fault - should NOT auto-reduce points
export const EXTERNAL_RCA_CATEGORIES: RCACategory[] = [
  'rilisan',
  'ls_level_stock',
  'laka_lantas',
  'truk_rusak',
  'antre_solar',
  'storing_perbaikan',
  'kendala_operasional_lainnya',
];

export type VerificationStatus =
  | 'menunggu_verifikasi'
  | 'sedang_diperiksa'
  | 'terverifikasi_pelanggaran'
  | 'dikecualikan'
  | 'ditolak';

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  sedang_diperiksa: 'Sedang Diperiksa',
  terverifikasi_pelanggaran: 'Terverifikasi sebagai Pelanggaran',
  dikecualikan: 'Dikecualikan dari Pelanggaran',
  ditolak: 'Ditolak / Tidak Terbukti',
};

export const VERIFICATION_STATUS_COLORS: Record<VerificationStatus, string> = {
  menunggu_verifikasi: 'bg-yellow-100 text-yellow-800',
  sedang_diperiksa: 'bg-blue-100 text-blue-800',
  terverifikasi_pelanggaran: 'bg-red-100 text-red-800',
  dikecualikan: 'bg-green-100 text-green-800',
  ditolak: 'bg-gray-100 text-gray-800',
};

export interface RCAEvent {
  id: string;
  driverId: string;
  driverName: string;
  vehiclePlate: string;
  eventDate: string;
  eventTime: string;
  category: RCACategory;
  location: string;
  duration: string;
  description: string;
  evidence?: string[];
  verificationStatus: VerificationStatus;
  controlTowerDecision?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  isExternalCause: boolean;
  pointsDeducted?: number;
  notificationId?: string;
  createdAt: string;
}

export type NotificationPriority = 'info' | 'warning' | 'critical';

export type NotificationHandlingStatus =
  | 'belum_ditangani'
  | 'sedang_ditangani'
  | 'selesai';

export interface Notification {
  id: string;
  driverId: string;
  driverName: string;
  type: string;
  title: string;
  description: string;
  location?: string;
  priority: NotificationPriority;
  handlingStatus: NotificationHandlingStatus;
  timestamp: string;
  readAt?: string;
  respondedAt?: string;
  requiresRca?: boolean;
  stoppedDurationMinutes?: number;
  rcaDeadlineAt?: string;
  rcaSubmitted?: boolean;
  rcaEventId?: string;
  autoPunished?: boolean;
}

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  info: 'Informasi',
  warning: 'Warning',
  critical: 'Critical',
};

export const NOTIFICATION_PRIORITY_COLORS: Record<NotificationPriority, string> = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

export interface RewardTransaction {
  id: string;
  driverId: string;
  driverName: string;
  type: 'reward';
  points: number;
  reason: string;
  ruleId?: string;
  shipmentId?: string;
  createdAt: string;
  createdBy: string;
}

export interface PunishmentTransaction {
  id: string;
  driverId: string;
  driverName: string;
  type: 'punishment';
  points: number;
  reason: string;
  rcaEventId?: string;
  ruleId?: string;
  verifiedBefore: boolean;
  createdAt: string;
  createdBy: string;
}

export interface RewardRule {
  id: string;
  type: 'reward' | 'punishment';
  name: string;
  description: string;
  points: number;
  isActive: boolean;
  isAutomatic: boolean;
  category?: RCACategory;
  createdAt: string;
  updatedAt: string;
}

export type RewardStatus = 'menunggu_persetujuan' | 'disetujui' | 'sudah_diberikan';

export const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
  menunggu_persetujuan: 'Menunggu Persetujuan',
  disetujui: 'Disetujui',
  sudah_diberikan: 'Sudah Diberikan',
};

export interface DriverReward {
  id: string;
  driverId: string;
  driverName: string;
  achievementType: string;
  period: string;
  onTimeDeliveries: number;
  totalDeliveries: number;
  rewardPoints: number;
  rank: number;
  status: RewardStatus;
  approvedBy?: string;
  approvedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface DashboardStats {
  totalDrivers: number;
  totalActiveFleet: number;
  driversDelivering: number;
  driversWaitingUnload: number;
  driversResting: number;
  driversCompleted: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  otifPercentage: number;
  totalViolations: number;
  pendingVerification: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  value2?: number;
  label?: string;
}

