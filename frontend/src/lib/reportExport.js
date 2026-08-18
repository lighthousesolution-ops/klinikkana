/**
 * Report exporter — Excel (xlsx) & PDF (jsPDF + autoTable).
 * Focused on monthly repair reports for tax/accounting.
 */
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatIDR, formatDate } from '@/lib/utils';
import { STATUS_LABELS } from '@/lib/mockData';
import { computeTotal } from '@/lib/store';

function monthLabel(year, monthIdx) {
  return new Date(year, monthIdx, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function buildRows({ repairs, customers, spareparts, branches, technicians }) {
  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const spMap = Object.fromEntries(spareparts.map((s) => [s.id, s]));
  const brMap = Object.fromEntries(branches.map((b) => [b.id, b]));
  const techMap = Object.fromEntries(technicians.map((t) => [t.id, t]));
  return repairs.map((r) => {
    const totals = computeTotal(r);
    const partCost = (r.parts_used || []).reduce((s, p) => {
      const sp = spMap[p.sparepart_id];
      return s + (sp ? sp.cost_price * p.qty : 0);
    }, 0);
    const partsDesc = (r.parts_used || [])
      .map((p) => `${spMap[p.sparepart_id]?.name || 'Sparepart'} x${p.qty}`)
      .join('; ') || '—';
    return {
      tanggal_selesai: r.picked_up_at ? formatDate(r.picked_up_at) : '—',
      tanggal_masuk: formatDate(r.created_at),
      tiket: r.ticket_no,
      cabang: brMap[r.branch_id]?.name || '—',
      pelanggan: custMap[r.customer_id]?.name || '—',
      hp: custMap[r.customer_id]?.phone || '—',
      perangkat: `${r.device_brand} ${r.device_model}`.trim(),
      keluhan: r.complaint || '',
      teknisi: techMap[r.technician_id]?.full_name || '—',
      status: STATUS_LABELS[r.status] || r.status,
      jasa: Number(r.service_fee) || 0,
      sparepart: (r.parts_used || []).reduce((s, p) => s + p.qty * p.price, 0),
      total: totals.total,
      dp: totals.deposit,
      cicilan: totals.payments_total || 0,
      sisa: Math.max(0, totals.balance),
      biaya_sparepart: partCost,
      laba: totals.total - partCost,
      parts_detail: partsDesc,
    };
  });
}

function computeSummary(rows) {
  return rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      jasa: a.jasa + r.jasa,
      sparepart: a.sparepart + r.sparepart,
      biaya_sparepart: a.biaya_sparepart + r.biaya_sparepart,
      laba: a.laba + r.laba,
      dp: a.dp + r.dp,
      cicilan: a.cicilan + r.cicilan,
      sisa: a.sisa + r.sisa,
      tickets: a.tickets + 1,
    }),
    { total: 0, jasa: 0, sparepart: 0, biaya_sparepart: 0, laba: 0, dp: 0, cicilan: 0, sisa: 0, tickets: 0 },
  );
}

/**
 * Export monthly report to XLSX.
 * @param {object} ctx — { year, month, shopName, branchName, ...data }
 */
