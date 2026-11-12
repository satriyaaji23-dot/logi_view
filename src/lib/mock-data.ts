// ============================================================
// SILOG Driver Control Tower - Mock Data / Data Simulasi
// ============================================================

import {
  type Driver,
  type Shipment,
  type RCAEvent,
  type Notification,
  type RewardTransaction,
  type PunishmentTransaction,
  type RewardRule,
  type DriverReward,
  type Transporter,
  type DashboardStats,
  type ChartDataPoint,
  type User,
} from './types';

// ---- USERS ----
// Kredensial demo (hanya untuk simulasi, tanpa backend)
export const demoPasswords: Record<string, string> = {
  admin: 'admin123',
  supervisor: 'supervisor123',
  driver1: 'driver123',
  driver2: 'driver123',
};

export const mockUsers: User[] = [
  { id: 'U001', username: 'admin', name: 'Ahmad Fadillah', email: 'admin@silog.co.id', role: 'admin', createdAt: '2024-01-01' },
  { id: 'U002', username: 'supervisor', name: 'Budi Santoso', email: 'budi@silog.co.id', role: 'supervisor', createdAt: '2024-01-01' },
  { id: 'U003', username: 'driver1', name: 'Rizal Firmansyah', email: 'rizal@silog.co.id', role: 'driver', driverId: 'D001', createdAt: '2024-01-01' },
  { id: 'U004', username: 'driver2', name: 'Hendra Wijaya', email: 'hendra@silog.co.id', role: 'driver', driverId: 'D002', createdAt: '2024-01-01' },
];

// ---- TRANSPORTERS ----
export const mockTransporters: Transporter[] = [
  { id: 'T001', name: 'PT Angkutan Jaya', code: 'AJ', totalDrivers: 15, totalVehicles: 12 },
  { id: 'T002', name: 'CV Mitra Logistik', code: 'ML', totalDrivers: 10, totalVehicles: 8 },
  { id: 'T003', name: 'PT Transportasi Nusantara', code: 'TN', totalDrivers: 20, totalVehicles: 18 },
  { id: 'T004', name: 'PT Sinar Jaya Transport', code: 'SJT', totalDrivers: 12, totalVehicles: 10 },
  { id: 'T005', name: 'CV Ekspedisi Mandiri', code: 'EM', totalDrivers: 8, totalVehicles: 7 },
];

