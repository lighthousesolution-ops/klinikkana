// Seed data for Aplikasi Servis HP - Klinik Kana
// Used to initialize localStorage on first load.

export const SEED_BRANCHES = [
  { id: 'br1', code: 'HQ',   name: 'Cabang Utama',   address: 'Jl. Merdeka No. 12, Jakarta',      phone: '021-1234567',   is_default: true,  created_at: '2025-01-05T09:00:00Z' },
  { id: 'br2', code: 'BDG',  name: 'Cabang Bandung', address: 'Jl. Asia Afrika No. 88, Bandung',  phone: '022-7654321',   is_default: false, created_at: '2025-01-05T09:00:00Z' },
];

export const SEED_USERS = [
  { id: 'u1', username: 'admin', password: 'admin123', full_name: 'Andi Wijaya', role: 'admin', phone: '081234567890', branch_id: null,  created_at: '2025-01-05T09:00:00Z' },
  { id: 'u2', username: 'teknisi',  password: 'teknisi123', full_name: 'Budi Santoso', role: 'technician', phone: '081298765432', branch_id: 'br1', created_at: '2025-01-05T09:00:00Z' },
  { id: 'u3', username: 'kasir',   password: 'kasir123', full_name: 'Citra Lestari', role: 'cashier', phone: '081345678901', branch_id: 'br1', created_at: '2025-01-05T09:00:00Z' },
  { id: 'u4', username: 'teknisi2', password: 'teknisi123', full_name: 'Dedi Kurniawan', role: 'technician', phone: '081456789012', branch_id: 'br2', created_at: '2025-01-06T09:00:00Z' },
];

export const SEED_CUSTOMERS = [
  { id: 'c1', name: 'Rina Marlina', phone: '081211112222', address: 'Jl. Merdeka No. 12, Jakarta', notes: 'Pelanggan tetap', branch_id: 'br1', created_at: '2025-01-08T10:00:00Z' },
  { id: 'c2', name: 'Fajar Nugroho', phone: '081233334444', address: 'Jl. Sudirman No. 45, Bandung', notes: '', branch_id: 'br2', created_at: '2025-01-09T11:00:00Z' },
  { id: 'c3', name: 'Siti Aminah', phone: '081255556666', address: 'Jl. Diponegoro No. 8, Surabaya', notes: 'Karyawan kantor', branch_id: 'br1', created_at: '2025-01-10T12:00:00Z' },
  { id: 'c4', name: 'Hendra Wirawan', phone: '081277778888', address: 'Jl. Gatot Subroto No. 22, Semarang', notes: '', branch_id: 'br2', created_at: '2025-01-11T13:00:00Z' },
  { id: 'c5', name: 'Maya Sari', phone: '081299990000', address: 'Jl. Ahmad Yani No. 5, Yogyakarta', notes: 'Rekomendasi teman', branch_id: 'br1', created_at: '2025-01-12T14:00:00Z' },
];

export const SEED_SPAREPARTS = [
  { id: 'sp1', name: 'LCD iPhone 11', sku: 'LCD-IP11', stock: 8, cost_price: 750000, selling_price: 1150000, low_stock_threshold: 3, category: 'Layar', branch_id: 'br1' },
  { id: 'sp2', name: 'LCD Samsung A50', sku: 'LCD-SA50', stock: 2, cost_price: 450000, selling_price: 750000, low_stock_threshold: 3, category: 'Layar', branch_id: 'br1' },
  { id: 'sp3', name: 'Baterai iPhone 8', sku: 'BAT-IP8', stock: 15, cost_price: 120000, selling_price: 250000, low_stock_threshold: 5, category: 'Baterai', branch_id: 'br1' },
  { id: 'sp4', name: 'Baterai Xiaomi Redmi 9', sku: 'BAT-RM9', stock: 12, cost_price: 100000, selling_price: 200000, low_stock_threshold: 5, category: 'Baterai', branch_id: 'br2' },
  { id: 'sp5', name: 'Konektor Charger Type-C', sku: 'KON-TYPEC', stock: 25, cost_price: 25000, selling_price: 75000, low_stock_threshold: 10, category: 'Konektor', branch_id: 'br1' },
  { id: 'sp6', name: 'Speaker Oppo A5s', sku: 'SPK-OA5S', stock: 1, cost_price: 45000, selling_price: 120000, low_stock_threshold: 3, category: 'Speaker', branch_id: 'br2' },
  { id: 'sp7', name: 'Tempered Glass Universal 6.5"', sku: 'TG-65', stock: 40, cost_price: 8000, selling_price: 35000, low_stock_threshold: 15, category: 'Aksesoris', branch_id: 'br1' },
  { id: 'sp8', name: 'Kabel Fleksibel Power iPhone X', sku: 'FLX-IPX', stock: 4, cost_price: 60000, selling_price: 175000, low_stock_threshold: 3, category: 'Fleksibel', branch_id: 'br2' },
];

const today = new Date();
const daysAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString();