export function exportMonthlyExcel(ctx) {
  const rows = buildRows(ctx);
  const summary = computeSummary(rows);
  const monthName = monthLabel(ctx.year, ctx.month);

  // ---------------- Sheet: Detail ----------------
  const detailHeader = [
    'Tgl Selesai', 'Tgl Masuk', 'No. Tiket', 'Cabang', 'Pelanggan', 'HP', 'Perangkat',
    'Keluhan', 'Teknisi', 'Status', 'Jasa (Rp)', 'Sparepart (Rp)', 'Total (Rp)',
    'DP (Rp)', 'Cicilan (Rp)', 'Sisa (Rp)', 'Biaya Sparepart (Rp)', 'Laba (Rp)', 'Detail Sparepart',
  ];
  const detailRows = rows.map((r) => [
    r.tanggal_selesai, r.tanggal_masuk, r.tiket, r.cabang, r.pelanggan, r.hp, r.perangkat,
    r.keluhan, r.teknisi, r.status, r.jasa, r.sparepart, r.total,
    r.dp, r.cicilan, r.sisa, r.biaya_sparepart, r.laba, r.parts_detail,
  ]);
  const totalRow = [
    'TOTAL', '', '', '', '', '', '', '', '', '',
    summary.jasa, summary.sparepart, summary.total,
    summary.dp, summary.cicilan, summary.sisa, summary.biaya_sparepart, summary.laba, '',
  ];

  const headerBlock = [
    [ctx.shopName || 'Klinik Kana'],
    [`Laporan Servis — ${monthName}`],
    [`Cabang: ${ctx.branchName || 'Semua Cabang'}`],
    [`Dicetak: ${new Date().toLocaleString('id-ID')}`],
    [],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet([...headerBlock, detailHeader, ...detailRows, totalRow]);
  // Column widths (heuristic)
  ws1['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 15 }, { wch: 22 },
    { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 40 },
  ];

  // ---------------- Sheet: Ringkasan ----------------
  const summaryRows = [
    [ctx.shopName || 'Klinik Kana'],
    [`Ringkasan Bulanan — ${monthName}`],
    [`Cabang: ${ctx.branchName || 'Semua Cabang'}`],
    [],
    ['Metrik', 'Nilai'],
    ['Total Tiket Selesai', summary.tickets],
    ['Pendapatan Jasa', summary.jasa],
    ['Pendapatan Sparepart', summary.sparepart],
    ['Total Pendapatan (bruto)', summary.total],
    ['— DP diterima', summary.dp],
    ['— Cicilan diterima', summary.cicilan],
    ['— Sisa piutang', summary.sisa],
    [],
    ['HPP Sparepart', summary.biaya_sparepart],
    ['Estimasi Laba Kotor', summary.laba],
    ['Margin (%)', summary.total > 0 ? ((summary.laba / summary.total) * 100).toFixed(2) + '%' : '0%'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 28 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan');
  XLSX.utils.book_append_sheet(wb, ws1, 'Detail Tiket');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = `Laporan-${monthName.replace(/\s+/g, '-')}-${(ctx.branchName || 'Semua').replace(/\s+/g, '-')}.xlsx`;
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
  return { filename, rowCount: rows.length };
}

/**
 * Export monthly report to PDF (jsPDF + autoTable, A4 landscape).
 */
export function exportMonthlyPDF(ctx) {
  const rows = buildRows(ctx);
  const summary = computeSummary(rows);
  const monthName = monthLabel(ctx.year, ctx.month);
  const shopName = ctx.shopName || 'Klinik Kana';
  const branchName = ctx.branchName || 'Semua Cabang';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(shopName, 14, 15);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Laporan Servis — ${monthName}`, 14, 22);
  doc.setFontSize(9);
  doc.text(`Cabang: ${branchName}`, 14, 28);
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 32);

  // Summary box (right side)
  const boxX = pageWidth - 90;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.rect(boxX, 12, 76, 26);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RINGKASAN', boxX + 3, 17);
  doc.setFont('helvetica', 'normal');
  const sy = 22;
  doc.text(`Tiket Selesai:`, boxX + 3, sy);
  doc.text(`${summary.tickets}`, boxX + 73, sy, { align: 'right' });
  doc.text(`Pendapatan:`, boxX + 3, sy + 4);
  doc.text(formatIDR(summary.total), boxX + 73, sy + 4, { align: 'right' });
  doc.text(`Biaya Sparepart:`, boxX + 3, sy + 8);
  doc.text(formatIDR(summary.biaya_sparepart), boxX + 73, sy + 8, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`Estimasi Laba:`, boxX + 3, sy + 12);
  doc.text(formatIDR(summary.laba), boxX + 73, sy + 12, { align: 'right' });

  // Detail table
  autoTable(doc, {
    startY: 42,
    head: [[
      'Tgl Selesai', 'Tiket', 'Pelanggan', 'Perangkat',
      'Teknisi', 'Jasa', 'Part', 'Total', 'DP', 'Sisa', 'Laba',
    ]],
    body: rows.map((r) => [
      r.tanggal_selesai, r.tiket, r.pelanggan, r.perangkat,
      r.teknisi,
      formatIDR(r.jasa), formatIDR(r.sparepart), formatIDR(r.total),
      formatIDR(r.dp), formatIDR(r.sisa), formatIDR(r.laba),
    ]),
    foot: [[
      { content: `TOTAL (${summary.tickets} tiket)`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
      formatIDR(summary.jasa), formatIDR(summary.sparepart), formatIDR(summary.total),
      formatIDR(summary.dp), formatIDR(summary.sisa), formatIDR(summary.laba),
    ]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
    columnStyles: {
      5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
      8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' },
    },
    didDrawPage: (data) => {
      // Footer page number
      const pageNo = doc.internal.getCurrentPageInfo().pageNumber;
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Halaman ${pageNo} / ${pageCount} • Dokumen laporan resmi ${shopName}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' },
      );
    },
  });

  const filename = `Laporan-${monthName.replace(/\s+/g, '-')}-${branchName.replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
  return { filename, rowCount: rows.length };
}