// ---- DRIVERS ----
export const mockDrivers: Driver[] = [
  {
    id: 'D001', name: 'Rizal Firmansyah', phone: '081234567890', licenseNumber: 'SIM-A-12345',
    transporterId: 'T001', transporterName: 'PT Angkutan Jaya', vehicleId: 'V001', vehiclePlate: 'L 1234 AB',
    status: 'dalam_perjalanan', totalDeliveries: 150, onTimeDeliveries: 138, lateDeliveries: 12,
    onTimePercentage: 92.0, totalRewardPoints: 1380, totalPunishmentPoints: 96, finalScore: 1284,
    validViolations: 3, joinDate: '2023-01-15',
  },
  {
    id: 'D002', name: 'Hendra Wijaya', phone: '081234567891', licenseNumber: 'SIM-A-12346',
    transporterId: 'T001', transporterName: 'PT Angkutan Jaya', vehicleId: 'V002', vehiclePlate: 'L 5678 CD',
    status: 'proses_bongkar_muat', totalDeliveries: 130, onTimeDeliveries: 125, lateDeliveries: 5,
    onTimePercentage: 96.2, totalRewardPoints: 1250, totalPunishmentPoints: 40, finalScore: 1210,
    validViolations: 1, joinDate: '2023-02-01',
  },
  {
    id: 'D003', name: 'Agus Setiawan', phone: '081234567892', licenseNumber: 'SIM-A-12347',
    transporterId: 'T002', transporterName: 'CV Mitra Logistik', vehicleId: 'V003', vehiclePlate: 'W 9012 EF',
    status: 'selesai_pengiriman', totalDeliveries: 175, onTimeDeliveries: 168, lateDeliveries: 7,
    onTimePercentage: 96.0, totalRewardPoints: 1680, totalPunishmentPoints: 56, finalScore: 1624,
    validViolations: 2, joinDate: '2022-06-15',
  },
  {
    id: 'D004', name: 'Slamet Raharjo', phone: '081234567893', licenseNumber: 'SIM-A-12348',
    transporterId: 'T002', transporterName: 'CV Mitra Logistik', vehicleId: 'V004', vehiclePlate: 'W 3456 GH',
    status: 'istirahat', totalDeliveries: 95, onTimeDeliveries: 80, lateDeliveries: 15,
    onTimePercentage: 84.2, totalRewardPoints: 800, totalPunishmentPoints: 120, finalScore: 680,
    validViolations: 5, joinDate: '2023-06-01',
  },
  {
    id: 'D005', name: 'Dedi Kurniawan', phone: '081234567894', licenseNumber: 'SIM-A-12349',
    transporterId: 'T003', transporterName: 'PT Transportasi Nusantara', vehicleId: 'V005', vehiclePlate: 'N 7890 IJ',
    status: 'dalam_perjalanan', totalDeliveries: 200, onTimeDeliveries: 190, lateDeliveries: 10,
    onTimePercentage: 95.0, totalRewardPoints: 1900, totalPunishmentPoints: 80, finalScore: 1820,
    validViolations: 2, joinDate: '2022-03-01',
  },
  {
    id: 'D006', name: 'Wahyu Hidayat', phone: '081234567895', licenseNumber: 'SIM-A-12350',
    transporterId: 'T003', transporterName: 'PT Transportasi Nusantara', vehicleId: 'V006', vehiclePlate: 'N 1122 KL',
    status: 'antre_bbm', totalDeliveries: 110, onTimeDeliveries: 98, lateDeliveries: 12,
    onTimePercentage: 89.1, totalRewardPoints: 980, totalPunishmentPoints: 96, finalScore: 884,
    validViolations: 4, joinDate: '2023-04-01',
  },
  {
    id: 'D007', name: 'Eko Prasetyo', phone: '081234567896', licenseNumber: 'SIM-A-12351',
    transporterId: 'T004', transporterName: 'PT Sinar Jaya Transport', vehicleId: 'V007', vehiclePlate: 'S 3344 MN',
    status: 'menunggu_gudang', totalDeliveries: 160, onTimeDeliveries: 152, lateDeliveries: 8,
    onTimePercentage: 95.0, totalRewardPoints: 1520, totalPunishmentPoints: 64, finalScore: 1456,
    validViolations: 2, joinDate: '2022-09-01',
  },
  {
    id: 'D008', name: 'Joko Susanto', phone: '081234567897', licenseNumber: 'SIM-A-12352',
    transporterId: 'T004', transporterName: 'PT Sinar Jaya Transport', vehicleId: 'V008', vehiclePlate: 'S 5566 OP',
    status: 'kendala_operasional', totalDeliveries: 85, onTimeDeliveries: 70, lateDeliveries: 15,
    onTimePercentage: 82.4, totalRewardPoints: 700, totalPunishmentPoints: 120, finalScore: 580,
    validViolations: 6, joinDate: '2023-08-01',
  },
  {
    id: 'D009', name: 'Bambang Suryadi', phone: '081234567898', licenseNumber: 'SIM-A-12353',
    transporterId: 'T005', transporterName: 'CV Ekspedisi Mandiri', vehicleId: 'V009', vehiclePlate: 'AG 7788 QR',
    status: 'persiapan_pengiriman', totalDeliveries: 140, onTimeDeliveries: 130, lateDeliveries: 10,
    onTimePercentage: 92.9, totalRewardPoints: 1300, totalPunishmentPoints: 80, finalScore: 1220,
    validViolations: 3, joinDate: '2022-12-01',
  },
  {
    id: 'D010', name: 'Indra Permana', phone: '081234567899', licenseNumber: 'SIM-A-12354',
    transporterId: 'T005', transporterName: 'CV Ekspedisi Mandiri', vehicleId: 'V010', vehiclePlate: 'AG 9900 ST',
    status: 'dalam_perjalanan', totalDeliveries: 120, onTimeDeliveries: 115, lateDeliveries: 5,
    onTimePercentage: 95.8, totalRewardPoints: 1150, totalPunishmentPoints: 40, finalScore: 1110,
    validViolations: 1, joinDate: '2023-03-01',
  },
  {
    id: 'D011', name: 'Fajar Nugroho', phone: '081234567800', licenseNumber: 'SIM-A-12355',
    transporterId: 'T001', transporterName: 'PT Angkutan Jaya', vehicleId: 'V011', vehiclePlate: 'L 1100 UV',
    status: 'rilisan', totalDeliveries: 90, onTimeDeliveries: 82, lateDeliveries: 8,
    onTimePercentage: 91.1, totalRewardPoints: 820, totalPunishmentPoints: 64, finalScore: 756,
    validViolations: 2, joinDate: '2023-09-01',
  },
  {
    id: 'D012', name: 'Gunawan Wibowo', phone: '081234567801', licenseNumber: 'SIM-A-12356',
    transporterId: 'T003', transporterName: 'PT Transportasi Nusantara', vehicleId: 'V012', vehiclePlate: 'N 2200 WX',
    status: 'dalam_perjalanan', totalDeliveries: 180, onTimeDeliveries: 175, lateDeliveries: 5,
    onTimePercentage: 97.2, totalRewardPoints: 1750, totalPunishmentPoints: 40, finalScore: 1710,
    validViolations: 1, joinDate: '2022-01-15',
  },
];