export const SEED_REPAIRS = [
  {
    id: 'r1', ticket_no: 'KK-2501-001', customer_id: 'c1', branch_id: 'br1', device_brand: 'iPhone', device_model: 'iPhone 11', serial_no: 'IMEI:353821101234567',
    complaint: 'Layar retak, touchscreen tidak respons di sisi kanan', deposit: 300000, service_fee: 250000,
    status: 'picked_up', technician_id: 'u2', notes: 'LCD sudah diganti, semua fungsi normal.',
    parts_used: [{ sparepart_id: 'sp1', qty: 1, price: 1150000 }],
    created_at: daysAgo(28), updated_at: daysAgo(24), completed_at: daysAgo(25), picked_up_at: daysAgo(24),
  },
  {
    id: 'r2', ticket_no: 'KK-2501-002', customer_id: 'c2', branch_id: 'br2', device_brand: 'Samsung', device_model: 'Galaxy A50', serial_no: 'IMEI:354123459876543',
    complaint: 'Baterai boros, HP cepat panas', deposit: 100000, service_fee: 150000,
    status: 'picked_up', technician_id: 'u4', notes: 'Ganti baterai. Selesai.',
    parts_used: [],
    created_at: daysAgo(20), updated_at: daysAgo(18), completed_at: daysAgo(18), picked_up_at: daysAgo(17),
  },
  {
    id: 'r3', ticket_no: 'KK-2501-003', customer_id: 'c3', branch_id: 'br1', device_brand: 'Xiaomi', device_model: 'Redmi 9', serial_no: 'IMEI:867543219871234',
    complaint: 'Tidak bisa nyala, sudah dicoba charging tapi tidak masuk', deposit: 50000, service_fee: 200000,
    status: 'ready', technician_id: 'u2', notes: 'IC power diganti, sekarang normal.',
    parts_used: [{ sparepart_id: 'sp4', qty: 1, price: 200000 }],
    created_at: daysAgo(5), updated_at: daysAgo(2), completed_at: daysAgo(2),
  },
  {
    id: 'r4', ticket_no: 'KK-2501-004', customer_id: 'c4', branch_id: 'br2', device_brand: 'Oppo', device_model: 'Oppo A5s', serial_no: 'IMEI:355987651234876',
    complaint: 'Speaker pecah, suara serak saat volume tinggi', deposit: 75000, service_fee: 100000,
    status: 'in_progress', technician_id: 'u4', notes: 'Menunggu speaker sampai.',
    parts_used: [{ sparepart_id: 'sp6', qty: 1, price: 120000 }],
    created_at: daysAgo(3), updated_at: daysAgo(1),
  },
  {
    id: 'r5', ticket_no: 'KK-2501-005', customer_id: 'c5', branch_id: 'br1', device_brand: 'iPhone', device_model: 'iPhone 8', serial_no: 'IMEI:359876541230123',
    complaint: 'Baterai kembung, casing belakang mulai terangkat', deposit: 100000, service_fee: 150000,
    status: 'in_progress', technician_id: 'u2', notes: '',
    parts_used: [{ sparepart_id: 'sp3', qty: 1, price: 250000 }],
    created_at: daysAgo(2), updated_at: daysAgo(1),
  },
  {
    id: 'r6', ticket_no: 'KK-2501-006', customer_id: 'c1', branch_id: 'br1', device_brand: 'Samsung', device_model: 'Galaxy A50', serial_no: 'IMEI:354123459876544',
    complaint: 'Layar kedip-kedip, garis vertikal', deposit: 200000, service_fee: 150000,
    status: 'pending', technician_id: null, notes: '',
    parts_used: [],
    created_at: daysAgo(0), updated_at: daysAgo(0),
  },
  {
    id: 'r7', ticket_no: 'KK-2412-020', customer_id: 'c2', branch_id: 'br2', device_brand: 'iPhone', device_model: 'iPhone X', serial_no: 'IMEI:353333221100987',
    complaint: 'Tidak bisa charging', deposit: 100000, service_fee: 175000,
    status: 'picked_up', technician_id: 'u4', notes: 'Ganti flex charger.',
    parts_used: [{ sparepart_id: 'sp8', qty: 1, price: 175000 }],
    created_at: daysAgo(45), updated_at: daysAgo(42), completed_at: daysAgo(43), picked_up_at: daysAgo(42),
  },
  {
    id: 'r8', ticket_no: 'KK-2412-021', customer_id: 'c3', branch_id: 'br1', device_brand: 'Xiaomi', device_model: 'Redmi 9', serial_no: 'IMEI:867543219871235',
    complaint: 'Konektor charger longgar', deposit: 50000, service_fee: 100000,
    status: 'picked_up', technician_id: 'u2', notes: 'Ganti konektor.',
    parts_used: [{ sparepart_id: 'sp5', qty: 1, price: 75000 }],
    created_at: daysAgo(50), updated_at: daysAgo(48), completed_at: daysAgo(48), picked_up_at: daysAgo(47),
  },
];

export const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  ready: 'Ready for Pickup',
  picked_up: 'Picked Up',
};

export const STATUS_ORDER = ['pending', 'in_progress', 'ready', 'picked_up'];

export const ROLE_LABELS = {
  admin: 'Admin',
  technician: 'Teknisi',
  cashier: 'Kasir',
};