// ---- SHIPMENTS ----
export const mockShipments: Shipment[] = [
  {
    id: 'SH001', suratJalanNo: 'SJ-2024-001', driverId: 'D001', driverName: 'Rizal Firmansyah',
    vehiclePlate: 'L 1234 AB', transporterName: 'PT Angkutan Jaya',
    origin: 'Pabrik Tuban', destination: 'Gudang Surabaya',
    departureTime: '2024-11-10T06:00:00', estimatedArrival: '2024-11-10T12:00:00',
    status: 'in_progress', driverStatus: 'dalam_perjalanan',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 40, travelDuration: '4j 30m',
  },
  {
    id: 'SH002', suratJalanNo: 'SJ-2024-002', driverId: 'D002', driverName: 'Hendra Wijaya',
    vehiclePlate: 'L 5678 CD', transporterName: 'PT Angkutan Jaya',
    origin: 'Pabrik Gresik', destination: 'Gudang Malang',
    departureTime: '2024-11-10T05:30:00', estimatedArrival: '2024-11-10T11:30:00',
    actualArrival: '2024-11-10T11:15:00',
    status: 'in_progress', driverStatus: 'proses_bongkar_muat',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 35, quantityReceived: 35, travelDuration: '5j 45m',
  },
  {
    id: 'SH003', suratJalanNo: 'SJ-2024-003', driverId: 'D003', driverName: 'Agus Setiawan',
    vehiclePlate: 'W 9012 EF', transporterName: 'CV Mitra Logistik',
    origin: 'Pabrik Tuban', destination: 'Gudang Kediri',
    departureTime: '2024-11-10T04:00:00', estimatedArrival: '2024-11-10T10:00:00',
    actualArrival: '2024-11-10T09:45:00',
    status: 'completed', driverStatus: 'selesai_pengiriman',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 30, quantityReceived: 30, travelDuration: '5j 45m',
  },
  {
    id: 'SH004', suratJalanNo: 'SJ-2024-004', driverId: 'D004', driverName: 'Slamet Raharjo',
    vehiclePlate: 'W 3456 GH', transporterName: 'CV Mitra Logistik',
    origin: 'Pabrik Gresik', destination: 'Gudang Jember',
    departureTime: '2024-11-10T03:00:00', estimatedArrival: '2024-11-10T11:00:00',
    status: 'in_progress', driverStatus: 'istirahat',
    isOnTime: false, isInFull: true, isOTIF: false,
    quantity: 25, travelDuration: '7j 15m',
  },
  {
    id: 'SH005', suratJalanNo: 'SJ-2024-005', driverId: 'D005', driverName: 'Dedi Kurniawan',
    vehiclePlate: 'N 7890 IJ', transporterName: 'PT Transportasi Nusantara',
    origin: 'Pabrik Tuban', destination: 'Gudang Semarang',
    departureTime: '2024-11-10T02:00:00', estimatedArrival: '2024-11-10T10:00:00',
    status: 'in_progress', driverStatus: 'dalam_perjalanan',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 40, travelDuration: '6j 30m',
  },
  {
    id: 'SH006', suratJalanNo: 'SJ-2024-006', driverId: 'D006', driverName: 'Wahyu Hidayat',
    vehiclePlate: 'N 1122 KL', transporterName: 'PT Transportasi Nusantara',
    origin: 'Pabrik Gresik', destination: 'Gudang Madiun',
    departureTime: '2024-11-10T05:00:00', estimatedArrival: '2024-11-10T11:00:00',
    status: 'in_progress', driverStatus: 'antre_bbm',
    isOnTime: false, isInFull: true, isOTIF: false,
    quantity: 30, travelDuration: '5j 00m',
  },
  {
    id: 'SH007', suratJalanNo: 'SJ-2024-007', driverId: 'D007', driverName: 'Eko Prasetyo',
    vehiclePlate: 'S 3344 MN', transporterName: 'PT Sinar Jaya Transport',
    origin: 'Pabrik Tuban', destination: 'Gudang Blitar',
    departureTime: '2024-11-10T04:30:00', estimatedArrival: '2024-11-10T10:30:00',
    status: 'in_progress', driverStatus: 'menunggu_gudang',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 35, travelDuration: '5j 15m',
  },
  {
    id: 'SH008', suratJalanNo: 'SJ-2024-008', driverId: 'D008', driverName: 'Joko Susanto',
    vehiclePlate: 'S 5566 OP', transporterName: 'PT Sinar Jaya Transport',
    origin: 'Pabrik Gresik', destination: 'Gudang Banyuwangi',
    departureTime: '2024-11-10T01:00:00', estimatedArrival: '2024-11-10T09:00:00',
    status: 'in_progress', driverStatus: 'kendala_operasional',
    isOnTime: false, isInFull: true, isOTIF: false,
    quantity: 30, travelDuration: '8j 30m', notes: 'Ban pecah di tol',
  },
  {
    id: 'SH009', suratJalanNo: 'SJ-2024-009', driverId: 'D009', driverName: 'Bambang Suryadi',
    vehiclePlate: 'AG 7788 QR', transporterName: 'CV Ekspedisi Mandiri',
    origin: 'Pabrik Tuban', destination: 'Gudang Nganjuk',
    departureTime: '2024-11-10T07:00:00', estimatedArrival: '2024-11-10T12:00:00',
    status: 'pending', driverStatus: 'persiapan_pengiriman',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 25,
  },
  {
    id: 'SH010', suratJalanNo: 'SJ-2024-010', driverId: 'D010', driverName: 'Indra Permana',
    vehiclePlate: 'AG 9900 ST', transporterName: 'CV Ekspedisi Mandiri',
    origin: 'Pabrik Gresik', destination: 'Gudang Ponorogo',
    departureTime: '2024-11-10T03:30:00', estimatedArrival: '2024-11-10T10:30:00',
    status: 'in_progress', driverStatus: 'dalam_perjalanan',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 30, travelDuration: '5j 45m',
  },
  {
    id: 'SH011', suratJalanNo: 'SJ-2024-011', driverId: 'D011', driverName: 'Fajar Nugroho',
    vehiclePlate: 'L 1100 UV', transporterName: 'PT Angkutan Jaya',
    origin: 'Pabrik Tuban', destination: 'Gudang Lamongan',
    departureTime: '2024-11-10T06:30:00', estimatedArrival: '2024-11-10T09:30:00',
    status: 'in_progress', driverStatus: 'rilisan',
    isOnTime: false, isInFull: true, isOTIF: false,
    quantity: 20, travelDuration: '3j 00m',
  },
  {
    id: 'SH012', suratJalanNo: 'SJ-2024-012', driverId: 'D012', driverName: 'Gunawan Wibowo',
    vehiclePlate: 'N 2200 WX', transporterName: 'PT Transportasi Nusantara',
    origin: 'Pabrik Tuban', destination: 'Gudang Mojokerto',
    departureTime: '2024-11-10T05:00:00', estimatedArrival: '2024-11-10T09:00:00',
    status: 'in_progress', driverStatus: 'dalam_perjalanan',
    isOnTime: true, isInFull: true, isOTIF: true,
    quantity: 35, travelDuration: '3j 30m',
  },
];

// ---- RCA EVENTS ----
export const mockRCAEvents: RCAEvent[] = [
  {
    id: 'RCA001', driverId: 'D004', driverName: 'Slamet Raharjo', vehiclePlate: 'W 3456 GH',
    eventDate: '2024-11-08', eventTime: '14:30', category: 'parkir_lama',
    location: 'Rest Area KM 45 Tol Surabaya-Gresik', duration: '2 jam 30 menit',
    description: 'Driver parkir terlalu lama tanpa konfirmasi ke Control Tower. Tidak ada update status di aplikasi.',
    verificationStatus: 'terverifikasi_pelanggaran', controlTowerDecision: 'Pelanggaran - poin dikurangi',
    verifiedBy: 'Ahmad Fadillah', verifiedAt: '2024-11-08T16:00:00',
    isExternalCause: false, pointsDeducted: 8, createdAt: '2024-11-08T14:30:00',
  },
  {
    id: 'RCA002', driverId: 'D008', driverName: 'Joko Susanto', vehiclePlate: 'S 5566 OP',
    eventDate: '2024-11-09', eventTime: '09:15', category: 'truk_rusak',
    location: 'Tol Surabaya-Gempol KM 23', duration: '3 jam',
    description: 'Ban belakang pecah saat di tol. Driver menghubungi mekanik dan menunggu perbaikan.',
    verificationStatus: 'dikecualikan', controlTowerDecision: 'Kendala teknis - tidak ada pelanggaran driver',
    verifiedBy: 'Ahmad Fadillah', verifiedAt: '2024-11-09T12:00:00',
    isExternalCause: true, createdAt: '2024-11-09T09:15:00',
  },
  {
    id: 'RCA003', driverId: 'D006', driverName: 'Wahyu Hidayat', vehiclePlate: 'N 1122 KL',
    eventDate: '2024-11-10', eventTime: '08:00', category: 'antre_solar',
    location: 'SPBU 44.571.10 Tuban', duration: '45 menit',
    description: 'Antrian panjang di SPBU, driver menunggu giliran pengisian BBM.',
    verificationStatus: 'dikecualikan', controlTowerDecision: 'Kendala eksternal - antrean SPBU',
    verifiedBy: 'Ahmad Fadillah', verifiedAt: '2024-11-10T09:00:00',
    isExternalCause: true, createdAt: '2024-11-10T08:00:00',
  },
  {
    id: 'RCA004', driverId: 'D011', driverName: 'Fajar Nugroho', vehiclePlate: 'L 1100 UV',
    eventDate: '2024-11-10', eventTime: '10:00', category: 'rilisan',
    location: 'Gudang Lamongan', duration: '1 jam 30 menit',
    description: 'Gudang tujuan penuh, driver menunggu rilisan untuk bisa bongkar muat.',
    verificationStatus: 'dikecualikan', controlTowerDecision: 'Kendala gudang - bukan kesalahan driver',
    verifiedBy: 'Budi Santoso', verifiedAt: '2024-11-10T11:30:00',
    isExternalCause: true, createdAt: '2024-11-10T10:00:00',
  },
  {
    id: 'RCA005', driverId: 'D004', driverName: 'Slamet Raharjo', vehiclePlate: 'W 3456 GH',
    eventDate: '2024-11-10', eventTime: '11:00', category: 'aplikasi_tidak_geser',
    location: 'Dalam Perjalanan Gresik-Jember', duration: '-',
    description: 'Driver tidak update status di aplikasi selama 2 jam. Setelah dikonfirmasi, driver mengaku lupa.',
    verificationStatus: 'terverifikasi_pelanggaran', controlTowerDecision: 'Pelanggaran - lalai update aplikasi',
    verifiedBy: 'Ahmad Fadillah', verifiedAt: '2024-11-10T13:00:00',
    isExternalCause: false, pointsDeducted: 5, createdAt: '2024-11-10T11:00:00',
  },
  {
    id: 'RCA006', driverId: 'D001', driverName: 'Rizal Firmansyah', vehiclePlate: 'L 1234 AB',
    eventDate: '2024-11-09', eventTime: '15:00', category: 'jadwal_bongkar',
    location: 'Gudang Surabaya', duration: '1 jam',
    description: 'Jadwal bongkar muat tertunda karena kapasitas gudang penuh.',
    verificationStatus: 'dikecualikan',
    isExternalCause: true, createdAt: '2024-11-09T15:00:00',
  },
  {
    id: 'RCA007', driverId: 'D008', driverName: 'Joko Susanto', vehiclePlate: 'S 5566 OP',
    eventDate: '2024-11-10', eventTime: '07:00', category: 'parkir_lama',
    location: 'Rest Area KM 78', duration: '1 jam 45 menit',
    description: 'Driver berhenti terlalu lama. Saat dikonfirmasi alasan kurang valid.',
    verificationStatus: 'menunggu_verifikasi',
    isExternalCause: false, createdAt: '2024-11-10T07:00:00',
  },
  {
    id: 'RCA008', driverId: 'D006', driverName: 'Wahyu Hidayat', vehiclePlate: 'N 1122 KL',
    eventDate: '2024-11-07', eventTime: '12:00', category: 'laka_lantas',
    location: 'Jalan Raya Tuban KM 15', duration: '4 jam',
    description: 'Terlibat kecelakaan ringan dengan kendaraan lain. Proses administrasi kepolisian.',
    verificationStatus: 'dikecualikan', controlTowerDecision: 'Kecelakaan lalu lintas - kendala eksternal',
    verifiedBy: 'Ahmad Fadillah', verifiedAt: '2024-11-07T16:00:00',
    isExternalCause: true, createdAt: '2024-11-07T12:00:00',
  },
  {
    id: 'RCA009', driverId: 'D009', driverName: 'Bambang Suryadi', vehiclePlate: 'AG 7788 QR',
    eventDate: '2024-11-06', eventTime: '09:30', category: 'kendala_gps',
    location: 'Dalam Perjalanan', duration: '30 menit',
    description: 'GPS device error, tidak menampilkan posisi. Driver sudah lapor dan restart perangkat.',
    verificationStatus: 'dikecualikan',
    isExternalCause: true, createdAt: '2024-11-06T09:30:00',
  },
  {
    id: 'RCA010', driverId: 'D012', driverName: 'Gunawan Wibowo', vehiclePlate: 'N 2200 WX',
    eventDate: '2024-11-10', eventTime: '06:30', category: 'ls_level_stock',
    location: 'Pabrik Tuban', duration: '2 jam',
    description: 'Level stock gudang tujuan sudah penuh sejak pagi. Pengiriman ditunda menunggu rilisan.',
    verificationStatus: 'sedang_diperiksa',
    isExternalCause: true, createdAt: '2024-11-10T06:30:00',
  },
];

// ---- NOTIFICATIONS ----
export const mockNotifications: Notification[] = [
  {
    id: 'N001', driverId: 'D004', driverName: 'Slamet Raharjo', type: 'late_update',
    title: 'Driver Belum Update Status', description: 'Driver belum update status selama 2 jam terakhir.',
    location: 'Gresik - Jember', priority: 'warning', handlingStatus: 'sedang_ditangani',
    timestamp: '2024-11-10T11:00:00',
  },
  {
    id: 'N002', driverId: 'D008', driverName: 'Joko Susanto', type: 'breakdown',
    title: 'Kendala Operasional - Ban Pecah', description: 'Driver melaporkan ban belakang pecah di tol Surabaya-Gempol.',
    location: 'Tol Surabaya-Gempol KM 23', priority: 'critical', handlingStatus: 'sedang_ditangani',
    timestamp: '2024-11-10T08:30:00',
  },
  {
    id: 'N003', driverId: 'D006', driverName: 'Wahyu Hidayat', type: 'fuel_queue',
    title: 'Antre Pengisian BBM', description: 'Driver menginformasikan sedang mengantre BBM di SPBU.',
    location: 'SPBU 44.571.10 Tuban', priority: 'info', handlingStatus: 'selesai',
    timestamp: '2024-11-10T08:00:00',
  },
  {
    id: 'N004', driverId: 'D003', driverName: 'Agus Setiawan', type: 'delivery_complete',
    title: 'Pengiriman Selesai', description: 'Driver telah menyelesaikan pengiriman ke Gudang Kediri.',
    location: 'Gudang Kediri', priority: 'info', handlingStatus: 'selesai',
    timestamp: '2024-11-10T09:45:00',
  },
  {
    id: 'N005', driverId: 'D007', driverName: 'Eko Prasetyo', type: 'waiting_warehouse',
    title: 'Menunggu Gudang', description: 'Driver menunggu giliran bongkar muat di gudang tujuan.',
    location: 'Gudang Blitar', priority: 'info', handlingStatus: 'belum_ditangani',
    timestamp: '2024-11-10T10:15:00',
  },
  {
    id: 'N006', driverId: 'D011', driverName: 'Fajar Nugroho', type: 'waiting_warehouse',
    title: 'Rilisan - Gudang Penuh', description: 'Gudang Lamongan penuh, driver menunggu rilisan.',
    location: 'Gudang Lamongan', priority: 'warning', handlingStatus: 'sedang_ditangani',
    timestamp: '2024-11-10T10:00:00',
  },
  {
    id: 'N007', driverId: 'D001', driverName: 'Rizal Firmansyah', type: 'long_stop',
    title: 'Driver Berhenti Terlalu Lama', description: 'Driver terdeteksi berhenti lebih dari 1 jam tanpa update status.',
    location: 'Rest Area KM 30 Tol', priority: 'warning', handlingStatus: 'belum_ditangani',
    timestamp: '2024-11-10T10:30:00',
  },
  {
    id: 'N008', driverId: 'D005', driverName: 'Dedi Kurniawan', type: 'late_arrival',
    title: 'Estimasi Terlambat', description: 'Driver diperkirakan terlambat 30 menit dari estimasi waktu tiba.',
    location: 'Dalam perjalanan ke Semarang', priority: 'warning', handlingStatus: 'belum_ditangani',
    timestamp: '2024-11-10T09:30:00',
  },
];

// ---- REWARD RULES ----
export const mockRewardRules: RewardRule[] = [
  { id: 'RR001', type: 'reward', name: 'Pengiriman Tepat Waktu', description: 'Poin diberikan untuk setiap pengiriman yang tiba tepat waktu atau lebih awal.', points: 10, isActive: true, isAutomatic: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'RR002', type: 'reward', name: 'Target Bulanan Tercapai', description: 'Bonus poin jika target ketepatan waktu bulanan ≥ 95% tercapai.', points: 50, isActive: true, isAutomatic: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'RR003', type: 'reward', name: 'Zero Pelanggaran Bulanan', description: 'Bonus poin jika tidak memiliki pelanggaran valid selama 1 bulan.', points: 30, isActive: true, isAutomatic: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'RR004', type: 'punishment', name: 'Parkir Lama Tanpa Konfirmasi', description: 'Poin dikurangi jika driver parkir lama tanpa alasan valid dan sudah terbukti.', points: 8, isActive: true, isAutomatic: false, category: 'parkir_lama', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'RR005', type: 'punishment', name: 'Tidak Menggeser Aplikasi', description: 'Poin dikurangi jika driver tidak update status di aplikasi tanpa alasan valid.', points: 5, isActive: true, isAutomatic: false, category: 'aplikasi_tidak_geser', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'RR006', type: 'punishment', name: 'Berhenti Lama Tanpa Alasan', description: 'Poin dikurangi jika driver berhenti terlalu lama tanpa alasan yang valid.', points: 5, isActive: true, isAutomatic: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
];

// ---- REWARD & PUNISHMENT TRANSACTIONS ----
export const mockRewardTransactions: RewardTransaction[] = [
  { id: 'RT001', driverId: 'D005', driverName: 'Dedi Kurniawan', type: 'reward', points: 10, reason: 'Pengiriman SJ-2024-005 tepat waktu', shipmentId: 'SH005', createdAt: '2024-11-10T10:00:00', createdBy: 'System' },
  { id: 'RT002', driverId: 'D003', driverName: 'Agus Setiawan', type: 'reward', points: 10, reason: 'Pengiriman SJ-2024-003 tepat waktu', shipmentId: 'SH003', createdAt: '2024-11-10T09:45:00', createdBy: 'System' },
  { id: 'RT003', driverId: 'D002', driverName: 'Hendra Wijaya', type: 'reward', points: 10, reason: 'Pengiriman SJ-2024-002 tepat waktu', shipmentId: 'SH002', createdAt: '2024-11-10T11:15:00', createdBy: 'System' },
  { id: 'RT004', driverId: 'D012', driverName: 'Gunawan Wibowo', type: 'reward', points: 50, reason: 'Target bulanan Oktober ≥ 95% tercapai', createdAt: '2024-11-01T00:00:00', createdBy: 'System' },
  { id: 'RT005', driverId: 'D005', driverName: 'Dedi Kurniawan', type: 'reward', points: 30, reason: 'Zero pelanggaran bulan Oktober', createdAt: '2024-11-01T00:00:00', createdBy: 'System' },
];

export const mockPunishmentTransactions: PunishmentTransaction[] = [
  { id: 'PT001', driverId: 'D004', driverName: 'Slamet Raharjo', type: 'punishment', points: 8, reason: 'Parkir lama tanpa konfirmasi - RCA001', rcaEventId: 'RCA001', verifiedBefore: true, createdAt: '2024-11-08T16:00:00', createdBy: 'Ahmad Fadillah' },
  { id: 'PT002', driverId: 'D004', driverName: 'Slamet Raharjo', type: 'punishment', points: 5, reason: 'Tidak update status aplikasi - RCA005', rcaEventId: 'RCA005', verifiedBefore: true, createdAt: '2024-11-10T13:00:00', createdBy: 'Ahmad Fadillah' },
  { id: 'PT003', driverId: 'D008', driverName: 'Joko Susanto', type: 'punishment', points: 5, reason: 'Berhenti lama tanpa alasan valid', rcaEventId: 'RCA007', verifiedBefore: true, createdAt: '2024-11-09T10:00:00', createdBy: 'Ahmad Fadillah' },
];

// ---- DRIVER REWARDS ----
export const mockDriverRewards: DriverReward[] = [
  { id: 'DR001', driverId: 'D005', driverName: 'Dedi Kurniawan', achievementType: 'Driver Terbaik Bulanan', period: 'Oktober 2024', onTimeDeliveries: 25, totalDeliveries: 26, rewardPoints: 80, rank: 1, status: 'sudah_diberikan', approvedBy: 'Ahmad Fadillah', approvedAt: '2024-11-02' },
  { id: 'DR002', driverId: 'D012', driverName: 'Gunawan Wibowo', achievementType: 'On Time Tertinggi', period: 'Oktober 2024', onTimeDeliveries: 24, totalDeliveries: 24, rewardPoints: 50, rank: 1, status: 'disetujui', approvedBy: 'Ahmad Fadillah', approvedAt: '2024-11-02' },
  { id: 'DR003', driverId: 'D002', driverName: 'Hendra Wijaya', achievementType: 'Pelanggaran Terendah', period: 'Oktober 2024', onTimeDeliveries: 22, totalDeliveries: 23, rewardPoints: 30, rank: 2, status: 'menunggu_persetujuan' },
  { id: 'DR004', driverId: 'D003', driverName: 'Agus Setiawan', achievementType: 'Driver Paling Konsisten', period: 'Oktober 2024', onTimeDeliveries: 23, totalDeliveries: 24, rewardPoints: 40, rank: 3, status: 'menunggu_persetujuan' },
];

// ---- DASHBOARD STATS ----
export const mockDashboardStats: DashboardStats = {
  totalDrivers: 12,
  totalActiveFleet: 12,
  driversDelivering: 4,
  driversWaitingUnload: 2,
  driversResting: 1,
  driversCompleted: 1,
  onTimeDeliveries: 8,
  lateDeliveries: 4,
  otifPercentage: 66.7,
  totalViolations: 8,
  pendingVerification: 2,
};

// ---- CHART DATA ----
export const otifDailyData: ChartDataPoint[] = [
  { name: '4 Nov', value: 88, label: '88%' },
  { name: '5 Nov', value: 92, label: '92%' },
  { name: '6 Nov', value: 85, label: '85%' },
  { name: '7 Nov', value: 90, label: '90%' },
  { name: '8 Nov', value: 78, label: '78%' },
  { name: '9 Nov', value: 94, label: '94%' },
  { name: '10 Nov', value: 87, label: '87%' },
];

export const otifMonthlyData: ChartDataPoint[] = [
  { name: 'Jun', value: 82 },
  { name: 'Jul', value: 85 },
  { name: 'Agu', value: 88 },
  { name: 'Sep', value: 86 },
  { name: 'Okt', value: 91 },
  { name: 'Nov', value: 87 },
];

export const onTimeVsLateData: ChartDataPoint[] = [
  { name: 'Sen', value: 15, value2: 3 },
  { name: 'Sel', value: 18, value2: 2 },
  { name: 'Rab', value: 14, value2: 4 },
  { name: 'Kam', value: 16, value2: 3 },
  { name: 'Jum', value: 20, value2: 1 },
  { name: 'Sab', value: 12, value2: 2 },
  { name: 'Min', value: 8, value2: 4 },
];

export const rcaCausesData: ChartDataPoint[] = [
  { name: 'Parkir Lama', value: 8 },
  { name: 'Rilisan', value: 6 },
  { name: 'Truk Rusak', value: 4 },
  { name: 'Antre Solar', value: 5 },
  { name: 'Apk Tdk Geser', value: 3 },
  { name: 'Laka Lantas', value: 2 },
  { name: 'Kendala GPS', value: 3 },
  { name: 'Lainnya', value: 4 },
];

export const violationCategoryData: ChartDataPoint[] = [
  { name: 'Parkir Lama', value: 5 },
  { name: 'Apk Tdk Geser', value: 3 },
  { name: 'Berhenti Lama', value: 4 },
  { name: 'Driver Izin', value: 1 },
];

export const driverPerformanceData: ChartDataPoint[] = [
  { name: 'D.Kurniawan', value: 95 },
  { name: 'G.Wibowo', value: 97 },
  { name: 'H.Wijaya', value: 96 },
  { name: 'A.Setiawan', value: 96 },
  { name: 'E.Prasetyo', value: 95 },
  { name: 'I.Permana', value: 96 },
  { name: 'R.Firmansyah', value: 92 },
  { name: 'B.Suryadi', value: 93 },
  { name: 'F.Nugroho', value: 91 },
  { name: 'W.Hidayat', value: 89 },
  { name: 'S.Raharjo', value: 84 },
  { name: 'J.Susanto', value: 82 },
];

